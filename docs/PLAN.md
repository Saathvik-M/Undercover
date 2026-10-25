# Plan: the pilot

The pilot from `docs/SPEC.md`: a backend that serves the claims queue, the UnderCover Agent that works a claim the way a handler does, and a dashboard where handlers watch it happen and sign off payouts over $1,000.

## Design decisions

- **SQLite, standard library only.** Mutable state (claim status, decisions, agent steps, sign-offs) lives in one SQLite file, seeded from `data/*.json` on first start. No ORM and no migration machinery; the pilot's schema is four tables. Static reference data (plans, company settings, handlers, the policy wording) is read from `data/` directly.
- **The $1,000 rule is enforced by the backend, not the agent.** `pay` is its own operation that takes an amount; it refuses to pay more than the decided payout, and refuses any amount over $1,000 until a handler has signed off. Even an agent that insists on paying is blocked.
- **The agent's instructions are served by the backend.** The tech stack says the agent reaches claims and its instructions only through the backend's API. The backend serves the instructions from `backend/instructions.md` at `GET /api/instructions`; the agent builds its system prompt from that, and the dashboard shows the same text read-only. One source of truth.
- **Handlers start the agent from the dashboard.** A "Run agent" button calls `POST /api/claims/{id}/run`, which schedules `agent.main.run` as a background task (imported lazily, so backend and agent stay loosely coupled: the agent talks to the backend over HTTP, the backend only schedules the agent). A CLI entry point does the same for demos and tests. Week 3 moves the agent to AgentCore Runtime; the button keeps working then.
- **A referred claim is a decided claim.** The pilot has no referral workflow beyond recording the decision, so refer ends at `decided` like decline. Sign-off is only for approved payouts over $1,000, per the spec.
- **Polling, not websockets.** The dashboard re-fetches the queue and the open claim every 3 seconds. Simple, and enough to watch the agent work step by step.
- **Statuses:** `waiting`, `in progress`, `waiting for sign-off`, `decided`.
- **Out of scope, per the spec:** the claims manual, `data/knowledge.json`, sign-in, real payments, messages to customers. Nothing in `backend/` or `agent/` touches `data/evals/` or `data/security/`; no endpoint serves them.

## API surface

Every operation has an `operation_id`, a one-line docstring and no optional inputs.

| Operation | Purpose |
|---|---|
| `GET /api/health` | exists |
| `GET /api/instructions` | the agent's instructions, read-only |
| `GET /api/policy-wording` | the full wording text |
| `GET /api/handlers` | the claims handlers, for sign-off |
| `GET /api/claims` | the queue: id, customer, type, amount claimed, status, decision |
| `GET /api/claims/{claim_id}` | the claim in full: story, items, documents, policy with plan and add-ons, customer with history, decision, agent steps |
| `POST /api/claims/{claim_id}/run` | schedule the agent on a waiting claim |
| `POST /api/claims/{claim_id}/start` | mark the claim in progress |
| `POST /api/claims/{claim_id}/events` | the agent records a step |
| `POST /api/claims/{claim_id}/decide` | the agent's decision: decision, payout, explanation, policy section |
| `POST /api/claims/{claim_id}/pay` | pay an approved claim; takes the amount; enforces the sign-off rule |
| `POST /api/claims/{claim_id}/signoff` | a handler signs off; takes the handler id |

`decide` always takes a payout: 0 for decline and refer. Unknown claim ids return 404; wrong states return 409; a blocked payment returns 403 with the reason.

## The agent

`agent/main.py` keeps the entry point `run(claim_id, thread_id)`. It calls `start`, fetches its instructions, and works the claim with five tools, all thin wrappers over the backend API: `get_claim`, `get_policy_wording`, `record_step`, `decide`, `pay`. The instructions tell it to read the claim and its documents, check the relevant sections of the wording, work out the payout from the plan's limits, per-item caps, deductible and add-ons, record each step as it goes, then decide and, for approvals, pay. If the payment is refused as over the limit, it records that the claim now waits for sign-off and does not retry. The explanation is two or three sentences naming the policy section.

Default model `openai/gpt-6-luna` at low reasoning effort, or `MODEL_NAME` when set (`openrouter/free` costs nothing), exactly as the skeleton does. Tests use a stub model, never a real one.

## Phases

### Phase 1: Backend data and read endpoints

**Builds:** `backend/db.py` (schema, seeding, connections; the database file at `backend/undercover.db`, gitignored, with a fresh temp database for tests), `backend/instructions.md` (first draft, finished in phase 3), and the read endpoints: claims queue, claim detail, policy wording, instructions, handlers.

- [x] `uv run pytest backend/tests -q` passes, including new tests: the seed creates 25 claims, all `waiting`; the queue shows id, customer name, type, amount claimed, status; `CLM-1001` detail has policy `POL-2001` on plan premium, customer Maya Patel and one previous claim; an unknown claim id returns 404; the wording text contains "Trip Delay"; the instructions are non-empty; the handler list has 3 handlers.
- [x] `uv run ruff format --check`, `uv run ruff check` and `pyright` are clean.
- [x] With the dev server running, `Invoke-RestMethod http://localhost:8000/api/claims` returns 25 claims.

