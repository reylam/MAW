import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/*
  expo-notifications loads every native module on import, including
  ExpoPushTokenManager, which Expo Go on Android no longer ships (SDK 53+).
  Importing it there crashes the app with "Cannot find native module", so the
  module is loaded lazily and skipped in Expo Go on Android. Sound and
  vibration alarms still work; system notifications need a development build.
*/
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  const expoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (expoGoAndroid) return (cached = null);
  try {
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}
