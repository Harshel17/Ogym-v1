import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { memberApi, TodayWorkout } from '../../api/member';
import LoadingScreen from '../../components/LoadingScreen';
import { colors, spacing, borderRadius } from '../../utils/colors';

export default function MyWorkoutScreen() {
  const [todayWorkout, setTodayWorkout] = useState<TodayWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await memberApi.getTodayWorkout();
      setTodayWorkout(data);
    } catch (error) {
      console.error('Failed to fetch workout:', error);
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

  const handleComplete = async (item: any) => {
    setCompletingId(item.id);
    try {
      await memberApi.completeExercise({
        workoutItemId: item.id,
        actualSets: item.sets,
        actualReps: item.reps,
        actualWeight: item.weight,
      });
      Alert.alert('Success', 'Exercise completed!');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to complete exercise');
    } finally {
      setCompletingId(null);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading workout..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <Text style={styles.title}>My Workout</Text>
      <Text style={styles.subtitle}>Your personalized training program</Text>

      {todayWorkout?.message ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{todayWorkout.message}</Text>
          <Text style={styles.emptySubtitle}>Contact your trainer to get started</Text>
        </View>
      ) : todayWorkout?.items && todayWorkout.items.length > 0 ? (
        <>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>
              Today - {todayWorkout.dayLabel || `Day ${todayWorkout.dayIndex + 1}`}
            </Text>
            <Text style={styles.cycleName}>{todayWorkout.cycleName}</Text>
          </View>

          {todayWorkout.items.map((item) => (
            <View key={item.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.muscleTag}>
                  <Text style={styles.muscleText}>{item.muscleType}</Text>
                </View>
                {item.completed ? (
                  <View style={styles.completedTag}>
                    <Text style={styles.completedTagText}>Completed</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.exerciseName}>{item.exerciseName}</Text>
              <View style={styles.exerciseStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.sets}</Text>
                  <Text style={styles.statLabel}>Sets</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{item.reps}</Text>
                  <Text style={styles.statLabel}>Reps</Text>
                </View>
                {item.weight ? (
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{item.weight}</Text>
                    <Text style={styles.statLabel}>Weight</Text>
                  </View>
                ) : null}
              </View>
              {!item.completed ? (
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => handleComplete(item)}
                  disabled={completingId === item.id}
                >
                  {completingId === item.id ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.completeButtonText}>Mark Complete</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Workout Today</Text>
          <Text style={styles.emptySubtitle}>Rest day or no cycle assigned</Text>
        </View>
      )}
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
  dayHeader: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  cycleName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  muscleTag: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  muscleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  completedTag: {
    backgroundColor: colors.green + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  completedTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.green,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  exerciseStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
