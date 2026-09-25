/**
 * Brand names stripped during normalization (Requirements, "Matching mechanics").
 *
 * A maintained list, extended as real deal names arrive. Store brands are here because a
 * captured flyer names them on half its items ("Harris Teeter Cage Free Large Brown Eggs"),
 * and an ingredient never names a store.
 *
 * Stripping every brand can empty a name — "Coca-Cola 2L" is brand plus size — which is why
 * normalization falls back to the punctuation-stripped original when nothing is left.
 */
export const BRANDS: readonly string[] = [
  'aldi',
  'barilla',
  'coca cola',
  'cvs',
  "dave's killer",
  'food lion',
  'harris teeter',
  'kraft',
  'lowes foods',
  'progresso',
  'publix',
  'tide',
  'tropicana',
];
