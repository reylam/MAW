import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { font, radius, toneColors, type Theme, type Tone } from '@/theme/tokens';

// Web StatusBadge: dot + uppercase label on a soft tinted chip. Only critical pulses.
export default function StatusBadge({ theme, tone, label }: { theme: Theme; tone: Tone; label: string }) {
  const c = toneColors(theme, tone);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (tone !== 'critical') { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [tone, pulse]);

  return (
    <Animated.View style={[styles.chip, { backgroundColor: c.soft, borderColor: c.border }]} accessibilityLabel={label}>
      <Animated.View style={[styles.dot, { backgroundColor: c.fg, opacity: pulse }]} />
      <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: font.sansSemi, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
});
