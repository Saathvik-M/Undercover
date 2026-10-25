# Status

## Built so far

Phase 1 of the pilot (`docs/PLAN.md`):

- `backend/`: SQLite at `backend/undercover.db`, seeded from `data/` on first use. Read endpoints: health, instructions, policy wording, handlers, the claims queue and one claim in full, with its policy, plan limits, add-ons, customer and history.

Still to build: the agent's workflow (decide, pay, sign-off), the agent itself, and the dashboard.

## How to run

- `npm run dev` starts the backend on :8000 and the dashboard on :5173.
- `npm run check` runs every check: Python (ruff, pyright, pytest) and TypeScript (ESLint, Prettier, tsc, vitest), then Playwright e2e.
