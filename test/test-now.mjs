/*
 * Parses `HEARTH_TEST_NOW`, the instant the clock pin freezes `Date` at. It must be a complete
 * ISO-8601 instant with an explicit offset or `Z`, such as `2030-10-05T21:30:00Z` or
 * `2030-10-05T23:30:00+02:00`. A value without an offset (`2030-10-05T12:00:00`, `Oct 5 2030`) is
 * read in the machine's zone, so the "same" pin would be a different instant in every sweep cell.
 */

const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-](\d{2}):(\d{2}))$/;

/** The instant in epoch milliseconds, or an Error naming `HEARTH_TEST_NOW` and the accepted form. */
export function parseTestNow(value) {
  const reject = (reason) =>
    new Error(
      `HEARTH_TEST_NOW="${value}" ${reason}; use an ISO-8601 instant with an explicit offset or Z, ` +
        'such as 2030-10-05T21:30:00Z or 2030-10-05T23:30:00+02:00',
    );

  const match = ISO_INSTANT.exec(value);
  if (match === null) throw reject('is not in that form');

  const [, year, month, day, hour, minute, second = '0', , offsetHour = '0', offsetMinute = '0'] =
    match.map((part) => part);
  const parts = [year, month, day, hour, minute, second].map(Number);
  const [y, mo, d, h, mi, s] = parts;
  const calendar = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const sameDate =
    calendar.getUTCFullYear() === y &&
    calendar.getUTCMonth() === mo - 1 &&
    calendar.getUTCDate() === d;
  if (
    !sameDate ||
    h > 23 ||
    mi > 59 ||
    s > 59 ||
    Number(offsetHour) > 23 ||
    Number(offsetMinute) > 59
  ) {
    throw reject('is not a real date and time');
  }

  const instant = Date.parse(value);
  if (Number.isNaN(instant)) throw reject('is not a valid instant');
  return instant;
}
