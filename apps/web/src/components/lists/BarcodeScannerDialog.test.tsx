import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BarcodeDetectorInstance, BarcodeResult } from '../../lib/barcode/detector.ts';
import { BarcodeScannerDialog } from './BarcodeScannerDialog.tsx';

const mockDetect = vi.fn<() => Promise<BarcodeResult[]>>();

vi.mock('../../lib/barcode/detector.ts', () => ({
  createBarcodeDetector: vi.fn(() =>
    Promise.resolve<BarcodeDetectorInstance>({
      detect: mockDetect,
    }),
  ),
}));

vi.mock('../../lib/barcode/feedback.ts', () => ({
  playScanChime: vi.fn(),
  triggerScanHaptic: vi.fn(),
}));

describe('BarcodeScannerDialog', () => {
  let mockTrackStop: ReturnType<typeof vi.fn>;
  let mockGetUserMedia: ReturnType<typeof vi.fn>;
  let mockStream: MediaStream;

  beforeEach(() => {
    mockTrackStop = vi.fn();
    mockGetUserMedia = vi.fn(() => Promise.resolve(mockStream));
    const fakeTrack = {
      stop: mockTrackStop,
      getCapabilities: vi.fn(() => ({ torch: true })),
      applyConstraints: vi.fn(() => Promise.resolve()),
    } as unknown as MediaStreamTrack;

    mockStream = {
      getTracks: vi.fn(() => [fakeTrack]),
      getVideoTracks: vi.fn(() => [fakeTrack]),
    } as unknown as MediaStream;

    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: mockGetUserMedia,
      },
    });

    localStorage.clear();
    mockDetect.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog and camera viewfinder when open is true', () => {
    render(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('scanner-reticle')).toBeInTheDocument();
    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  });

  it('switches mode toggle and saves selection to localStorage', async () => {
    const user = userEvent.setup();
    render(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />);

    const addBtn = screen.getByRole('radio', { name: 'Add to List' });
    await user.click(addBtn);

    expect(localStorage.getItem('hestia.scanner_mode')).toBe('add');
    expect(addBtn).toHaveAttribute('data-state', 'on');
  });

  it('allows manual entry and submits barcode', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();

    render(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={onScan} />);

    // Switch to manual tab
    const switchBtn = screen.getByRole('button', { name: 'Switch to manual entry' });
    await user.click(switchBtn);

    // Type on numeric keypad: 1, 2, 3
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '3' }));

    const input = screen.getByLabelText<HTMLInputElement>(/enter barcode/i);
    expect(input.value).toBe('123');

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /find & mark bought|add to list/i });
    await user.click(submitBtn);

    expect(onScan).toHaveBeenCalledWith('123', 'shop');
    expect(input.value).toBe('');
  });

  it('enforces debounce window on camera scan detection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onScan = vi.fn();

    // Mock video readyState
    mockDetect.mockResolvedValue([{ rawValue: '012345678905', format: 'upc_a' }]);

    render(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={onScan} />);

    // Provide readyState to video element
    const video = document.querySelector('video');
    if (video) {
      Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    }

    // Advance 200ms for detection interval
    await vi.advanceTimersByTimeAsync(250);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('012345678905', 'shop');

    // Advance another 200ms with same barcode - should be ignored by 1.8s debounce window
    await vi.advanceTimersByTimeAsync(250);
    expect(onScan).toHaveBeenCalledTimes(1);

    // Advance past 1800ms debounce window
    await vi.advanceTimersByTimeAsync(1900);
    expect(onScan).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('stops all media stream tracks when dialog is closed', async () => {
    const { rerender } = render(
      <BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />,
    );

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    // Close dialog
    rerender(<BarcodeScannerDialog open={false} onOpenChange={vi.fn()} onScan={vi.fn()} />);

    expect(mockTrackStop).toHaveBeenCalled();
  });
});
