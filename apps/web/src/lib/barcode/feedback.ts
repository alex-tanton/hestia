/**
 * Sensory feedback utilities for barcode scanning.
 * Provides audio chime synthesis via native Web Audio API and haptic vibration feedback.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const win = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextClass = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume().catch(() => {
        // AudioContext resume might fail if no user gesture has occurred yet
      });
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Synthesizes a crisp scan chime using native Web Audio API sine oscillator.
 * Frequency: 880Hz (A5) for success, 440Hz (A4) for warning/fallback.
 * Decay: 150ms exponential envelope with zero network requests.
 */
export function playScanChime(success = true): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(success ? 880 : 440, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // Graceful fallback if Web Audio is unsupported or restricted
  }
}

/**
 * Triggers a short 40ms haptic vibration burst on supported mobile devices.
 */
export function triggerScanHaptic(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(40);
    }
  } catch {
    // Graceful fallback if vibration is not allowed or restricted
  }
}
