"""The UnderCover Agent."""

import os
import sys
from io import TextIOWrapper
from typing import cast

import httpx
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

load_dotenv(override=True)

BACKEND_URL = "http://localhost:8000"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-6-luna"
CLAIM_ARG_COUNT = 2


def backend() -> httpx.Client:
    """Return a client for the UnderCover backend."""
    return httpx.Client(base_url=BACKEND_URL, timeout=30)


def _call(method: str, path: str, body: dict | None = None) -> dict | str:
    """Call the backend and return its JSON, or the error detail as text."""
    with backend() as client:
        response = client.request(method, path, json=body)
    if not response.is_success:
        return response.json()["detail"]
    return response.json()


@tool
def get_claim(claim_id: str) -> dict | str:
    """Get a claim in full: story, items, documents, policy and customer."""
    return _call("GET", f"/api/claims/{claim_id}")


@tool
def get_policy_wording() -> str:
    """Get the full policy wording."""
    with backend() as client:
        response = client.get("/api/policy-wording")
    response.raise_for_status()
    return response.json()["wording"]


@tool
def record_step(claim_id: str, step: str) -> dict | str:
    """Record one short line about what you did on the claim."""
    return _call("POST", f"/api/claims/{claim_id}/events", {"step": step})


@tool
def decide(
    claim_id: str,
    decision: str,
    payout: float,
    explanation: str,
    policy_section: str,
) -> dict | str:
    """Record the decision, its payout, an explanation and the policy section."""
    return _call(
        "POST",
        f"/api/claims/{claim_id}/decide",
        {
            "decision": decision,
            "payout": payout,
            "explanation": explanation,
            "policy_section": policy_section,
        },
    )


@tool
def pay(claim_id: str, amount: float) -> dict | str:
    """Pay the claim the amount you decided."""
    return _call("POST", f"/api/claims/{claim_id}/pay", {"amount": amount})


def model() -> ChatOpenAI:
    """Return the model named in MODEL_NAME, or GPT-6 Luna by default."""
    name = os.getenv("MODEL_NAME")
    return ChatOpenAI(
        model=name or DEFAULT_MODEL,
        base_url=OPENROUTER_BASE_URL,
        api_key=SecretStr(os.environ["OPENROUTER_API_KEY"]),
        reasoning_effort=None if name else "low",
    )


def run(claim_id: str, thread_id: str, llm: BaseChatModel | None = None) -> str:
    """Run the agent on one claim and return its final reply."""
    with backend() as client:
        started = client.post(f"/api/claims/{claim_id}/start")
        started.raise_for_status()
        instructions = client.get("/api/instructions").json()["instructions"]
    agent = create_agent(
        llm or model(),
        tools=[get_claim, get_policy_wording, record_step, decide, pay],
        system_prompt=instructions,
    )
    result = agent.invoke(
        {"messages": [{"role": "user", "content": f"Work claim {claim_id}."}]},
        config={"configurable": {"thread_id": thread_id}},
    )
    return result["messages"][-1].text


if __name__ == "__main__":
    cast(TextIOWrapper, sys.stdout).reconfigure(encoding="utf-8")
    if len(sys.argv) != CLAIM_ARG_COUNT:
        print("Usage: uv run -m agent.main CLM-1001")
        raise SystemExit(2)
    print(run(sys.argv[1], f"{sys.argv[1]}-cli"))
