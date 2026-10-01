/**
 * Naming and placement for one E2E run, free of I/O so it can be checked without Docker
 * (Engineering Practices › Testing, "E2E environment"). Two runs on one machine must never share a
 * Compose project, network, image tag, state directory, or host port, so everything a run uses is
 * derived from its id. The one thing an id cannot settle is which subnet is free; that is settled
 * by Docker, which refuses an overlapping network, so it is handled where the network is created.
 */

const RUN_ID_PATTERN = /^[a-z0-9]{1,16}$/;

export interface RunNames {
  /** The Compose project: it prefixes every container and volume the run creates. */
  readonly project: string;
  /** The run's own network, created outside Compose so its subnet can be reserved atomically. */
  readonly network: string;
  /** The tag for the two images the run builds, so a concurrent run's build cannot replace them. */
  readonly imageTag: string;
}

export function runNames(runId: string): RunNames {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`HEARTH_E2E_RUN_ID must be 1-16 lowercase letters or digits (got '${runId}')`);
  }
  return {
    project: `hearth-e2e-${runId}`,
    network: `hearth-e2e-${runId}`,
    imageTag: `e2e-${runId}`,
  };
}

export interface Subnet {
  readonly subnet: string;
  readonly gateway: string;
}

/**
 * The /24s a run tries, in order. The production stack owns 172.16.238.0/24, so the range starts
 * above it. Docker refuses a network whose subnet overlaps one it already runs, so a run that
 * finds its candidate taken moves to the next.
 */
export const SUBNET_CANDIDATES: readonly Subnet[] = Array.from({ length: 15 }, (_, index) => {
  const third = 240 + index;
  return { subnet: `172.16.${String(third)}.0/24`, gateway: `172.16.${String(third)}.1` };
});

/** The `KEY=value` lines of a Compose env file, which is what the generated `.env` is. */
export function parseEnvFile(text: string): Record<string, string> {
  const entries = text
    .split('\n')
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => [match[1] ?? '', match[2] ?? ''] as const);
  return Object.fromEntries(entries);
}
