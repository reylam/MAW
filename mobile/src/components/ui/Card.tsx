import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { font, radius, space, type Theme } from '@/theme/tokens';

// Same surface as the web Card: one border, one radius, one soft shadow.
export function Card({ theme, style, children }: { theme: Theme; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, shadowOpacity: theme.dark ? 0.3 : 0.05 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Eyebrow({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <Text style={[styles.eyebrow, { color: theme.textSubtle }]}>{children}</Text>;
}

// Web CardHeader: icon, eyebrow + title on the left, optional action on the right.
export function CardHeader({
  theme,
  title,
  eyebrow,
  icon: Icon,
  action,
  divider = true,
}: {
  theme: Theme;
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  divider?: boolean;
}) {
  return (
    <View style={[styles.header, divider && { borderBottomWidth: 1, borderBottomColor: theme.borderSubtle }]}>
      <View style={styles.headerLeft}>
        {Icon && <Icon size={16} color={theme.textSubtle} />}
        <View style={styles.headerText}>
          {eyebrow && <Eyebrow theme={theme}>{eyebrow}</Eyebrow>}
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        </View>
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  eyebrow: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: font.display, fontSize: 15 },
});
