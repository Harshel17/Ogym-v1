import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { memberApi, AttendanceRecord } from '../../api/member';
import LoadingScreen from '../../components/LoadingScreen';
import { colors, spacing, borderRadius } from '../../utils/colors';

export default function AttendanceScreen() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gymCode, setGymCode] = useState('');
  const [isCheckinLoading, setIsCheckinLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await memberApi.getMyAttendance();
      setAttendance(data);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleCheckin = async () => {
    if (!gymCode.trim()) {
      Alert.alert('Error', 'Please enter the gym code');
      return;
    }

    setIsCheckinLoading(true);
    try {
      await memberApi.checkin(gymCode.trim().toUpperCase());
      Alert.alert('Success', 'Check-in successful!');
      setGymCode('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Check-in Failed', error.response?.data?.message || 'Invalid gym code');
    } finally {
      setIsCheckinLoading(false);
    }
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'qr': return { label: 'QR', color: colors.blue };
      case 'workout': return { label: 'Workout', color: colors.green };
      case 'both': return { label: 'Both', color: colors.purple };
      case 'manual': return { label: 'Manual', color: colors.orange };
      default: return { label: method, color: colors.secondary };
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading attendance..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.subtitle}>Track your gym visits</Text>

      {user?.role === 'member' && (
        <View style={styles.checkinCard}>
          <Text style={styles.checkinTitle}>Quick Check-in</Text>
          <Text style={styles.checkinSubtitle}>Enter the gym code to check in</Text>
          <View style={styles.checkinForm}>
            <TextInput
              style={styles.checkinInput}
              value={gymCode}
              onChangeText={setGymCode}
              placeholder="Enter gym code"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.checkinButton, isCheckinLoading && styles.buttonDisabled]}
              onPress={handleCheckin}
              disabled={isCheckinLoading}
            >
              {isCheckinLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.checkinButtonText}>Check In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>History</Text>
        {attendance.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'📅'}</Text>
            <Text style={styles.emptyText}>No attendance records yet</Text>
          </View>
        ) : (
          attendance.map((record) => {
            const badge = getMethodBadge(record.verifiedMethod);
            return (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordDate}>
                  <Text style={styles.recordDay}>
                    {new Date(record.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={styles.recordDateText}>
                    {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.recordInfo}>
                  <View style={[styles.statusBadge, { backgroundColor: colors.green + '15' }]}>
                    <Text style={[styles.statusText, { color: colors.green }]}>Present</Text>
                  </View>
                  <View style={[styles.methodBadge, { backgroundColor: badge.color + '15' }]}>
                    <Text style={[styles.methodText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  checkinCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  checkinTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  checkinSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.md,
  },
  checkinForm: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  checkinInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: '#fff',
  },
  checkinButton: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  checkinButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordDate: {
    width: 60,
    alignItems: 'center',
  },
  recordDay: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  recordDateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  recordInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  methodBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
