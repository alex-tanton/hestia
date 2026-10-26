import type {
  PushOutcome,
  PushSubscriptionRecord,
  PushTransport,
} from '../jobs/dispatch-notifications.js';

/**
 * A push transport that records every attempt and answers from a table keyed by endpoint. Tests
 * use it, and so does the E2E stack when `HESTIA_PUSH_TRANSPORT` is `test-double` (see env.ts): the
 * record is then what the suite reads, and no push service is contacted. An endpoint with no entry
 * is accepted, which is the common case.
 */
export class RecordingPushTransport implements PushTransport {
  readonly sent: { endpoint: string; message: string }[] = [];
  readonly outcomes = new Map<string, PushOutcome | Error>();

  send(subscription: PushSubscriptionRecord, message: string): Promise<PushOutcome> {
    this.sent.push({ endpoint: subscription.endpoint, message });
    const answer = this.outcomes.get(subscription.endpoint) ?? { kind: 'accepted' };
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(answer);
  }

  reset(): void {
    this.sent.length = 0;
    this.outcomes.clear();
  }
}
