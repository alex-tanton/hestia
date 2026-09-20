import { stopStack } from './setup/stack.ts';

export default function globalTeardown(): void {
  stopStack();
}
