import { describe, expect, it } from 'vitest';
import {
  SCRUBBED_MESSAGE_MAX_LENGTH,
  scrubErrorName,
  scrubErrorReport,
  scrubErrorText,
  scrubFields,
  scrubRoute,
} from './scrub.js';

const USER_ID = '3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b';
const HOUSEHOLD_ID = 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D';
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJhQGIuY28ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/** Every fragment must be gone from the scrubbed text. */
function expectScrubbed(input: string, ...secrets: string[]): string {
  const output = scrubErrorText(input);
  for (const secret of secrets) {
    expect(output, `leaked ${secret} from ${input}`).not.toContain(secret);
  }
  return output;
}

describe('scrubErrorText: what survives', () => {
  it('keeps ordinary error text, route names, and ids', () => {
    expect(
      scrubErrorText(`Cannot finish departure for user ${USER_ID} in household ${HOUSEHOLD_ID}`),
    ).toBe(
      `Cannot finish departure for user ${USER_ID} in household ${HOUSEHOLD_ID.toLowerCase()}`,
    );
    expect(scrubErrorText('GET /api/households/:id failed with status 500')).toBe(
      'GET /api/households/:id failed with status 500',
    );
    expect(scrubErrorText("can't connect to database")).toBe("can't connect to database");
  });

  it('accepts non-strings and errors', () => {
    expect(scrubErrorText(undefined)).toBe('');
    expect(scrubErrorText(42)).toBe('');
    expect(scrubErrorText(new Error('boom at step 3'))).toBe('boom at step 3');
  });
});

describe('scrubErrorText: money', () => {
  it.each([
    ['Bill payment of $1,234.56 failed', '1,234.56'],
    ['amount 84.20 exceeds limit', '84.20'],
    ['amount: 8420', '8420'],
    ['Payment=€45 rejected', '45'],
    ['total is 12 dollars', '12 dollars'],
    ['rent 1450 overdue', '1450'],
    ['subtotal 7.5', '7.5'],
    ['charged -$3.99', '3.99'],
    ['price was £ 9', '9'],
    ['sale price 2.49/lb', '2.49'],
    ['paid 250 usd', '250'],
    ['value 12345 cents', '12345'],
  ])('removes the amount in %j', (input, secret) => {
    const output = expectScrubbed(input, secret);
    expect(output).toMatch(/\[(amount|number)\]/);
  });
});

describe('scrubErrorText: emails', () => {
  it.each([
    'Duplicate user alex@example.com',
    'user <Alex.Rivera+hestia@Example.CO.uk> not found',
    'mailto:sam@example.com bounced',
    'email=casey@example.com',
    'Login failed for "morgan@example.com"',
    'jordan@localhost',
  ])('removes the address in %j', (input) => {
    const output = scrubErrorText(input);
    expect(output).not.toMatch(/@/);
  });
});

describe('scrubErrorText: tokens and secrets', () => {
  it('removes JWTs anywhere, whole or partial', () => {
    expectScrubbed(`invalid token ${JWT}`, 'eyJ', 'SflKxwRJ');
    expectScrubbed(`jwt=${JWT}`, 'eyJ');
    expectScrubbed(`(${JWT})`, 'eyJ');
    expectScrubbed('header eyJhbGciOiJIUzI1NiIsInR5cCI6', 'eyJ');
  });

  it('removes bearer and basic credentials', () => {
    expectScrubbed('Authorization: Bearer abc.def.ghi', 'abc.def.ghi');
    expectScrubbed('authorization=Basic dXNlcjpwYXNz', 'dXNlcjpwYXNz');
    expectScrubbed('Token sk_live_1234abcd', 'sk_live_1234abcd');
    expectScrubbed('got bearer:xyz', 'xyz');
  });

  it('removes Supabase keys, hex digests, and base64 secrets', () => {
    expectScrubbed('apikey sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz', 'N7UND0Ug');
    expectScrubbed(
      'hash 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      '9f86d081884c',
    );
    expectScrubbed('refresh v1.MjAyNi0wOS0xOVQxMjozNDo1Ni43ODla', 'MjAyNi0wOS0x');
    expectScrubbed('token_hash abcdefABCDEF0123456789_-abcdef', 'abcdefABCDEF0123456789');
  });

  it('removes values of secret keys however they are written', () => {
    expectScrubbed('password=hunter2hunter2', 'hunter2');
    expectScrubbed('Password: "correct horse battery"', 'correct horse');
    expectScrubbed("secret='s3cr3t'", 's3cr3t');
    expectScrubbed('code=ABCD2345', 'ABCD2345');
    expectScrubbed('refresh_token=r3fr3sh&x=1', 'r3fr3sh');
    expectScrubbed('otp: 123456', '123456');
    expectScrubbed('cookie=sb-access-token=zzz', 'zzz');
  });
});

