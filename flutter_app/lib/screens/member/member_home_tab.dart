import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/stats_card.dart';

class MemberHomeTab extends StatefulWidget {
  const MemberHomeTab({super.key});

  @override
  State<MemberHomeTab> createState() => _MemberHomeTabState();
}

class _MemberHomeTabState extends State<MemberHomeTab> {
  final ApiService _api = ApiService();
  
  Map<String, dynamic>? _todayData;
  Map<String, dynamic>? _nutritionData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    if (!mounted) return;
    
    setState(() {
      _isLoading = true;
      _error = null;
    });

    // Fetch today's workout data
    Map<String, dynamic>? todayResult;
    try {
      final result = await _api.get(ApiConstants.todayWorkout);
      todayResult = result is Map<String, dynamic> ? result : null;
    } catch (_) {
      todayResult = null;
    }
    
    // Fetch nutrition summary for today
    Map<String, dynamic>? nutritionResult;
    try {
      final result = await _api.get('${ApiConstants.nutritionSummary}?date=${DateTime.now().toIso8601String().split('T')[0]}');
      nutritionResult = result is Map<String, dynamic> ? result : null;
    } catch (_) {
      nutritionResult = null;
    }

    if (!mounted) return;
    
    setState(() {
      _todayData = todayResult;
      _nutritionData = nutritionResult;
      _isLoading = false;
      _error = null; // Never show error, just show empty state
    });
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
    final items = _todayData?['items'] as List<dynamic>? ?? [];
    final cycleName = _todayData?['cycleName'] as String?;
    final dayLabel = _todayData?['dayLabel'] as String?;
    final isRestDay = _todayData?['isRestDay'] as bool? ?? false;
    
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
            child: _buildTodayWorkoutCard(isDark, items, cycleName, dayLabel, isRestDay),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 20)),

        // Stats Row
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: StatsCard(
                    icon: Icons.fitness_center,
                    iconColor: AppColors.primary,
                    value: '${items.length}',
                    label: 'Exercises Today',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: StatsCard(
                    icon: Icons.restaurant,
                    iconColor: AppColors.teal,
                    value: '${(_nutritionData?['summary']?['totalCalories'] ?? _nutritionData?['totalCalories']) ?? 0}',
                    unit: 'kcal',
                    label: "Today's Calories",
                  ),
                ),
              ],
            ),
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

  Widget _buildTodayWorkoutCard(bool isDark, List<dynamic> items, String? cycleName, String? dayLabel, bool isRestDay) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primary.withOpacity(0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.fitness_center, color: Colors.white, size: 24),
              const SizedBox(width: 8),
              Text(
                dayLabel ?? "Today's Workout",
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (cycleName != null) ...[
            const SizedBox(height: 4),
            Text(
              cycleName,
              style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 14),
            ),
          ],
          const SizedBox(height: 16),
          if (isRestDay)
            const Text(
              'Rest Day - Take it easy!',
              style: TextStyle(color: Colors.white, fontSize: 16),
            )
          else if (items.isEmpty)
            const Text(
              'No workouts scheduled',
              style: TextStyle(color: Colors.white, fontSize: 16),
            )
          else
            Text(
              '${items.length} exercises to complete',
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
        ],
      ),
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
