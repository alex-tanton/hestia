import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';
import { createBarcodeDetector } from '../../lib/barcode/detector.ts';
import { playScanChime, triggerScanHaptic } from '../../lib/barcode/feedback.ts';
import { MdFilterChip } from '../md/MdFilterChip.tsx';
import { Button } from '../ui/Button.tsx';
import { TextField } from '../ui/Field.tsx';
import { Icon } from '../ui/Icon.tsx';
import { ModalBottomSheet } from '../ui/ModalBottomSheet.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { useToast } from '../ui/Toast.tsx';

export interface ScannedItemDetails {
  name?: string | undefined;
  category?: string | undefined;
}

export interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string, mode: 'add' | 'shop', details?: ScannedItemDetails) => void;
  onUndoLastScan?: (() => void) | undefined;
  isKnownBarcode?: ((barcode: string) => boolean) | undefined;
}

const STORAGE_KEY = 'hestia.scanner_mode';
const CATEGORIES = ['Produce', 'Dairy', 'Bakery', 'Pantry', 'Frozen', 'Meat', 'Household'] as const;

function getInitialMode(): 'add' | 'shop' {
  if (typeof window === 'undefined') return 'shop';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'add' ? 'add' : 'shop';
  } catch {
    return 'shop';
  }
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  onUndoLastScan,
  isKnownBarcode,
}: BarcodeScannerDialogProps): ReactElement | null {
  const toast = useToast();
  const [mode, setMode] = useState<'add' | 'shop'>(getInitialMode);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [torchOn, setTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [reticleSuccess, setReticleSuccess] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Session state (D-14, D-16)
  const [, setScannedCount] = useState(0);
  const scannedCountRef = useRef(0);
  const [, setSessionItems] = useState<
    { code: string; mode: 'add' | 'shop'; details?: ScannedItemDetails | undefined }[]
  >([]);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [unknownName, setUnknownName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const onScanRef = useRef(onScan);
  const onUndoLastScanRef = useRef(onUndoLastScan);
  const isKnownBarcodeRef = useRef(isKnownBarcode);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onUndoLastScanRef.current = onUndoLastScan;
  }, [onUndoLastScan]);

  useEffect(() => {
    isKnownBarcodeRef.current = isKnownBarcode;
  }, [isKnownBarcode]);

  const handleUndoLastScan = useCallback(() => {
    scannedCountRef.current = Math.max(0, scannedCountRef.current - 1);
    setScannedCount(scannedCountRef.current);
    setSessionItems((prev) => prev.slice(0, -1));
    onUndoLastScanRef.current?.();
  }, []);

  const commitScan = useCallback(
    (code: string, details?: ScannedItemDetails) => {
      onScanRef.current(code, mode, details);
      setSessionItems((prev) => [...prev, { code, mode, details }]);
      scannedCountRef.current += 1;
      const nextCount = scannedCountRef.current;
      setScannedCount(nextCount);
      toast({
        variant: 'success',
        message: `Added ${String(nextCount)} items`,
        action: {
          label: 'Undo last',
          onAction: () => {
            handleUndoLastScan();
          },
        },
      });
    },
    [mode, toast, handleUndoLastScan],
  );

  const handleModeChange = (val: string) => {
    const nextMode = val === 'add' ? 'add' : 'shop';
    setMode(nextMode);
    try {
      localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Storage access disabled or quota exceeded
    }
  };

  // Manage Camera MediaStream Lifecycle (T-19-07)
  useEffect(() => {
    if (!open || activeTab !== 'camera') {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    async function startCamera() {
      setCameraError(null);
      try {
        const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;
        if (!mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported by your browser.');
        }

        const stream = await mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!isSubscribed) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const capabilities = videoTrack.getCapabilities() as { torch?: boolean };
          if (capabilities.torch) {
            setIsTorchSupported(true);
          }
        }
      } catch (err) {
        if (!isSubscribed) return;
        const message =
          err instanceof Error
            ? err.message
            : 'Check browser camera permissions or switch to manual keypad entry.';
        setCameraError(message);
      }
    }

    void startCamera();

    return () => {
      isSubscribed = false;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      setTorchOn(false);
      setIsTorchSupported(false);
    };
  }, [open, activeTab]);

  // Frame Analysis Detection Loop (T-14-04 / LIST-03)
  useEffect(() => {
    if (!open || activeTab !== 'camera' || cameraError || unknownBarcode !== null) return;

    let canceled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    void createBarcodeDetector()
      .then((detector) => {
        if (canceled) return;

        intervalId = setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

          void detector
            .detect(video)
            .then((barcodes) => {
              if (canceled || barcodes.length === 0) return;
              const code = barcodes[0]?.rawValue.trim();
              if (!code) return;

              // 1.8-second debounce window on identical barcode reads
              const now = Date.now();
              if (code === lastScanRef.current.code && now - lastScanRef.current.time < 1800) {
                return;
              }

              lastScanRef.current = { code, time: now };
              setReticleSuccess(true);
              setTimeout(() => {
                setReticleSuccess(false);
              }, 400);

              playScanChime(true);
              triggerScanHaptic();

              const isKnown = isKnownBarcodeRef.current ? isKnownBarcodeRef.current(code) : true;

              if (!isKnown) {
                setUnknownBarcode(code);
              } else {
                commitScan(code);
              }
            })
            .catch(() => {
              // Frame analysis dropped or skipped
            });
        }, 180);
      })
      .catch(() => {
        if (canceled) return;
        setCameraError('Unable to start the barcode scanner here. Use manual entry instead.');
      });

    return () => {
      canceled = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [open, activeTab, cameraError, mode, unknownBarcode, commitScan]);

  // Handle Escape key navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (unknownBarcode !== null) {
          setUnknownBarcode(null);
          return;
        }
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange, unknownBarcode]);

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      // Hardware constraint failed
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (manualInput.length < 32) {
      setManualInput((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    setManualInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setManualInput('');
  };

  const handleManualSubmit = () => {
    const trimmed = manualInput.trim();
    if (trimmed.length < 3) return;

    playScanChime(true);
    triggerScanHaptic();

    const isKnown = isKnownBarcodeRef.current ? isKnownBarcodeRef.current(trimmed) : true;
    if (!isKnown) {
      setUnknownBarcode(trimmed);
    } else {
      commitScan(trimmed);
    }
    setManualInput('');
  };

  const handleSaveUnknown = () => {
    if (!unknownBarcode) return;
    commitScan(unknownBarcode, {
      name: unknownName.trim(),
      category: selectedCategory ?? undefined,
    });
    setUnknownBarcode(null);
    setUnknownName('');
    setSelectedCategory(null);
  };

  if (!open) return null;

  return (
    <dialog
      open
      aria-label="Barcode scanner"
      className="fixed inset-0 z-50 flex size-full flex-col bg-[#1A110E] text-[#FFF8F6] outline-none overflow-hidden m-0 p-0 max-w-none max-h-none border-0 select-none"
    >
      {/* Top action bar: back/close, torch */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/60 to-transparent">
        <Button
          variant="ghost"
          isIconOnly
          aria-label="Close scanner"
          onClick={() => {
            onOpenChange(false);
          }}
          className="text-white hover:bg-white/10"
        >
          <Icon name="arrow_back" size={24} className="text-white" />
        </Button>

        <div className="flex items-center gap-2">
          {activeTab === 'manual' ? (
            <Button
              variant="ghost"
              aria-label="Switch to camera"
              onClick={() => {
                setActiveTab('camera');
              }}
              className="text-white hover:bg-white/10"
            >
              <Icon name="photo_camera" size={22} className="mr-1.5 text-white" />
              <span>Camera</span>
            </Button>
          ) : (
            isTorchSupported && (
              <Button
                variant="ghost"
                isIconOnly
                aria-label="Toggle flashlight"
                onClick={() => {
                  void toggleTorch();
                }}
                className="text-white hover:bg-white/10"
              >
                <Icon
                  name={torchOn ? 'flashlight_off' : 'flashlight_on'}
                  size={24}
                  className="text-white"
                />
              </Button>
            )
          )}
        </div>
      </div>

      {/* Center Viewport */}
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden size-full">
        {activeTab === 'camera' ? (
          cameraError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm gap-4 z-10">
              <Icon name="error" size={48} className="text-[var(--md-sys-color-error)]" />
              <h2 className="text-title-md font-semibold text-white">
                Camera access is unavailable
              </h2>
              <p className="text-body text-neutral-300">{cameraError}</p>
              <Button
                variant="primary"
                onClick={() => {
                  setActiveTab('manual');
                }}
              >
                Enter barcode manually
              </Button>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 size-full object-cover"
              />

              {/* Darkened overlay mask around reticle */}
              <div className="absolute inset-0 bg-black/40 pointer-events-none" />

              {/* Aiming Reticle (D-15) */}
              <div
                data-testid="scanner-reticle"
                className={cn(
                  'absolute size-64 rounded-lg border-2 pointer-events-none flex items-center justify-center transition-all duration-300',
                  reticleSuccess
                    ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_32px_rgba(52,211,153,0.6)] scale-105'
                    : 'border-[var(--md-sys-color-primary)] bg-transparent',
                )}
              >
                {/* Subtle corner-bracket markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[var(--md-sys-color-primary)]" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[var(--md-sys-color-primary)]" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[var(--md-sys-color-primary)]" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[var(--md-sys-color-primary)]" />

                {/* Terracotta pulsing laser scan line */}
                <div className="w-full h-0.5 bg-[var(--md-sys-color-primary)] animate-pulse" />
              </div>

              {/* Bottom floating controls (D-15) */}
              <div className="absolute bottom-6 inset-x-4 flex flex-col items-center gap-3 z-10 pb-[env(safe-area-inset-bottom)]">
                <SegmentedControl
                  label="Scanner mode"
                  segments={[
                    { value: 'add', label: 'Add to List' },
                    { value: 'shop', label: 'Mark bought' },
                  ]}
                  value={mode}
                  onValueChange={handleModeChange}
                />
                <Button
                  variant="ghost"
                  aria-label="Switch to manual entry"
                  onClick={() => {
                    setActiveTab('manual');
                  }}
                  className="text-white hover:bg-white/10"
                >
                  <Icon name="keyboard" size={20} className="mr-2 text-white" />
                  <span>Enter code manually</span>
                </Button>
              </div>
            </div>
          )
        ) : (
          /* Manual Keypad Entry Tab (D-15) */
          <div className="w-full max-w-sm flex-1 flex flex-col justify-between p-6 pt-20 z-10">
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <TextField
                  label="Barcode number"
                  name="barcode"
                  inputMode="numeric"
                  value={manualInput}
                  onChange={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    setManualInput(val.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 32));
                  }}
                />
              </div>

              {/* On-screen Keypad */}
              <div className="grid grid-cols-3 gap-2.5 mt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      handleKeypadPress(digit);
                    }}
                    className="h-14 text-2xl font-semibold bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 rounded-lg text-white transition-colors"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-14 text-sm font-semibold text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleKeypadPress('0');
                  }}
                  className="h-14 text-2xl font-semibold bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 rounded-lg text-white transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  aria-label="Backspace"
                  onClick={handleBackspace}
                  className="h-14 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-700 rounded-lg transition-colors"
                >
                  <Icon name="backspace" size={22} />
                </button>
              </div>
            </div>

            <div className="pt-4">
              <Button
                variant="primary"
                disabled={manualInput.trim().length < 3}
                aria-label="Submit barcode number"
                onClick={handleManualSubmit}
                className="w-full h-12 text-body font-semibold"
              >
                Submit barcode number
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* In-HUD Quick Naming Bottom Sheet (D-14) */}
      <ModalBottomSheet
        open={unknownBarcode !== null}
        onOpenChange={(sheetOpen) => {
          if (!sheetOpen) {
            setUnknownBarcode(null);
            setUnknownName('');
            setSelectedCategory(null);
          }
        }}
        title="Name this item"
        description="Add details for this unrecognized barcode"
      >
        <div className="flex flex-col gap-4 py-2">
          <TextField
            label="Item name"
            name="name"
            value={unknownName}
            onChange={(e) => {
              setUnknownName((e.target as HTMLInputElement).value);
            }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-label-sm font-semibold text-[var(--md-sys-color-on-surface-variant)]">
              Category
            </span>
            <div className="flex flex-wrap gap-2 py-1">
              {CATEGORIES.map((cat) => (
                <MdFilterChip
                  key={cat}
                  selected={selectedCategory === cat}
                  onClick={() => {
                    setSelectedCategory((prev) => (prev === cat ? null : cat));
                  }}
                >
                  {cat}
                </MdFilterChip>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setUnknownBarcode(null);
                setUnknownName('');
                setSelectedCategory(null);
              }}
            >
              Skip
            </Button>
            <Button variant="primary" disabled={!unknownName.trim()} onClick={handleSaveUnknown}>
              Save and resume scanning
            </Button>
          </div>
        </div>
      </ModalBottomSheet>
    </dialog>
  );
}
