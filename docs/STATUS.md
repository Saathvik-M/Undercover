# Status

## Built so far

Phase 1 of the pilot (`docs/PLAN.md`):

- `backend/`: SQLite at `backend/undercover.db`, seeded from `data/` on first use. Read endpoints: health, instructions, policy wording, handlers, the claims queue and one claim in full, with its policy, plan limits, add-ons, customer and history.

Phase 2:

- `backend/`: the agent's workflow endpoints. Run (schedules the agent as a background task), start, events, decide, pay and sign-off. The backend owns every status transition and the $1,000 rule: a payment over the limit is refused with 403 until a handler signs off, and no payment can exceed the decided payout.

Still to build: the agent itself, and the dashboard.

## How to run

- `npm run dev` starts the backend on :8000 and the dashboard on :5173.
- `npm run check` runs every check: Python (ruff, pyright, pytest) and TypeScript (ESLint, Prettier, tsc, vitest), then Playwright e2e.
