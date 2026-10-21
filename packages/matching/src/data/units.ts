/**
 * Measurement words stripped with the quantity they belong to (strip punctuation, quantities, and
 * units).
 *
 * A unit is only dropped when a number precedes it, so "Egg Noodles, 12 oz" loses "12 oz" while
 * a product whose name genuinely contains one of these words keeps it.
 */
export const UNITS: readonly string[] = [
  'ct',
  'count',
  'doz',
  'dozen',
  'ea',
  'each',
  'fl',
  'g',
  'gal',
  'gallon',
  'gallons',
  'gram',
  'grams',
  'in',
  'inch',
  'kg',
  'l',
  'lb',
  'lbs',
  'liter',
  'liters',
  'litre',
  'litres',
  'ml',
  'oz',
  'ounce',
  'ounces',
  'pack',
  'pk',
  'pkg',
  'pound',
  'pounds',
  'pt',
  'pint',
  'pints',
  'qt',
  'quart',
  'quarts',
];
