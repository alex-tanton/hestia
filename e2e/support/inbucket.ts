import { INBUCKET_BASE_URL } from './env.ts';

export interface InbucketMessageHeader {
  mailbox: string;
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  size: number;
}

export interface InbucketMessageDetail extends InbucketMessageHeader {
  body: {
    text: string;
    html: string;
  };
  header: Record<string, string[]>;
}

export async function purgeMailbox(usernameOrEmail: string): Promise<void> {
  const mailbox = usernameOrEmail.split('@')[0] ?? usernameOrEmail;
  await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${mailbox}`, { method: 'DELETE' });
}

export async function waitForLatestEmail(
  usernameOrEmail: string,
  timeoutMs = 10000,
): Promise<InbucketMessageDetail> {
  const mailbox = usernameOrEmail.split('@')[0] ?? usernameOrEmail;
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const res = await fetch(`${INBUCKET_BASE_URL}/api/v1/mailbox/${mailbox}`);
    if (res.ok) {
      const messages = (await res.json()) as InbucketMessageHeader[];
      const latest = messages[messages.length - 1];
      if (latest !== undefined) {
        const detailRes = await fetch(
          `${INBUCKET_BASE_URL}/api/v1/mailbox/${mailbox}/${latest.id}`,
        );
        if (detailRes.ok) {
          return (await detailRes.json()) as InbucketMessageDetail;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for email to ${usernameOrEmail} in Inbucket`);
}

export function extractOtpCode(email: InbucketMessageDetail): string {
  const match = /\b\d{6}\b/.exec(email.body.html) ?? /\b\d{6}\b/.exec(email.body.text);
  const code = match?.[0];
  if (!code) {
    throw new Error(`Could not find 6-digit OTP code in email body: ${email.body.html}`);
  }
  return code;
}

export function extractConfirmationUrl(email: InbucketMessageDetail): string {
  const match = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(email.body.html);
  const url = match?.[1];
  if (!url) {
    throw new Error(`Could not find confirmation URL in email body: ${email.body.html}`);
  }
  return url.replace(/&amp;/g, '&');
}
