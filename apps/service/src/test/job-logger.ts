import type { JobLogger } from '../jobs/types.js';

/** One line a job wrote through its logger, as the tests read it back. */
export interface JobLogLine {
  level: string;
  message: string;
  data: Record<string, unknown>;
}

/**
 * A job logger that records every line into `lines`. The array is the one passed here, so a test
 * that resets its `lines` between tests builds the logger after the reset; `child()` returns the
 * same logger, so lines written under a job-name binding land in the same array.
 */
export function recordingJobLogger(lines: JobLogLine[]): JobLogger {
  const record = (level: string) => (data: Record<string, unknown>, message: string) => {
    lines.push({ level, data, message });
  };
  const self: JobLogger = {
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
    child: () => self,
  };
  return self;
}
