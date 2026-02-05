import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/workout.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/today_workout_card.dart';
import '../../widgets/stats_card.dart';
import '../../widgets/week_progress.dart';
import '../../widgets/workout_calendar.dart';

class MemberHomeTab extends StatefulWidget {
  const MemberHomeTab({super.key});

  @override
  State<MemberHomeTab> createState() => _MemberHomeTabState();
}

class _MemberHomeTabState extends State<MemberHomeTab> {
  final ApiService _api = ApiService();
  
  WorkoutSummary? _workoutSummary;
  TodayWorkout? _todayWorkout;
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
        _api.get(ApiConstants.workoutSummary),
        _api.get(ApiConstants.todayWorkout),
      ]);

      setState(() {
        _workoutSummary = results[0] != null 
            ? WorkoutSummary.fromJson(results[0] as Map<String, dynamic>)
            : null;
        _todayWorkout = results[1] != null 
            ? TodayWorkout.fromJson(results[1] as Map<String, dynamic>)
            : null;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchData,
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? _buildError()
                  : _buildContent(user?.displayName ?? 'Member', isDark),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: AppColors.error),
          const SizedBox(height: 16),
          Text(_error ?? 'Something went wrong'),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _fetchData,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(String userName, bool isDark) {
    return CustomScrollView(
      slivers: [
        // Header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _getGreeting(),
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  userName,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),

        // Today's Workout Card
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TodayWorkoutCard(
              workout: _todayWorkout,
              onRefresh: _fetchData,
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 20)),

        // Stats Row (Streak + Calories)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: StatsCard(
                    icon: Icons.local_fire_department,
                    iconColor: AppColors.orange,
                    value: '${_workoutSummary?.streak ?? 0}',
                    label: 'Day Streak',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatsCard(
                    icon: Icons.restaurant,
                    iconColor: AppColors.teal,
                    value: '0',
                    unit: 'kcal',
                    label: "Today's Calories",
                  ),
                ),
              ],
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 20)),

        // This Week Progress
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: WeekProgress(summary: _workoutSummary),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 20)),

        // Workout Calendar
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: WorkoutCalendar(summary: _workoutSummary),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 20)),

        // Today's Nutrition Summary
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: _buildNutritionSummary(isDark),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }

  Widget _buildNutritionSummary(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Today's Nutrition",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _NutritionStat(
                  value: '0',
                  label: 'Calories',
                  color: AppColors.primary,
                ),
              ),
              Expanded(
                child: _NutritionStat(
                  value: '0g',
                  label: 'Protein',
                  color: AppColors.success,
                ),
              ),
              Expanded(
                child: _NutritionStat(
                  value: '0g',
                  label: 'Carbs',
                  color: AppColors.warning,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NutritionStat extends StatelessWidget {
  final String value;
  final String label;
  final Color color;

  const _NutritionStat({
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          ),
        ),
      ],
    );
  }
}
