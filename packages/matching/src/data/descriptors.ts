/**
 * Descriptor terms stripped during normalization.
 *
 * A maintained list, deliberately data rather than regex, so adding a term is a one-line edit.
 * Entries may be phrases ("family pack"); they are matched on word boundaries after punctuation
 * stripping, so "sweet" never matches "Sweetpops". Only terms that describe a product without
 * changing what it is belong here: "whole" is absent because "whole milk" is not milk.
 *
 * The seed data fixes the minimum set; the rest are terms the 27514 captures show.
 */
export const DESCRIPTORS: readonly string[] = [
  'bag',
  'boneless',
  'chopped',
  'crowns',
  'crumbles',
  'extra large',
  'family pack',
  'fresh',
  'frozen',
  'grade a',
  'large',
  'organic',
  'red or green',
  'shredded',
  'skinless',
  'sliced',
  'sweet',
];
