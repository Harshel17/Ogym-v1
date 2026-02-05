import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/workout.dart';
import '../../services/api_service.dart';

class MemberWorkoutsTab extends StatefulWidget {
  const MemberWorkoutsTab({super.key});

  @override
  State<MemberWorkoutsTab> createState() => _MemberWorkoutsTabState();
}

class _MemberWorkoutsTabState extends State<MemberWorkoutsTab> {
  final ApiService _api = ApiService();
  
  List<WorkoutCycle> _cycles = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchCycles();
  }

  Future<void> _fetchCycles() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get(ApiConstants.memberWorkouts);
      
      if (response != null) {
        final cyclesList = response is List ? response : (response['cycles'] ?? []);
        setState(() {
          _cycles = (cyclesList as List<dynamic>)
              .map((e) => WorkoutCycle.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Workouts'),
        actions: [
          IconButton(
            onPressed: _fetchCycles,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchCycles,
        child: _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: AppColors.error),
            const SizedBox(height: 16),
            Text(_error!),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchCycles,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_cycles.isEmpty) {
      return _buildEmptyState();
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _cycles.length,
      itemBuilder: (context, index) {
        return _CycleCard(
          cycle: _cycles[index],
          onTap: () => _showCycleDetails(_cycles[index]),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.fitness_center,
              size: 80,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
            const SizedBox(height: 24),
            const Text(
              'No Workout Cycles',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Your trainer will assign workout cycles to you, or you can import your own workouts.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showCycleDetails(WorkoutCycle cycle) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CycleDetailScreen(cycle: cycle),
      ),
    );
  }
}

class _CycleCard extends StatelessWidget {
  final WorkoutCycle cycle;
  final VoidCallback onTap;

  const _CycleCard({
    required this.cycle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final progress = cycle.totalDays > 0 ? cycle.currentDay / cycle.totalDays : 0.0;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.fitness_center,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          cycle.name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${cycle.totalDays} days • Day ${cycle.currentDay} of ${cycle.totalDays}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (cycle.isActive)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text(
                        'Active',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.success,
                        ),
                      ),
                    ),
                  const SizedBox(width: 8),
                  const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: isDark ? AppColors.surfaceDark : Colors.grey[300],
                  valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                  minHeight: 6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CycleDetailScreen extends StatelessWidget {
  final WorkoutCycle cycle;

  const CycleDetailScreen({super.key, required this.cycle});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Text(cycle.name),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: cycle.days.length,
        itemBuilder: (context, index) {
          final day = cycle.days[index];
          final isCurrentDay = day.dayIndex == cycle.currentDay - 1;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : AppColors.cardLight,
              borderRadius: BorderRadius.circular(12),
              border: isCurrentDay
                  ? Border.all(color: AppColors.primary, width: 2)
                  : null,
            ),
            child: ExpansionTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: day.isRestDay
                      ? AppColors.secondary.withOpacity(0.1)
                      : AppColors.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: day.isRestDay
                      ? const Icon(Icons.nightlight_round, color: AppColors.secondary)
                      : Text(
                          '${day.dayIndex + 1}',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                ),
              ),
              title: Text(
                day.label ?? 'Day ${day.dayIndex + 1}',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                day.isRestDay
                    ? 'Rest Day'
                    : '${day.exercises.length} exercises',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                ),
              ),
              trailing: isCurrentDay
                  ? Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Today',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    )
                  : null,
              children: day.isRestDay
                  ? [
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('Take a rest day to recover!'),
                      ),
                    ]
                  : day.exercises.map((exercise) {
                      return ListTile(
                        leading: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: AppColors.success.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.fitness_center,
                            size: 16,
                            color: AppColors.success,
                          ),
                        ),
                        title: Text(exercise.name),
                        subtitle: Text(
                          '${exercise.sets} sets${exercise.reps != null ? ' × ${exercise.reps}' : ''}${exercise.weight != null ? ' @ ${exercise.weight}' : ''}',
                        ),
                      );
                    }).toList(),
            ),
          );
        },
      ),
    );
  }
}
