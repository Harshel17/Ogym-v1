class WorkoutSummary {
  final int streak;
  final int totalWorkouts;
  final int completedThisWeek;
  final int targetPerWeek;
  final List<DayStatus> weekProgress;
  final Map<String, dynamic>? monthlyData;

  WorkoutSummary({
    required this.streak,
    required this.totalWorkouts,
    required this.completedThisWeek,
    required this.targetPerWeek,
    required this.weekProgress,
    this.monthlyData,
  });

  factory WorkoutSummary.fromJson(Map<String, dynamic> json) {
    return WorkoutSummary(
      streak: json['streak'] as int? ?? 0,
      totalWorkouts: json['totalWorkouts'] as int? ?? json['total_workouts'] as int? ?? 0,
      completedThisWeek: json['completedThisWeek'] as int? ?? json['completed_this_week'] as int? ?? 0,
      targetPerWeek: json['targetPerWeek'] as int? ?? json['target_per_week'] as int? ?? 5,
      weekProgress: (json['weekProgress'] as List<dynamic>? ?? json['week_progress'] as List<dynamic>? ?? [])
          .map((e) => DayStatus.fromJson(e as Map<String, dynamic>))
          .toList(),
      monthlyData: json['monthlyData'] as Map<String, dynamic>? ?? json['monthly_data'] as Map<String, dynamic>?,
    );
  }
}

class DayStatus {
  final String day;
  final String status; // 'completed', 'missed', 'rest', 'upcoming'
  final DateTime? date;

  DayStatus({
    required this.day,
    required this.status,
    this.date,
  });

  factory DayStatus.fromJson(Map<String, dynamic> json) {
    return DayStatus(
      day: json['day'] as String? ?? '',
      status: json['status'] as String? ?? 'upcoming',
      date: json['date'] != null ? DateTime.parse(json['date'] as String) : null,
    );
  }
}

class TodayWorkout {
  final int? id;
  final int? cycleId;
  final String? cycleName;
  final int? currentDayIndex;
  final String? dayLabel;
  final bool? isRestDay;
  final bool? dayManuallyCompleted;
  final List<WorkoutItem> items;
  final String? notes;

  TodayWorkout({
    this.id,
    this.cycleId,
    this.cycleName,
    this.currentDayIndex,
    this.dayLabel,
    this.isRestDay,
    this.dayManuallyCompleted,
    required this.items,
    this.notes,
  });

  factory TodayWorkout.fromJson(Map<String, dynamic> json) {
    return TodayWorkout(
      id: json['id'] as int?,
      cycleId: json['cycleId'] as int? ?? json['cycle_id'] as int?,
      cycleName: json['cycleName'] as String? ?? json['cycle_name'] as String?,
      currentDayIndex: json['currentDayIndex'] as int? ?? json['current_day_index'] as int?,
      dayLabel: json['dayLabel'] as String? ?? json['day_label'] as String?,
      isRestDay: json['isRestDay'] as bool? ?? json['is_rest_day'] as bool?,
      dayManuallyCompleted: json['dayManuallyCompleted'] as bool? ?? json['day_manually_completed'] as bool?,
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => WorkoutItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      notes: json['notes'] as String?,
    );
  }
}

class WorkoutItem {
  final int id;
  final String name;
  final int sets;
  final String? reps;
  final String? weight;
  final String? notes;
  final bool? completed;
  final int? order;

  WorkoutItem({
    required this.id,
    required this.name,
    required this.sets,
    this.reps,
    this.weight,
    this.notes,
    this.completed,
    this.order,
  });

  factory WorkoutItem.fromJson(Map<String, dynamic> json) {
    return WorkoutItem(
      id: json['id'] as int,
      name: json['name'] as String? ?? json['exercise_name'] as String? ?? 'Exercise',
      sets: json['sets'] as int? ?? 3,
      reps: json['reps']?.toString(),
      weight: json['weight']?.toString(),
      notes: json['notes'] as String?,
      completed: json['completed'] as bool?,
      order: json['order'] as int?,
    );
  }
}

class WorkoutCycle {
  final int id;
  final String name;
  final String? description;
  final int totalDays;
  final int currentDay;
  final bool isActive;
  final List<CycleDay> days;

  WorkoutCycle({
    required this.id,
    required this.name,
    this.description,
    required this.totalDays,
    required this.currentDay,
    required this.isActive,
    required this.days,
  });

  factory WorkoutCycle.fromJson(Map<String, dynamic> json) {
    return WorkoutCycle(
      id: json['id'] as int,
      name: json['name'] as String? ?? 'Workout Cycle',
      description: json['description'] as String?,
      totalDays: json['totalDays'] as int? ?? json['total_days'] as int? ?? 7,
      currentDay: json['currentDay'] as int? ?? json['current_day'] as int? ?? 1,
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? true,
      days: (json['days'] as List<dynamic>? ?? [])
          .map((e) => CycleDay.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class CycleDay {
  final int dayIndex;
  final String? label;
  final bool isRestDay;
  final List<WorkoutItem> exercises;

  CycleDay({
    required this.dayIndex,
    this.label,
    required this.isRestDay,
    required this.exercises,
  });

  factory CycleDay.fromJson(Map<String, dynamic> json) {
    return CycleDay(
      dayIndex: json['dayIndex'] as int? ?? json['day_index'] as int? ?? 0,
      label: json['label'] as String? ?? json['dayLabel'] as String?,
      isRestDay: json['isRestDay'] as bool? ?? json['is_rest_day'] as bool? ?? false,
      exercises: (json['exercises'] as List<dynamic>? ?? json['items'] as List<dynamic>? ?? [])
          .map((e) => WorkoutItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class AvailableDay {
  final int dayIndex;
  final String? dayLabel;
  final int exerciseCount;
  final bool? isRestDay;

  AvailableDay({
    required this.dayIndex,
    this.dayLabel,
    required this.exerciseCount,
    this.isRestDay,
  });

  factory AvailableDay.fromJson(Map<String, dynamic> json) {
    return AvailableDay(
      dayIndex: json['dayIndex'] as int? ?? json['day_index'] as int? ?? 0,
      dayLabel: json['dayLabel'] as String? ?? json['day_label'] as String?,
      exerciseCount: json['exerciseCount'] as int? ?? json['exercise_count'] as int? ?? 0,
      isRestDay: json['isRestDay'] as bool? ?? json['is_rest_day'] as bool?,
    );
  }
}