### Phase 2: Decisions, steps and the payment rule

**Builds:** the workflow endpoints: run, start, events, decide, pay, signoff. The backend owns every status transition and the $1,000 rule. `run` schedules the agent in a background task and refuses anything not `waiting`.

- [ ] `uv run pytest backend/tests -q` passes, including new tests that walk one claim through each path:
  - under the limit: decide approve $420, pay $420, status `decided`, `paid_amount` 420;
  - over the limit: decide approve $1,500, pay returns 403 and the status becomes `waiting for sign-off`, sign off as HND-01, pay $1,500, status `decided`;
  - decline and refer: payout recorded as 0, status `decided`;
  - guards: pay with no decision 409, pay more than the payout 409, sign off an unknown handler 404, decide with an unknown decision 422, unknown claim 404;
  - events are recorded in order and returned by the detail endpoint;
  - `run` on a non-waiting claim returns 409 (agent stubbed).
- [ ] With the dev server running, an `Invoke-RestMethod` decide on a waiting claim, then a pay, returns the decided claim; the same on an over-limit claim shows the 403 and the sign-off path.
- [ ] Ruff, pyright and pytest all clean.

### Phase 3: The agent

**Builds:** the agent's tools and `run()`, the finalized `backend/instructions.md`, and a CLI entry: `npm run agent CLM-1001`.

- [ ] `uv run pytest -q` passes, including agent tests with the stub model: a scripted run posts a decision and a payment through the TestClient backend and the claim ends `decided`; a scripted over-limit run ends `waiting for sign-off` with a recorded step and no second pay; `run()` marks the claim in progress before it works.
- [ ] `npm run agent CLM-1001` with `MODEL_NAME=openrouter/free` decides the claim: the API shows the decision with a payout and an explanation that names a section of the wording, and the recorded steps tell the story in order.
- [ ] No code in `backend/` or `agent/` reads `data/evals/` or `data/security/`.

### Phase 4: Dashboard shell and the queue

**Builds:** the dashboard shell: Inter and JetBrains Mono from Google Fonts, the brand palette as CSS variables, a typed API client, React Router, and the queue page, polling every 3 seconds with status and decision badges and dollar formatting. The hello-world app, its test and its e2e test are replaced.

- [ ] Vitest unit tests pass: the queue renders 25 rows from a stubbed fetch, badges match statuses, money renders as `$420.00`, polling stops on unmount.
- [ ] `e2e/health.spec.ts` is replaced by a queue test: the page shows seeded claims.
- [ ] Prettier, ESLint, tsc and vitest with coverage all pass (`npm run check:ts`).
- [ ] In the browser via the Playwright MCP server: `/` shows the queue styled to `docs/BRAND.md` (off-white page, white cards, 8px corners, royal blue primary, mono ids).

### Phase 5: Claim page, actions and instructions page

**Builds:** `/claims/:id` with the story, items, documents, policy with plan and add-ons, customer history, the agent's decision card and activity timeline (polling), and the actions: Run agent, Sign off (handler select) and Pay. Plus `/instructions`, read-only.

- [ ] Vitest unit tests pass: each section renders from a stubbed claim; the action buttons match the status (Run on waiting, Sign off on waiting-for-sign-off, Pay after sign-off, none on decided); the timeline renders steps; the instructions page shows the text from the API.
- [ ] In the browser via the Playwright MCP server, on a real run with `MODEL_NAME=openrouter/free`: run the agent on a waiting claim, watch steps appear while it works, then see the decision, payout and explanation. On an over-limit claim: sign off as a handler, pay, and see it decided.
- [ ] `npm run check:python` and `npm run check:ts` pass.

### Phase 6: End-to-end tests, status and handover

**Builds:** Playwright specs for the whole screen: the queue, a claim page, the instructions page, and a model-free sign-off journey (decide a waiting claim through the API, then sign off and pay in the UI). `docs/STATUS.md` rewritten: what the pilot does, how to run it, how to work a claim, and a short demo script.

- [ ] `npx playwright test` passes: queue loads 25 rows; a claim page shows story and policy; the instructions page shows the instructions; the API-decided over-limit claim can be signed off and paid in the UI and shows `decided`.
- [ ] `npm run check` passes in full: ruff format and lint, pyright, pytest at 80% coverage, Prettier, ESLint, tsc, vitest at 80% coverage, Playwright.
- [ ] `docs/STATUS.md` is up to date and every phase's work is committed.

## How the work runs

Each phase: build it with its tests, check every criterion, tick the boxes here, update `docs/STATUS.md`, and commit (the pre-commit hook reruns the checks). Never push. One commit per phase, plus fixes as needed.
