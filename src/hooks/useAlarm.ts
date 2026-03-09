import { useRef, useCallback } from "react";

export function useAlarm() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const isPlayingRef = useRef(false);

  const playAlarm = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.2);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.4);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.6);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 1);

    oscillator.onended = () => {
      isPlayingRef.current = false;
      ctx.close();
    };
  }, []);

  const stopAlarm = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      isPlayingRef.current = false;
    }
  }, []);

  return { playAlarm, stopAlarm };
}
