# Status

## Built so far

Phase 1 of the pilot (`docs/PLAN.md`):

- `backend/`: SQLite at `backend/undercover.db`, seeded from `data/` on first use. Read endpoints: health, instructions, policy wording, handlers, the claims queue and one claim in full, with its policy, plan limits, add-ons, customer and history.

Phase 2:

- `backend/`: the agent's workflow endpoints. Run (schedules the agent as a background task), start, events, decide, pay and sign-off. The backend owns every status transition and the $1,000 rule: a payment over the limit is refused with 403 until a handler signs off, and no payment can exceed the decided payout.

Phase 3:

- `agent/`: the UnderCover Agent. Five tools over the backend API (get_claim, get_policy_wording, record_step, decide, pay), instructions fetched from the backend, entry point `run(claim_id, thread_id)` and a CLI: `npm run agent CLM-1001`. GPT-6 Luna at low reasoning by default, or `MODEL_NAME`. Checked against the free model: it measured the delay against the plan's waiting period, worked out the payout from the receipts and paid, with the deductible correctly left out.

Phase 4:

- `dashboard/`: React Router shell with Inter and JetBrains Mono, the brand palette as CSS variables, a typed API client, and the claims queue at `/`: 25 claims with customer, type, amount, status badge and decision badge, polling every 3 seconds. A favicon, unit tests and an e2e test for the queue.

Phase 5:

- `dashboard/`: the claim page at `/claims/:id` — story, items, documents, policy with plan limits and add-ons, customer with earlier claims, the agent's decision card and live activity timeline, and the actions: Run agent, Sign off (handler select) and Pay. The instructions page at `/instructions`, read only. Unit tests for every section and action.

Still to build: the e2e suite, the final checks and the handover notes.

## How to run

- `npm run dev` starts the backend on :8000 and the dashboard on :5173.
- `npm run check` runs every check: Python (ruff, pyright, pytest) and TypeScript (ESLint, Prettier, tsc, vitest), then Playwright e2e.
