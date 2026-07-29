import * as React from "react";
import { useUiPrefs } from "@/core/contexts/UiPrefsContext";

const SOUND_DEBOUNCE_MS = 900;
const MESSAGE_DURATION_MS = 1800;
const SHAKE_DURATION_MS = 320;

function playAttentionTone(): void {
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.33);
    osc.onended = () => { void ctx.close(); };
  } catch {
    /* Audio not available — silent fallback */
  }
}

export function useModalAttention(opts?: { message?: string }) {
  const { modalAlertSound } = useUiPrefs();
  const message = opts?.message ?? "يرجى إكمال أو إلغاء النافذة الحالية أولاً";

  const contentRef = React.useRef<HTMLDivElement>(null);
  const shakeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundAt = React.useRef<number>(0);
  const [attentionMessage, setAttentionMessage] = React.useState<string | null>(null);

  const attractAttention = React.useCallback(() => {
    const el = contentRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reducedMotion) {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      el.setAttribute("data-attention", "true");
      shakeTimerRef.current = setTimeout(() => {
        if (contentRef.current) contentRef.current.setAttribute("data-attention", "false");
        shakeTimerRef.current = null;
      }, SHAKE_DURATION_MS);
    }

    const now = Date.now();
    if (modalAlertSound && now - lastSoundAt.current >= SOUND_DEBOUNCE_MS) {
      lastSoundAt.current = now;
      playAttentionTone();
    }

    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    setAttentionMessage(message);
    msgTimerRef.current = setTimeout(() => {
      setAttentionMessage(null);
      msgTimerRef.current = null;
    }, MESSAGE_DURATION_MS);
  }, [modalAlertSound, message]);

  React.useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    };
  }, []);

  return { contentRef, attractAttention, attentionMessage };
}
