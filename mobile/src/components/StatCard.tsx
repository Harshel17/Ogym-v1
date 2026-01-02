import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../utils/colors';

interface Props {
  value: number | string;
  label: string;
  color?: string;
}

export default function StatCard({ value, label, color }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: (color || colors.primary) + '15' }]}>
        <Text style={[styles.valueInner, { color: color || colors.primary }]}>{value}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  valueInner: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
