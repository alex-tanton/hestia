import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBarcodeDetector,
  type BarcodeDetectorInstance,
  type BarcodeResult,
} from '../../lib/barcode/detector.ts';
import { playScanChime, triggerScanHaptic } from '../../lib/barcode/feedback.ts';
import { getMdButton, getMdField } from '../../test/md-queries.ts';
import { ToastProvider } from '../ui/Toast.tsx';
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

function renderDialog(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

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
    renderDialog(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('scanner-reticle')).toBeInTheDocument();
    expect(getMdButton('Close scanner')).toBeInTheDocument();
    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  });

  it('switches mode toggle and saves selection to localStorage', async () => {
    const user = userEvent.setup();
    renderDialog(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />);

    const addBtn = screen.getByRole('radio', { name: 'Add to List' });
    await user.click(addBtn);

    expect(localStorage.getItem('hestia.scanner_mode')).toBe('add');
    expect(addBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('allows manual entry and submits barcode', async () => {
    const user = userEvent.setup();
    const onScan = vi.fn();

    renderDialog(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={onScan} />);

    // Switch to manual tab
    const switchBtn = getMdButton('Switch to manual entry');
    await user.click(switchBtn);

    // Type on numeric keypad: 1, 2, 3
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '3' }));

    const input = getMdField('Barcode number');
    expect(input).toHaveProperty('value', '123');

    // Click submit
    const submitBtn = getMdButton('Submit barcode number');
    await user.click(submitBtn);

    expect(onScan).toHaveBeenCalledWith('123', 'shop', undefined);
    expect(input).toHaveProperty('value', '');
  });

  it('enforces debounce window on camera scan detection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onScan = vi.fn();

    // Mock video readyState
    mockDetect.mockResolvedValue([{ rawValue: '012345678905', format: 'upc_a' }]);

    renderDialog(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={onScan} />);

    // Provide readyState to video element
    const video = document.querySelector('video');
    if (video) {
      Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    }

    // Advance 200ms for detection interval
    await vi.advanceTimersByTimeAsync(250);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('012345678905', 'shop', undefined);

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
      <ToastProvider>
        <BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    // Close dialog
    rerender(
      <ToastProvider>
        <BarcodeScannerDialog open={false} onOpenChange={vi.fn()} onScan={vi.fn()} />
      </ToastProvider>,
    );

    expect(mockTrackStop).toHaveBeenCalled();
  });

  it('falls back to camera error message when detector initialization rejects', async () => {
    vi.mocked(createBarcodeDetector).mockRejectedValueOnce(new Error('WASM blocked'));

    renderDialog(<BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />);

    expect(
      await screen.findByText(/Unable to start the barcode scanner here/i),
    ).toBeInTheDocument();
  });

  it('does not recreate the barcode detector loop when onScan callback changes identity', async () => {
    const { rerender } = render(
      <ToastProvider>
        <BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(createBarcodeDetector).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ToastProvider>
        <BarcodeScannerDialog open={true} onOpenChange={vi.fn()} onScan={vi.fn()} />
      </ToastProvider>,
    );
    expect(createBarcodeDetector).toHaveBeenCalledTimes(1);
  });

  it('triggers instant audio/haptic feedback and updates batch counter persistent toast on scan', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onScan = vi.fn();
    const onUndo = vi.fn();

    mockDetect.mockResolvedValueOnce([{ rawValue: '012345678905', format: 'upc_a' }]);

    renderDialog(
      <BarcodeScannerDialog
        open={true}
        onOpenChange={vi.fn()}
        onScan={onScan}
        onUndoLastScan={onUndo}
      />,
    );

    const video = document.querySelector('video');
    if (video) {
      Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    }

    await vi.advanceTimersByTimeAsync(250);

    expect(playScanChime).toHaveBeenCalled();
    expect(triggerScanHaptic).toHaveBeenCalled();
    expect(onScan).toHaveBeenCalledWith('012345678905', 'shop', undefined);

    // Verify persistent snackbar appeared with batch count
    await waitFor(() => {
      expect(screen.getByText('Added 1 items')).toBeInTheDocument();
    });
    const undoButton = screen.getByRole('button', { name: 'Undo last' });
    expect(undoButton).toBeInTheDocument();

    // Trigger undo
    fireEvent.click(undoButton);
    expect(onUndo).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('triggers in-HUD quick naming sheet when unknown barcode is scanned', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onScan = vi.fn();

    mockDetect.mockResolvedValueOnce([{ rawValue: '9999990001', format: 'upc_a' }]);

    renderDialog(
      <BarcodeScannerDialog
        open={true}
        onOpenChange={vi.fn()}
        onScan={onScan}
        isKnownBarcode={(code) => code !== '9999990001'}
      />,
    );

    const video = document.querySelector('video');
    if (video) {
      Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    }

    // Advance timer to trigger detection
    await vi.advanceTimersByTimeAsync(250);

    // ModalBottomSheet opens with title "Name this item"
    expect(screen.getByText('Name this item')).toBeInTheDocument();
    expect(screen.getByText('Add details for this unrecognized barcode')).toBeInTheDocument();

    // Type item name
    const nameField = getMdField('Item name');
    (nameField as unknown as { value: string }).value = 'Organic Oat Milk';
    nameField.dispatchEvent(new Event('change', { bubbles: true }));

    // Click category chip
    const dairyChip = screen.getByText('Dairy');
    fireEvent.click(dairyChip);

    // Click Save and resume scanning
    const saveBtn = getMdButton('Save and resume scanning');
    fireEvent.click(saveBtn);

    expect(onScan).toHaveBeenCalledWith('9999990001', 'shop', {
      name: 'Organic Oat Milk',
      category: 'Dairy',
    });

    vi.useRealTimers();
  });
});
