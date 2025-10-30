# Repository Guidelines

## Project Structure & Module Organization
- `app/` Next.js App Router pages and route handlers.
- `lib/` Domain logic (booking, email, supabase, monitoring) and utilities.
- `src/contracts/` Shared schemas and generated DB types (`db.ts`).
- `components/` Reusable UI components; `hooks/` React hooks.
- `public/` static assets; `styles/` global Tailwind CSS.
- `scripts/` one-off scripts and SQL migrations; `docs/` project docs.
- Tests are colocated as `*.test.ts`/`*.test.tsx` next to sources.

## Build, Test, and Development Commands
- `npm run dev` Run Next.js locally.
- `npm run build` Production build; `npm start` serve build.
- `npm run lint` Lint with ESLint; `npm run type-check` TypeScript check.
- `npm run check` Lint + type-check; `npm run check:full` gen DB types + check + build.
- `npm test` Watch mode tests (Vitest); `npm run test:run` CI-style run.
- `npm run test:coverage` Coverage; `npm run test:ui` Vitest UI.
- `npm run gen:db` Generate Supabase types → `src/contracts/db.ts` (requires Supabase CLI).
- `npm run test:email` Preview email templates.

## Coding Style & Naming Conventions
- Language: TypeScript/React, Next.js 16, Tailwind CSS.
- Indentation: 2 spaces; semicolons optional per ESLint config; prefer named exports.
- Filenames: kebab-case (`booking-utils.ts`), tests `*.test.ts(x)`; React components as function components.
- Run `npm run lint` and fix all warnings; Husky pre-commit enforces type-check.

## Testing Guidelines
- Framework: Vitest + jsdom + Testing Library. Setup in `vitest.setup.ts`.
- Place unit tests alongside code (`lib/booking/pricing.test.ts`).
- Aim for meaningful coverage on business logic (`lib/booking/*`, `src/contracts/*`).
- Run locally with `npm test`; for CI parity use `npm run test:run` or `:coverage`.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat(scope): …`, `fix(area): …`, `docs: …`, `refactor: …`.
- Commits should be small, focused, and reference issues (e.g., `fix(booking): … #123`).
- PRs must include: clear description, rationale, testing steps, screenshots for UI, and any docs updates.
- Ensure `npm run check:full` passes and new tests are added/updated.

## Security & Configuration Tips
- Do not commit secrets. Use `.env.local` for Next.js, Supabase, Stripe, and Sentry keys.
- SQL in `scripts/` is for development—verify targets before running.
- Sentry config files are present; keep error contexts minimal and avoid PII.

