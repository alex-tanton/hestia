import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn } from '../../lib/cn.ts';
import { createBarcodeDetector } from '../../lib/barcode/detector.ts';
import { playScanChime, triggerScanHaptic } from '../../lib/barcode/feedback.ts';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';

export interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcode: string, mode: 'add' | 'shop') => void;
}

const STORAGE_KEY = 'hestia.scanner_mode';

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
}: BarcodeScannerDialogProps): ReactElement | null {
  const [mode, setMode] = useState<'add' | 'shop'>(getInitialMode);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [torchOn, setTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [reticleSuccess, setReticleSuccess] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

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
    if (!open || activeTab !== 'camera' || cameraError) return;

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
              onScanRef.current(code, mode);
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
  }, [open, activeTab, cameraError, mode]);

  // Handle Escape key navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

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
    onScan(trimmed, mode);
    setManualInput('');
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
                <label htmlFor="manual-barcode-input" className="text-body-sm text-neutral-400">
                  Enter Barcode (UPC / EAN)
                </label>
                <input
                  id="manual-barcode-input"
                  type="text"
                  inputMode="numeric"
                  value={manualInput}
                  onChange={(e) => {
                    setManualInput(e.target.value.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 32));
                  }}
                  placeholder="000000000000"
                  className="w-full mt-2 text-center text-3xl font-mono tracking-widest bg-neutral-900 border border-neutral-700 rounded-lg py-3 px-4 text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--md-sys-color-primary)]"
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
                aria-label="Find & Mark Bought"
                onClick={handleManualSubmit}
                className="w-full h-12 text-body font-semibold"
              >
                Submit barcode number
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
