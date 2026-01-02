import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../utils/colors';

interface Props {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color?: string;
}

export default function StatCard({ icon, value, label, color }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconContainer, { backgroundColor: (color || colors.primary) + '15' }]}>
        {icon}
      </View>
      <Text style={styles.value}>{value}</Text>
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
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
