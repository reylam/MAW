import { useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { getNotifications } from '@/lib/notifications';
import type { MawState } from '@/types/maw';

/*
  Alarm table (DESIGN.md 6):
  SIAGA          1x short beep, 1x vibration, no push
  TUTUP          repeat every 3 s until acknowledged, long vibration, push (high)
  MENUNGGU AMAN  silent
  AMAN (after MENUNGGU AMAN)  2 rising tones, 1x vibration, push (normal)
  CEK MANUAL     repeat every 10 s, short-short vibration, push (high)
*/

const CHANNEL_ALARM = 'maw-alarm';
const CHANNEL_INFO = 'maw-info';

export async function setupAlarms() {
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false, // the app plays its own alarm tones
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_ALARM, {
    name: 'Alarm palang',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 800, 300, 800],
  }).catch(() => {});
  await Notifications.setNotificationChannelAsync(CHANNEL_INFO, {
    name: 'Info palang',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => {});
  await Notifications.requestPermissionsAsync().catch(() => {});
}

function notify(title: string, body: string, channelId: string) {
  const Notifications = getNotifications();
  if (!Notifications) return;
  // A channel-aware trigger delivers immediately on that Android channel.
  Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { channelId } }).catch(() => {});
}

function play(player: AudioPlayer) {
  player.seekTo(0).catch(() => {});
  player.play();
}

const VIBRATE_LONG = [0, 800, 300, 800];
const VIBRATE_SHORT = [0, 120, 120, 120, 120, 120];

export function useAlarms({
  state,
  acknowledged,
  crossingName,
  muted,
}: {
  state: MawState;
  acknowledged: boolean;
  crossingName: string;
  muted: boolean; // e.g. still connecting right after app start
}) {
  const siaga = useAudioPlayer(require('../../assets/sounds/siaga.wav'));
  const tutup = useAudioPlayer(require('../../assets/sounds/tutup.wav'));
  const aman = useAudioPlayer(require('../../assets/sounds/aman.wav'));
  const cek = useAudioPlayer(require('../../assets/sounds/cek.wav'));
  const prev = useRef<MawState | null>(null);

  // One-shot cues and push notifications on transitions.
  useEffect(() => {
    const from = prev.current;
    prev.current = state;
    if (from === state || muted) return;
    if (state === 'SIAGA') {
      play(siaga);
      Vibration.vibrate(200);
    } else if (state === 'TUTUP' && from !== 'MENUNGGU_AMAN') {
      notify('TUTUP PALANG SEKARANG', `${crossingName}: kereta terdeteksi mendekat.`, CHANNEL_ALARM);
    } else if (state === 'AMAN' && from === 'MENUNGGU_AMAN') {
      play(aman);
      Vibration.vibrate(200);
      notify('Palang boleh dibuka', `${crossingName}: pastikan rel kosong secara visual.`, CHANNEL_INFO);
    } else if (state === 'CEK_MANUAL') {
      notify('CEK MANUAL', `${crossingName}: jangan andalkan layar, ikuti SOP manual.`, CHANNEL_ALARM);
    }
  }, [state, muted, crossingName, siaga, aman]);

  // Repeating alarms: TUTUP until acknowledged, CEK MANUAL every 10 s.
  useEffect(() => {
    if (muted) return;
    let ring: (() => void) | null = null;
    let every = 0;
    if (state === 'TUTUP' && !acknowledged) {
      ring = () => { play(tutup); Vibration.vibrate(VIBRATE_LONG); };
      every = 3000;
    } else if (state === 'CEK_MANUAL') {
      ring = () => { play(cek); Vibration.vibrate(VIBRATE_SHORT); };
      every = 10_000;
    }
    if (!ring) return;
    ring();
    const id = setInterval(ring, every);
    return () => {
      clearInterval(id);
      Vibration.cancel();
      tutup.pause();
      cek.pause();
    };
  }, [state, acknowledged, muted, tutup, cek]);
}