describe('scrubErrorText: household content', () => {
  it('removes quoted content of every quote style', () => {
    expectScrubbed('Could not add "Chicken breast" to list', 'Chicken');
    expectScrubbed("Could not add 'Chicken breast' to list", 'Chicken');
    expectScrubbed('Could not add `Chicken breast`', 'Chicken');
    expectScrubbed('Could not add “Chicken breast”', 'Chicken');
    expectScrubbed('Could not add ‘Chicken breast’', 'Chicken');
    expectScrubbed('Unterminated "Chicken breast', 'Chicken');
    expectScrubbed("Alex's list 'Groceries' is archived", 'Groceries');
  });

  it('removes JSON, arrays, and angle-bracketed payloads, however nested', () => {
    expectScrubbed(
      'Invalid body {"itemName":"Oat milk","quantity":{"value":2,"unit":"gal"}}',
      'Oat milk',
      'gal',
    );
    expectScrubbed('Unexpected items [Rice, [Beans, Salsa]]', 'Rice', 'Beans', 'Salsa');
    expectScrubbed('Bad <Pantry: Flour>', 'Flour');
  });

  it('removes values of content keys', () => {
    expectScrubbed('item: Chicken breast, qty 2', 'Chicken');
    expectScrubbed('name=Rent', 'Rent');
    expectScrubbed('title=Grandma lasagna', 'Grandma');
    expectScrubbed('quantity_note=2 cups', '2 cups');
    expectScrubbed('ingredients: tomatoes;', 'tomatoes');
    expectScrubbed('q=frozen pizza', 'frozen');
    expectScrubbed('display_name=Sam Chen', 'Sam');
  });

  it('removes URLs, which can carry recipes, search terms, and invite tokens', () => {
    expectScrubbed(
      'fetch failed: https://www.example.com/recipes/grandmas-lasagna?servings=4',
      'lasagna',
    );
    expectScrubbed('open https://hestia.aberrance.app/join#token=abcDEF', 'abcDEF');
    expectScrubbed('ws wss://host/realtime/v1?apikey=secret', 'secret');
    expectScrubbed('img data:image/png;base64,iVBORw0KGgo', 'iVBORw0KGgo');
  });

  it('removes decimals and long numbers, which are quantities, amounts, or card numbers', () => {
    expectScrubbed('quantity 1.5 lb', '1.5');
    expectScrubbed('card 4111111111111111 declined', '4111111111111111');
    expectScrubbed('call 5551234567', '5551234567');
  });
});

