# Status

## What the pilot does

The pilot from `docs/SPEC.md`, built to `docs/PLAN.md`: a claims platform where the UnderCover Agent works a queue of travel insurance claims, with a dashboard for the handlers.

- `backend/`: FastAPI and SQLite at `backend/undercover.db` (gitignored, seeded from `data/` on first start). Read endpoints for the queue, one claim in full, the policy wording, the agent's instructions and the handlers. Workflow endpoints: run (schedules the agent in a background task), start, events, decide, pay, sign-off. The backend owns every status — `waiting`, `in progress`, `waiting for sign-off`, `decided` — and the $1,000 rule: a payment over the limit is refused with 403 until a handler signs off, and no payment can exceed the decided payout.
- `agent/`: the UnderCover Agent on LangChain's `create_agent`, entry point `run(claim_id, thread_id)`. Five tools over the backend API only: get_claim, get_policy_wording, record_step, decide, pay. Its instructions are served by the backend from `backend/instructions.md`. GPT-6 Luna at low reasoning effort by default; set `MODEL_NAME` for another model, such as `openrouter/free`.
- `dashboard/`: React, Vite and TypeScript. The queue at `/`, the claim at `/claims/:id` with the decision card and the agent's live steps, actions to run the agent, sign off and pay, and the instructions at `/instructions`. Polls every 3 seconds.
- `e2e/`: Playwright tests for the queue, the claim page, the instructions page and a model-free sign-off journey.

Nothing reads `data/evals/` or `data/security/`; the agent decides from the claim, its policy and the wording alone.

## How to run

- `npm run dev` — backend on :8000 and dashboard on :5173.
- `npm run agent CLM-1001` — work one claim from the command line. For the free model, first `$env:MODEL_NAME = "openrouter/free"` in PowerShell.
- `npm run check` — every check: Python (ruff, pyright, pytest at 80% coverage), TypeScript (Prettier, ESLint, tsc, vitest at 80% coverage), Playwright e2e.

## How to work a claim

1. Open the queue and click a claim.
2. Click Run agent. The agent reads the claim and the policy wording, records its steps as it works, decides, and pays approvals under the limit.
3. If the payout is over $1,000, the payment waits: pick a handler, click Sign off, then Pay.

## Notes

- The e2e suite decides one real waiting claim through the API. After several runs, delete `backend/undercover.db` and restart the backend to reseed the queue.
- A referred or declined claim is recorded and shown as decided; the pilot has no referral workflow.