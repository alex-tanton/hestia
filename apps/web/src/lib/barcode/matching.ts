import { normalize } from '@hestia/matching';
import type { ListItem } from '@hestia/shared';

export interface MatchResult {
  exactBarcodeMatch: ListItem | null;
  normalizedNameMatch: ListItem | null;
  candidateMatches: ListItem[];
}

/**
 * Matches a scanned item against unbought list items.
 * Prioritizes 100% offline exact barcode matching first.
 * If no barcode match exists, attempts fuzzy name matching using normalized product titles.
 */
export function matchScannedItem(
  unboughtItems: readonly ListItem[],
  scannedBarcode: string,
  resolvedProductName: string | null,
): MatchResult {
  const barcodeTrimmed = scannedBarcode.trim();

  // 1. Exact barcode match (100% offline accuracy)
  if (barcodeTrimmed.length > 0) {
    const exactMatch = unboughtItems.find((item) => item.barcode === barcodeTrimmed);
    if (exactMatch) {
      return {
        exactBarcodeMatch: exactMatch,
        normalizedNameMatch: null,
        candidateMatches: [exactMatch],
      };
    }
  }

  // 2. If no product title is resolved, cannot match by name
  if (!resolvedProductName) {
    return {
      exactBarcodeMatch: null,
      normalizedNameMatch: null,
      candidateMatches: [],
    };
  }

  // 3. Normalize resolved product title
  const normalizedScanned = normalize(resolvedProductName).trim();
  if (normalizedScanned.length === 0) {
    return {
      exactBarcodeMatch: null,
      normalizedNameMatch: null,
      candidateMatches: [],
    };
  }

  // 4. Candidate matching against normalized names
  const candidates = unboughtItems.filter((item) => {
    const itemNameNorm = item.normalizedName.trim();
    if (itemNameNorm.length === 0) return false;

    return (
      itemNameNorm === normalizedScanned ||
      itemNameNorm.includes(normalizedScanned) ||
      normalizedScanned.includes(itemNameNorm)
    );
  });

  // Sort: exact matches first, then shorter names
  candidates.sort((a, b) => {
    const aExact = a.normalizedName.trim() === normalizedScanned;
    const bExact = b.normalizedName.trim() === normalizedScanned;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    return a.normalizedName.length - b.normalizedName.length;
  });

  // 5. If exactly one candidate matched, return as normalizedNameMatch
  if (candidates.length === 1) {
    return {
      exactBarcodeMatch: null,
      normalizedNameMatch: candidates[0] ?? null,
      candidateMatches: candidates,
    };
  }

  return {
    exactBarcodeMatch: null,
    normalizedNameMatch: null,
    candidateMatches: candidates,
  };
}
