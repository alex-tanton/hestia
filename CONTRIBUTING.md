# Contributing to Hestia

## Development Workflow

1. **Prerequisites**: Node.js 24+, pnpm 10+, Docker, and optionally Supabase CLI.
2. **Setup**:
   ```bash
   pnpm install
   ```
3. **Quality Gates**:
   Before submitting code, ensure all checks pass:
   ```bash
   pnpm lint          # ESLint rules
   pnpm format:check   # Prettier verification
   pnpm typecheck      # TypeScript validation across all workspaces
   pnpm test           # Workspace unit & component tests
   ```

## Commit Guidelines

- Write clear, imperative commit messages describing the change and rationale.
- Keep commits focused and atomic.

## Deployment

Deployments trigger automatically from passing `main` branch builds via `.github/workflows/deploy.yml`.
