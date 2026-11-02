# Contributing to Hestia

## Development Workflow

1. **Prerequisites**: Node.js 24+, pnpm 10+, Docker with Compose plugin, and Supabase CLI.
2. **Setup**:
   ```bash
   pnpm install
   ```
3. **Quality Gates**:
   Before submitting changes, ensure all verification checks pass:
   ```bash
   pnpm lint           # ESLint rules (--max-warnings=0)
   pnpm format:check   # Prettier verification
   pnpm typecheck      # TypeScript compilation across all workspaces
   pnpm test           # Workspace unit & component tests
   ```

## Commit Guidelines

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification enforced via Husky and Commitlint:

- **Format:** `<type>(<optional-scope>): <subject>` (e.g., `feat(web): add recipe search`, `fix(service): correct quiet hours calculation`, `chore: update dependencies`).
- **Allowed Scopes:** `web`, `service`, `shared`, `recurrence`, `matching`, `db`, `e2e`, `docker` (or omitted).
- **Constraints:** Subject $\le$ 71 characters, total header line $\le$ 100 characters. Keep commits focused and atomic.

## Deployment

Deployments trigger automatically from passing `main` branch builds via `.github/workflows/deploy.yml`.
