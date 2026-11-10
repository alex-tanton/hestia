/**
 * Universal W3C BarcodeDetector API wrapper with dynamic polyfill fallback.
 * Uses native GPU-accelerated BarcodeDetector where available (e.g. Chrome Android),
 * and dynamically loads WASM polyfill fallback for desktop/older browsers.
 */

export interface BarcodeResult {
  rawValue: string;
  format: string;
}

export interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<BarcodeResult[]>;
}

export const SUPPORTED_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'qr_code',
];

export async function createBarcodeDetector(): Promise<BarcodeDetectorInstance> {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    const NativeDetector = (
      window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => BarcodeDetectorInstance;
      }
    ).BarcodeDetector;
    return new NativeDetector({ formats: SUPPORTED_BARCODE_FORMATS });
  }

  // Dynamic import ensures WASM and polyfill code are only loaded if native API is missing
  const { BarcodeDetectorPolyfill } = await import('@undecaf/barcode-detector-polyfill');
  return new BarcodeDetectorPolyfill({
    formats: SUPPORTED_BARCODE_FORMATS,
  });
}
