import { Camera, Delete, Flashlight, FlashlightOff, Keyboard, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createBarcodeDetector } from '../../lib/barcode/detector.ts';
import { playScanChime, triggerScanHaptic } from '../../lib/barcode/feedback.ts';
import { Button } from '../ui/Button.tsx';
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
}: BarcodeScannerDialogProps): ReactElement {
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

  const handleModeChange = (val: string) => {
    const nextMode = val === 'add' ? 'add' : 'shop';
    setMode(nextMode);
    try {
      localStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Storage access disabled or quota exceeded
    }
  };

  // Manage Camera MediaStream Lifecycle (T-14-05)
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
            : 'Could not access camera. Please enter barcode manually.';
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

  // Frame Analysis Detection Loop (T-14-04)
  useEffect(() => {
    if (!open || activeTab !== 'camera' || cameraError) return;

    let canceled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    void createBarcodeDetector().then((detector) => {
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
            onScan(code, mode);
          })
          .catch(() => {
            // Frame analysis dropped or skipped
          });
      }, 180);
    });

    return () => {
      canceled = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [open, activeTab, cameraError, mode, onScan]);

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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none focus:outline-none"
        >
          <Dialog.Title className="sr-only">Barcode Scanner</Dialog.Title>

          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between gap-3 p-4 bg-neutral-950/90 backdrop-blur border-b border-neutral-800 z-10">
            <div className="flex-1 max-w-xs">
              <SegmentedControl
                label="Scanner Mode"
                segments={[
                  { value: 'shop', label: 'Shop & Check Off' },
                  { value: 'add', label: 'Add to List' },
                ]}
                value={mode}
                onValueChange={handleModeChange}
              />
            </div>

            <div className="flex items-center gap-1">
              {activeTab === 'camera' && isTorchSupported && (
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
                  onClick={() => {
                    void toggleTorch();
                  }}
                  className="text-white hover:bg-neutral-800"
                >
                  {torchOn ? (
                    <FlashlightOff size={22} strokeWidth={1.5} />
                  ) : (
                    <Flashlight size={22} strokeWidth={1.5} />
                  )}
                </Button>
              )}

              <Button
                variant="ghost"
                isIconOnly
                aria-label={activeTab === 'camera' ? 'Switch to manual entry' : 'Switch to camera'}
                onClick={() => {
                  setActiveTab((prev) => {
                    const next = prev === 'camera' ? 'manual' : 'camera';
                    if (next === 'manual') {
                      setTorchOn(false);
                      setIsTorchSupported(false);
                    }
                    return next;
                  });
                }}
                className="text-white hover:bg-neutral-800"
              >
                {activeTab === 'camera' ? (
                  <Keyboard size={22} strokeWidth={1.5} />
                ) : (
                  <Camera size={22} strokeWidth={1.5} />
                )}
              </Button>

              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  isIconOnly
                  aria-label="Close scanner"
                  className="text-white hover:bg-neutral-800"
                >
                  <X size={22} strokeWidth={1.5} />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          {/* Viewport Content */}
          <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
            {activeTab === 'camera' ? (
              cameraError ? (
                <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm gap-4">
                  <p className="text-body text-neutral-300">{cameraError}</p>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setActiveTab('manual');
                    }}
                  >
                    Enter Barcode Manually
                  </Button>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Darkened overlay mask around reticle */}
                  <div className="absolute inset-0 bg-black/40 pointer-events-none" />

                  {/* Aiming Reticle (D-04) */}
                  <div
                    data-testid="scanner-reticle"
                    className={`relative z-10 w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border-2 transition-all duration-300 flex items-center justify-center ${
                      reticleSuccess
                        ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_32px_rgba(52,211,153,0.6)] scale-105'
                        : 'border-white/80 bg-transparent'
                    }`}
                  >
                    {/* Corner accent markers */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white pointer-events-none" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white pointer-events-none" />
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white pointer-events-none" />

                    {/* Laser scanning line */}
                    <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                  </div>

                  <p className="absolute bottom-8 z-10 text-body-sm font-medium text-white/90 bg-neutral-900/80 px-4 py-1.5 rounded-full backdrop-blur">
                    {mode === 'shop'
                      ? 'Scan product to mark bought'
                      : 'Scan product to add to list'}
                  </p>
                </div>
              )
            ) : (
              /* Manual Keypad Entry Tab (D-03) */
              <div className="w-full max-w-sm flex-1 flex flex-col justify-between p-6">
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
                      className="w-full mt-2 text-center text-3xl font-mono tracking-widest bg-neutral-900 border border-neutral-700 rounded-lg py-3 px-4 text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
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
                      <Delete size={22} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    variant="primary"
                    disabled={manualInput.trim().length < 3}
                    onClick={handleManualSubmit}
                    className="w-full h-12 text-body font-semibold"
                  >
                    {mode === 'shop' ? 'Find & Mark Bought' : 'Add to List'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
