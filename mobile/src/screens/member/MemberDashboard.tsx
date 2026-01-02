import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { memberApi, WorkoutSummary, TodayWorkout } from '../../api/member';
import StatCard from '../../components/StatCard';
import LoadingScreen from '../../components/LoadingScreen';
import { colors, spacing, borderRadius } from '../../utils/colors';

export default function MemberDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, workoutData] = await Promise.all([
        memberApi.getWorkoutSummary(),
        memberApi.getTodayWorkout(),
      ]);
      setSummary(summaryData);
      setTodayWorkout(workoutData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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

  if (isLoading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.gymName}>{user?.gym?.name}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          value={summary?.streak || 0}
          label="Day Streak"
          color={colors.orange}
        />
        <StatCard
          value={summary?.totalWorkouts || 0}
          label="Total Sessions"
          color={colors.blue}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          value={summary?.last7DaysCount || 0}
          label="Last 7 Days"
          color={colors.green}
        />
        <StatCard
          value={summary?.thisMonthCount || 0}
          label="This Month"
          color={colors.purple}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's Workout</Text>
        <View style={styles.card}>
          {todayWorkout?.message ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{todayWorkout.message}</Text>
            </View>
          ) : todayWorkout?.items && todayWorkout.items.length > 0 ? (
            <>
              <Text style={styles.cardSubtitle}>
                {todayWorkout.cycleName} - {todayWorkout.dayLabel || `Day ${todayWorkout.dayIndex + 1}`}
              </Text>
              {todayWorkout.items.slice(0, 3).map((item) => (
                <View key={item.id} style={styles.exerciseItem}>
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{item.exerciseName}</Text>
                    <Text style={styles.exerciseDetails}>
                      {item.sets}x{item.reps} {item.weight ? `@ ${item.weight}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, item.completed ? styles.completedBadge : null]}>
                    <Text style={[styles.statusText, item.completed ? styles.completedText : null]}>
                      {item.completed ? 'Done' : 'Pending'}
                    </Text>
                  </View>
                </View>
              ))}
              {todayWorkout.items.length > 3 ? (
                <Text style={styles.moreText}>+{todayWorkout.items.length - 3} more exercises</Text>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No workout scheduled for today</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Workout Calendar</Text>
        <View style={styles.card}>
          <View style={styles.calendarPreview}>
            {summary?.calendarDays?.slice(0, 7).map((day, index) => (
              <View key={index} style={styles.calendarDay}>
                <View style={[styles.calendarDot, { backgroundColor: colors.green }]} />
                <Text style={styles.calendarDayText}>
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
              </View>
            ))}
          </View>
          {(!summary?.calendarDays || summary.calendarDays.length === 0) ? (
            <Text style={styles.emptyText}>Complete workouts to see your calendar</Text>
          ) : null}
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  gymName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  exerciseDetails: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
  },
  completedBadge: {
    backgroundColor: colors.green + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  completedText: {
    color: colors.green,
  },
  moreText: {
    fontSize: 14,
    color: colors.primary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  calendarPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  calendarDay: {
    alignItems: 'center',
  },
  calendarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  calendarDayText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
