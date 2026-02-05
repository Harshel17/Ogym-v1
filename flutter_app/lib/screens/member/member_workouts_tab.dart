import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../services/api_service.dart';

class MemberWorkoutsTab extends StatefulWidget {
  const MemberWorkoutsTab({super.key});

  @override
  State<MemberWorkoutsTab> createState() => _MemberWorkoutsTabState();
}

class _MemberWorkoutsTabState extends State<MemberWorkoutsTab> {
  final ApiService _api = ApiService();
  
  Map<String, dynamic>? _todayWorkout;
  Map<String, dynamic>? _activeCycle;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        _api.get(ApiConstants.todayWorkout),
        _api.get(ApiConstants.memberWorkouts),
      ]);

      setState(() {
        _todayWorkout = results[0] is Map<String, dynamic> ? results[0] as Map<String, dynamic> : null;
        _activeCycle = results[1] is Map<String, dynamic> ? results[1] as Map<String, dynamic> : null;
        _isLoading = false;
      });
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
            onPressed: _fetchData,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
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
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(_error!, textAlign: TextAlign.center),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchData,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_activeCycle == null && _todayWorkout == null) {
      return _buildEmptyState();
    }

    return _buildWorkoutContent();
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
              'No Active Workouts',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Your trainer will assign workout cycles to you, or you can create your own in Personal Mode.',
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

  Widget _buildWorkoutContent() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final items = _todayWorkout?['items'] as List<dynamic>? ?? [];
    final cycleName = _todayWorkout?['cycleName'] as String? ?? _activeCycle?['name'] as String?;
    final dayLabel = _todayWorkout?['dayLabel'] as String?;
    final isRestDay = _todayWorkout?['isRestDay'] as bool? ?? false;
    
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Current Cycle Header
        if (cycleName != null)
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primary.withOpacity(0.8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.fitness_center, color: Colors.white, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        cycleName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                if (dayLabel != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Today: $dayLabel',
                    style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 14),
                  ),
                ],
              ],
            ),
          ),
        
        const SizedBox(height: 20),
        
        // Today's Exercises Section
        Text(
          isRestDay ? 'Rest Day' : "Today's Exercises",
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 12),
        
        if (isRestDay)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : AppColors.cardLight,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.nightlight_round,
                  size: 48,
                  color: AppColors.secondary,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Take it easy today!',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 8),
                Text(
                  'Rest days are important for muscle recovery and growth.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          )
        else if (items.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : AppColors.cardLight,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.check_circle,
                  size: 48,
                  color: AppColors.success,
                ),
                const SizedBox(height: 16),
                const Text(
                  'No exercises scheduled today',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          )
        else
          ...items.map((item) {
            final exerciseName = item['exerciseName'] as String? ?? item['name'] as String? ?? 'Exercise';
            final sets = item['sets'] ?? 0;
            final reps = item['reps'];
            final weight = item['weight'];
            final isCompleted = item['isCompleted'] as bool? ?? false;
            
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.cardDark : AppColors.cardLight,
                borderRadius: BorderRadius.circular(12),
                border: isCompleted ? Border.all(color: AppColors.success.withOpacity(0.5)) : null,
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                leading: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: isCompleted 
                        ? AppColors.success.withOpacity(0.1)
                        : AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    isCompleted ? Icons.check : Icons.fitness_center,
                    color: isCompleted ? AppColors.success : AppColors.primary,
                  ),
                ),
                title: Text(
                  exerciseName,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    decoration: isCompleted ? TextDecoration.lineThrough : null,
                  ),
                ),
                subtitle: Text(
                  '$sets sets${reps != null ? ' × $reps reps' : ''}${weight != null ? ' @ $weight' : ''}',
                  style: TextStyle(
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
                trailing: isCompleted
                    ? const Icon(Icons.check_circle, color: AppColors.success)
                    : null,
              ),
            );
          }),
        
        const SizedBox(height: 80),
      ],
    );
  }
}
