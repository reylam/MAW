import { useEffect, useRef, useState } from 'react';

/*
  Alarm tones for the dashboard watch panel (same pattern as the petugas app,
  mobile/DESIGN.md 6), generated with the Web Audio API so no audio files are
  needed. Browsers only allow sound after a user gesture, so the operator
  enables it once; the choice is remembered in localStorage.

  SIAGA        1x short beep
  TUTUP        two-tone alarm every 3 s until the closure is confirmed
  AMAN (after MENUNGGU AMAN)  two rising tones
  CEK MANUAL   short-short-short every 10 s
*/

const KEY = 'maw_alarm_sound';

function readPref() {
  try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
}

let ctx = null;
function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tones(list) {
  const a = audio();
  let t = a.currentTime + 0.02;
  for (const [freq, ms, gap = 0] of list) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
    t += (ms + gap) / 1000;
  }
}

const SOUND = {
  siaga: () => tones([[880, 160]]),
  tutup: () => tones([[1050, 220], [760, 220], [1050, 220], [760, 220]]),
  aman: () => tones([[523, 180, 60], [784, 260]]),
  cek: () => tones([[660, 90, 90], [660, 90, 90], [660, 90]]),
};

export function useWebAlarm({ state, acknowledged }) {
  const [enabled, setEnabled] = useState(readPref);
  const prev = useRef(state);

  const toggle = () => {
    const next = !enabled;
    try { localStorage.setItem(KEY, next ? 'on' : 'off'); } catch { /* ignore */ }
    if (next) SOUND.siaga(); // user gesture: unlocks audio and confirms it works
    setEnabled(next);
  };

  // One-shot cues on transitions.
  useEffect(() => {
    const from = prev.current;
    prev.current = state;
    if (!enabled || from === state) return;
    if (state === 'SIAGA') SOUND.siaga();
    if (state === 'AMAN' && from === 'MENUNGGU_AMAN') SOUND.aman();
  }, [state, enabled]);

  // Repeating alarms.
  useEffect(() => {
    if (!enabled) return;
    let ring = null;
    let every = 0;
    if (state === 'TUTUP' && !acknowledged) { ring = SOUND.tutup; every = 3000; }
    else if (state === 'CEK_MANUAL') { ring = SOUND.cek; every = 10_000; }
    if (!ring) return;
    ring();
    const id = setInterval(ring, every);
    return () => clearInterval(id);
  }, [state, acknowledged, enabled]);

  return { enabled, toggle };
}