describe('scrubErrorText: hostile input', () => {
  it('flattens control characters and line breaks so a message cannot forge log lines', () => {
    const [nul, lineSeparator, zeroWidth] = [0, 0x2028, 0x200b].map((code) =>
      String.fromCharCode(code),
    );
    const output = scrubErrorText(
      `first\nsecond\r\n${nul ?? ''}third${lineSeparator ?? ''}fourth${zeroWidth ?? ''}fifth`,
    );
    expect(output).toBe('first second third fourth fifth');
  });

  it('caps the length at 500 characters', () => {
    const output = scrubErrorText('word '.repeat(1000));
    expect(output.length).toBeLessThanOrEqual(SCRUBBED_MESSAGE_MAX_LENGTH);
  });

  it('is fast on pathological input', () => {
    const inputs = [
      '{'.repeat(100_000),
      '['.repeat(50_000) + ']'.repeat(50_000),
      'a'.repeat(100_000),
      '"'.repeat(100_000),
      '$1'.repeat(50_000),
      'a@'.repeat(50_000),
    ];
    const started = performance.now();
    for (const input of inputs) scrubErrorText(input);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('does not mistake a placeholder-looking input for an id', () => {
    const mark = String.fromCharCode(1);
    const output = scrubErrorText(`${mark}0${mark} and alex@example.com`);
    expect(output).toBe('0 and [email]');
    expect(output).not.toContain('@');
  });

  it('scrubs a realistic Postgres error completely', () => {
    const output = scrubErrorText(
      'duplicate key value violates unique constraint "profile_email_key" Key (email)=(alex@example.com) already exists.',
    );
    expect(output).not.toContain('alex');
    expect(output).toContain('duplicate key value violates unique constraint');
  });

  it('scrubs a realistic fetch error with a JSON body', () => {
    const output = scrubErrorText(
      `POST /api/bills failed: 400 {"amount":"45.00","name":"Internet","ownerEmail":"sam@example.com","token":"${JWT}"}`,
    );
    for (const secret of ['45.00', 'Internet', 'sam@', 'eyJ']) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain('POST /api/bills failed: 400');
  });
});

describe('scrubErrorName', () => {
  it('keeps class-like names and replaces anything else', () => {
    expect(scrubErrorName('TypeError')).toBe('TypeError');
    expect(scrubErrorName('DOMException')).toBe('DOMException');
    expect(scrubErrorName('Some.Namespaced_Error$')).toBe('Some.Namespaced_Error$');
    expect(scrubErrorName('Chicken breast')).toBe('Error');
    expect(scrubErrorName('alex@example.com')).toBe('Error');
    expect(scrubErrorName('x'.repeat(81))).toBe('Error');
    expect(scrubErrorName(undefined)).toBe('Error');
    expect(scrubErrorName({ name: 'TypeError' })).toBe('Error');
  });
});

describe('scrubRoute', () => {
  it('keeps the shape of a path and drops everything identifying', () => {
    expect(scrubRoute('/lists/3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b')).toBe(
      '/lists/3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b',
    );
    expect(scrubRoute('/api/households/:id/members/:userId/departure-preview')).toBe(
      '/api/households/:id/members/:userId/departure-preview',
    );
    expect(scrubRoute('https://hestia.aberrance.app/join?token=abc#code=XYZ')).toBe('/join');
    expect(scrubRoute('/deals/search/Chicken%20Breast')).toBe('/deals/search/:param');
    expect(scrubRoute('/users/alex@example.com')).toBe('/users/:param');
    expect(scrubRoute('/bills/45.00')).toBe('/bills/:param');
    expect(scrubRoute('/Recipes/Lasagna')).toBe('/:param/:param');
  });

  it('handles empty, root, and non-string input', () => {
    expect(scrubRoute('')).toBe('unknown');
    expect(scrubRoute(undefined)).toBe('unknown');
    expect(scrubRoute('/')).toBe('/');
    expect(scrubRoute('?q=milk')).toBe('/');
  });

  it('caps the length', () => {
    expect(scrubRoute(`/${'a/'.repeat(500)}`).length).toBeLessThanOrEqual(200);
  });
});

describe('scrubErrorReport', () => {
  it('scrubs every field', () => {
    expect(
      scrubErrorReport({
        name: 'TypeError',
        message: 'Cannot read "Oat milk" for alex@example.com',
        route: '/lists/abc?x=1',
      }),
    ).toEqual({
      name: 'TypeError',
      message: 'Cannot read [text] for [email]',
      route: '/lists/abc',
    });
  });
});

describe('scrubFields', () => {
  it('keeps only allow-listed keys with safe values', () => {
    expect(
      scrubFields({
        householdId: HOUSEHOLD_ID,
        userId: 'not-a-uuid',
        list_id: USER_ID,
        route: '/lists/abc?q=milk',
        method: 'POST',
        status: 500,
        statusCode: 'x',
        job: 'refresh-deals',
        name: 'Oat milk',
        code: '23505',
        message: 'amount 45.00 for sam@example.com',
        amount: 4500,
        itemName: 'Oat milk',
        email: 'sam@example.com',
      }),
    ).toEqual({
      householdId: HOUSEHOLD_ID,
      userId: '[redacted]',
      list_id: USER_ID,
      route: '/lists/abc',
      method: 'POST',
      status: 500,
      statusCode: '[redacted]',
      job: 'refresh-deals',
      name: 'Error',
      code: '23505',
      message: 'amount [amount] for [email]',
      amount: '[redacted]',
      itemName: '[redacted]',
      email: '[redacted]',
    });
  });

  it('rejects a job name or method of the wrong shape', () => {
    expect(scrubFields({ job: 'Rent for Alex', method: 'get' })).toEqual({
      job: '[redacted]',
      method: '[redacted]',
    });
  });

  it('redacts a code that is not an uppercase Postgres-style code', () => {
    // '23505' in the earlier test looks like a code by coincidence; this checks the redacted
    // side of that same ternary, which no other test exercises (lowercase, and free text).
    expect(scrubFields({ code: 'not_a_code!' })).toEqual({ code: '[redacted]' });
    expect(scrubFields({ code: 'Validation failed' })).toEqual({ code: '[redacted]' });
  });
});
