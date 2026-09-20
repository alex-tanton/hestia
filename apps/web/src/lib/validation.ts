/** The first message a shared schema produced, for the field it belongs to. */
export function firstIssue(
  error: { issues: readonly { message: string }[] },
  fallback = 'Check this value.',
): string {
  return error.issues[0]?.message ?? fallback;
}
