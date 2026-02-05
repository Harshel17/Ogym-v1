import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../config/constants.dart';
import '../models/workout.dart';
import '../services/api_service.dart';

class TodayWorkoutCard extends StatefulWidget {
  final TodayWorkout? workout;
  final VoidCallback onRefresh;

  const TodayWorkoutCard({
    super.key,
    this.workout,
    required this.onRefresh,
  });

  @override
  State<TodayWorkoutCard> createState() => _TodayWorkoutCardState();
}

class _TodayWorkoutCardState extends State<TodayWorkoutCard> {
  bool _isExpanded = false;
  Set<int> _completedExercises = {};
  final ApiService _api = ApiService();

  @override
  void initState() {
    super.initState();
    _initCompletedExercises();
  }

  @override
  void didUpdateWidget(TodayWorkoutCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.workout != oldWidget.workout) {
      _initCompletedExercises();
    }
  }

  void _initCompletedExercises() {
    _completedExercises = {};
    if (widget.workout?.dayManuallyCompleted == true) {
      for (final item in widget.workout?.items ?? []) {
        _completedExercises.add(item.id);
      }
    } else {
      for (final item in widget.workout?.items ?? []) {
        if (item.completed == true) {
          _completedExercises.add(item.id);
        }
      }
    }
  }

  Future<void> _toggleExercise(int id) async {
    if (_completedExercises.contains(id)) return;

    setState(() => _completedExercises.add(id));

    try {
      await _api.post(
        ApiConstants.workoutComplete,
        body: {'workoutItemId': id},
      );
    } catch (e) {
      setState(() => _completedExercises.remove(id));
    }
  }

  Future<void> _markAllDone() async {
    final items = widget.workout?.items ?? [];
    
    setState(() {
      for (final item in items) {
        _completedExercises.add(item.id);
      }
    });

    try {
      final today = DateTime.now();
      final dateStr = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
      
      await _api.post('${ApiConstants.apiUrl}/member/workout/day/$dateStr/mark-done');
      widget.onRefresh();
    } catch (e) {
      // Revert on error
      _initCompletedExercises();
    }
  }

  void _showReorderDialog({bool forRestDay = false}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ReorderWorkoutSheet(
        cycleId: widget.workout?.cycleId,
        currentDayIndex: widget.workout?.currentDayIndex,
        forRestDay: forRestDay,
        onComplete: widget.onRefresh,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final workout = widget.workout;

    if (workout == null) {
      return _buildNoWorkout(isDark);
    }

    if (workout.isRestDay == true) {
      return _buildRestDay(isDark);
    }

    if (workout.items.isEmpty) {
      return _buildNoWorkout(isDark);
    }

    return _buildWorkoutCard(isDark);
  }

  Widget _buildNoWorkout(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(
            Icons.calendar_today,
            size: 48,
            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          ),
          const SizedBox(height: 16),
          const Text(
            'No Workout Scheduled',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Start a workout or wait for your trainer to assign one.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRestDay(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.nightlight_round,
            size: 48,
            color: AppColors.primary,
          ),
          const SizedBox(height: 16),
          const Text(
            'Rest Day',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Take it easy today. Recovery is part of the process!',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
          ),
          if (widget.workout?.cycleId != null) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => _showReorderDialog(forRestDay: true),
              icon: const Icon(Icons.fitness_center, size: 18),
              label: const Text('Workout Today'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildWorkoutCard(bool isDark) {
    final workout = widget.workout!;
    final items = workout.items;
    final completedCount = _completedExercises.length;
    final totalCount = items.length;
    final progress = totalCount > 0 ? completedCount / totalCount : 0.0;
    final isAllCompleted = completedCount == totalCount && totalCount > 0;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          // Header
          InkWell(
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.fitness_center,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Today's Workout",
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          workout.dayLabel ?? 'Workout',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ElevatedButton(
                    onPressed: isAllCompleted ? null : _markAllDone,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isAllCompleted ? AppColors.success.withOpacity(0.5) : AppColors.success,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    ),
                    child: Text(isAllCompleted ? 'Done!' : 'Done'),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    _isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ],
              ),
            ),
          ),

          // Progress bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Progress',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                    Text(
                      '$completedCount/$totalCount',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.success,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: isDark ? AppColors.surfaceDark : Colors.grey[300],
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.success),
                    minHeight: 8,
                  ),
                ),
              ],
            ),
          ),

          // Expanded content
          if (_isExpanded) ...[
            const SizedBox(height: 16),
            const Divider(height: 1),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final item = items[index];
                final isCompleted = _completedExercises.contains(item.id);
                
                return _ExerciseRow(
                  exercise: item,
                  isCompleted: isCompleted,
                  onToggle: () => _toggleExercise(item.id),
                );
              },
            ),
            if (workout.cycleId != null) ...[
              Padding(
                padding: const EdgeInsets.all(16),
                child: TextButton.icon(
                  onPressed: () => _showReorderDialog(forRestDay: false),
                  icon: const Icon(Icons.swap_horiz),
                  label: const Text('Do Another Workout'),
                ),
              ),
            ],
          ],

          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

class _ExerciseRow extends StatelessWidget {
  final WorkoutItem exercise;
  final bool isCompleted;
  final VoidCallback onToggle;

