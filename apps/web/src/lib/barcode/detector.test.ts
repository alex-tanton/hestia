import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBarcodeDetector,
  SUPPORTED_BARCODE_FORMATS,
  type BarcodeDetectorInstance,
  type BarcodeResult,
} from './detector.ts';

const mockPolyfillDetect = vi.fn<() => Promise<BarcodeResult[]>>();

vi.mock('@undecaf/barcode-detector-polyfill', () => ({
  BarcodeDetectorPolyfill: class MockPolyfill {
    formats: string[];
    constructor(opts: { formats: string[] }) {
      this.formats = opts.formats;
    }
    detect = mockPolyfillDetect;
  },
}));

describe('createBarcodeDetector', () => {
  const originalBarcodeDetector = (window as unknown as { BarcodeDetector?: unknown })
    .BarcodeDetector;

  afterEach(() => {
    vi.clearAllMocks();
    if (originalBarcodeDetector !== undefined) {
      (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = originalBarcodeDetector;
    } else {
      delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
    }
  });

  it('instantiates native window.BarcodeDetector when present on window', async () => {
    const mockNativeDetect = vi
      .fn()
      .mockResolvedValue([{ rawValue: '012345678905', format: 'upc_a' }]);

    class MockNativeBarcodeDetector implements BarcodeDetectorInstance {
      formats: string[];
      constructor(opts: { formats: string[] }) {
        this.formats = opts.formats;
      }
      detect = mockNativeDetect;
    }

    (window as unknown as { BarcodeDetector: unknown }).BarcodeDetector = MockNativeBarcodeDetector;

    const detector = await createBarcodeDetector();
    expect(detector).toBeInstanceOf(MockNativeBarcodeDetector);
    expect((detector as MockNativeBarcodeDetector).formats).toEqual(SUPPORTED_BARCODE_FORMATS);

    const fakeSource = {} as ImageBitmapSource;
    const results = await detector.detect(fakeSource);
    expect(mockNativeDetect).toHaveBeenCalledWith(fakeSource);
    expect(results).toEqual([{ rawValue: '012345678905', format: 'upc_a' }]);
  });

  it('falls back to BarcodeDetectorPolyfill when window.BarcodeDetector is undefined', async () => {
    delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;

    mockPolyfillDetect.mockResolvedValueOnce([{ rawValue: '7612345678900', format: 'ean_13' }]);

    const detector = await createBarcodeDetector();
    expect(detector).toBeDefined();

    const fakeSource = {} as ImageBitmapSource;
    const results = await detector.detect(fakeSource);
    expect(mockPolyfillDetect).toHaveBeenCalledWith(fakeSource);
    expect(results).toEqual([{ rawValue: '7612345678900', format: 'ean_13' }]);
  });
});
