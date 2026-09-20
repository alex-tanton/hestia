import { startStack } from './setup/stack.ts';

/** One command brings the whole stack up: `pnpm test:e2e` from a cold machine is enough. */
export default function globalSetup(): void {
  startStack();
}