  const _ExerciseRow({
    required this.exercise,
    required this.isCompleted,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onToggle,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: isCompleted ? AppColors.success : Colors.transparent,
                border: Border.all(
                  color: isCompleted ? AppColors.success : AppColors.secondary,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(6),
              ),
              child: isCompleted
                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    exercise.name,
                    style: TextStyle(
                      fontWeight: FontWeight.w500,
                      decoration: isCompleted ? TextDecoration.lineThrough : null,
                      color: isCompleted
                          ? (isDark ? AppColors.textTertiaryDark : AppColors.textTertiaryLight)
                          : null,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${exercise.sets} sets${exercise.reps != null ? ' × ${exercise.reps} reps' : ''}${exercise.weight != null ? ' @ ${exercise.weight}' : ''}',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Reorder Workout Sheet
class ReorderWorkoutSheet extends StatefulWidget {
  final int? cycleId;
  final int? currentDayIndex;
  final bool forRestDay;
  final VoidCallback onComplete;

  const ReorderWorkoutSheet({
    super.key,
    this.cycleId,
    this.currentDayIndex,
    this.forRestDay = false,
    required this.onComplete,
  });

  @override
  State<ReorderWorkoutSheet> createState() => _ReorderWorkoutSheetState();
}

class _ReorderWorkoutSheetState extends State<ReorderWorkoutSheet> {
  final ApiService _api = ApiService();
  List<AvailableDay> _availableDays = [];
  int? _selectedDayIndex;
  String _action = 'swap';
  bool _isLoading = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchAvailableDays();
  }

  Future<void> _fetchAvailableDays() async {
    try {
      final url = widget.forRestDay
          ? '${ApiConstants.availableDays}?forRestDay=true'
          : ApiConstants.availableDays;
      
      final response = await _api.get(url);
      
      if (response != null) {
        final days = (response['days'] as List<dynamic>? ?? [])
            .map((e) => AvailableDay.fromJson(e as Map<String, dynamic>))
            .where((day) {
              if (day.dayIndex == widget.currentDayIndex) return false;
              if (!widget.forRestDay && day.isRestDay == true) return false;
              return true;
            })
            .toList();
        
        setState(() {
          _availableDays = days;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _confirm() async {
    if (_selectedDayIndex == null || widget.cycleId == null) return;

    setState(() => _isSubmitting = true);

    try {
      await _api.post(
        ApiConstants.workoutReorder,
        body: {
          'cycleId': widget.cycleId,
          'targetDayIndex': _selectedDayIndex,
          'action': _action,
          'isRestDayReorder': widget.forRestDay,
        },
      );
      
      if (mounted) {
        Navigator.pop(context);
        widget.onComplete();
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              
              // Header
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Icon(
                      widget.forRestDay ? Icons.fitness_center : Icons.swap_horiz,
                      size: 48,
                      color: AppColors.primary,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      widget.forRestDay ? 'Workout Today' : 'Do Another Workout',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.forRestDay
                          ? "Choose which workout you'd like to do today instead of resting."
                          : "Choose which workout day you'd like to do today instead.",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),

              // Content
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator())
                    : _availableDays.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.calendar_today,
                                  size: 48,
                                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                ),
                                const SizedBox(height: 12),
                                const Text('No other workouts available'),
                              ],
                            ),
                          )
                        : ListView(
                            controller: scrollController,
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            children: [
                              // Available Days
                              ..._availableDays.map((day) {
                                final isSelected = _selectedDayIndex == day.dayIndex;
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 8),
                                  child: InkWell(
                                    onTap: () => setState(() => _selectedDayIndex = day.dayIndex),
                                    borderRadius: BorderRadius.circular(12),
                                    child: Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: isSelected
                                            ? AppColors.primary.withOpacity(0.1)
                                            : (isDark ? AppColors.cardDark : AppColors.cardLight),
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: isSelected ? AppColors.primary : Colors.transparent,
                                          width: 2,
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  day.dayLabel ?? 'Day ${day.dayIndex + 1}',
                                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  '${day.exerciseCount} exercises',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          if (isSelected)
                                            const Icon(Icons.check_circle, color: AppColors.primary),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              }),

                              // Action Selection
                              if (_selectedDayIndex != null) ...[
                                const SizedBox(height: 16),
                                const Text(
                                  'Choose Action',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                
                                // Swap Option
                                _ActionOption(
                                  title: widget.forRestDay ? 'Swap Rest' : 'Swap',
                                  subtitle: widget.forRestDay
                                      ? "Rest moves to workout's slot"
                                      : 'Exchange positions',
                                  isSelected: _action == 'swap',
                                  onTap: () => setState(() => _action = 'swap'),
                                ),
                                const SizedBox(height: 8),
                                
                                // Push Option
                                _ActionOption(
                                  title: widget.forRestDay ? 'Push Rest' : 'Do First',
                                  subtitle: widget.forRestDay
                                      ? 'Rest moves later in schedule'
                                      : 'Shifts others forward',
                                  isSelected: _action == 'push',
                                  onTap: () => setState(() => _action = 'push'),
                                ),
                              ],
                              
                              const SizedBox(height: 100),
                            ],
                          ),
              ),

              // Bottom Buttons
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                  border: Border(
                    top: BorderSide(
                      color: isDark ? AppColors.cardDark : AppColors.cardLight,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _selectedDayIndex == null || _isSubmitting
                            ? null
                            : _confirm,
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Confirm'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ActionOption extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool isSelected;
  final VoidCallback onTap;

  const _ActionOption({
    required this.title,
    required this.subtitle,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withOpacity(0.1)
              : (isDark ? AppColors.cardDark : AppColors.cardLight),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}
