import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/nutrition.dart';
import '../../services/api_service.dart';

class MemberNutritionTab extends StatefulWidget {
  const MemberNutritionTab({super.key});

  @override
  State<MemberNutritionTab> createState() => _MemberNutritionTabState();
}

class _MemberNutritionTabState extends State<MemberNutritionTab> {
  final ApiService _api = ApiService();
  
  NutritionSummary? _nutrition;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchNutrition();
  }

  Future<void> _fetchNutrition() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final today = DateTime.now().toIso8601String().split('T')[0];
      final response = await _api.get('${ApiConstants.nutritionSummary}?date=$today');
      
      if (response != null && response is Map<String, dynamic>) {
        setState(() {
          _nutrition = NutritionSummary.fromJson(response);
          _isLoading = false;
        });
      } else {
        // No data or invalid response - show empty state
        setState(() {
          _nutrition = NutritionSummary(
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            targetCalories: 2000,
            targetProtein: 150,
            meals: [],
          );
          _isLoading = false;
        });
      }
    } catch (e) {
      // On error, show empty nutrition state instead of error
      setState(() {
        _nutrition = NutritionSummary(
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
          targetCalories: 2000,
          targetProtein: 150,
          meals: [],
        );
        _isLoading = false;
      });
    }
  }

  void _showAddMealDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => AddMealSheet(
        onMealAdded: _fetchNutrition,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nutrition'),
        actions: [
          IconButton(
            onPressed: () {
              // Navigate to Find My Food
            },
            icon: const Icon(Icons.restaurant_menu),
            tooltip: 'Find My Food',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchNutrition,
        child: _buildContent(),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddMealDialog,
        icon: const Icon(Icons.add),
        label: const Text('Add Food'),
        backgroundColor: AppColors.primary,
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
              onPressed: _fetchNutrition,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final nutrition = _nutrition!;

    return CustomScrollView(
      slivers: [
        // Calorie Summary Card
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: _CalorieSummaryCard(nutrition: nutrition),
          ),
        ),

        // Macro Cards
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: _MacroCard(
                    label: 'Protein',
                    value: nutrition.totalProtein,
                    target: nutrition.targetProtein,
                    unit: 'g',
                    color: AppColors.success,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _MacroCard(
                    label: 'Carbs',
                    value: nutrition.totalCarbs,
                    target: 250,
                    unit: 'g',
                    color: AppColors.warning,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _MacroCard(
                    label: 'Fat',
                    value: nutrition.totalFat,
                    target: 70,
                    unit: 'g',
                    color: AppColors.error,
                  ),
                ),
              ],
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 24)),

        // Meals Header
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              "Today's Meals",
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
              ),
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 12)),

        // Meals List
        if (nutrition.meals.isEmpty)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                children: [
                  Icon(
                    Icons.restaurant,
                    size: 64,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                  const SizedBox(height: 16),
                  const Text('No meals logged today'),
                  const SizedBox(height: 8),
                  Text(
                    'Tap + Add Food to log your first meal',
                    style: TextStyle(
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final meal = nutrition.meals[index];
                return _MealCard(meal: meal);
              },
              childCount: nutrition.meals.length,
            ),
          ),

        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }
}

class _CalorieSummaryCard extends StatelessWidget {
  final NutritionSummary nutrition;

  const _CalorieSummaryCard({required this.nutrition});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final remaining = nutrition.targetCalories - nutrition.totalCalories;
    final progress = nutrition.calorieProgress.clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${nutrition.totalCalories}',
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'of ${nutrition.targetCalories} kcal',
                    style: TextStyle(
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                  ),
                ],
              ),
              Container(
                width: 100,
                height: 100,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 100,
                      height: 100,
                      child: CircularProgressIndicator(
                        value: progress,
                        strokeWidth: 10,
                        backgroundColor: isDark ? AppColors.surfaceDark : Colors.grey[300],
                        valueColor: AlwaysStoppedAnimation<Color>(
                          remaining >= 0 ? AppColors.success : AppColors.error,
                        ),
                      ),
                    ),
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${remaining.abs()}',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: remaining >= 0 ? AppColors.success : AppColors.error,
                          ),
                        ),
                        Text(
                          remaining >= 0 ? 'left' : 'over',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MacroCard extends StatelessWidget {
  final String label;
  final int value;
  final int target;
  final String unit;
  final Color color;

  const _MacroCard({
    required this.label,
    required this.value,
    required this.target,
    required this.unit,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final progress = target > 0 ? (value / target).clamp(0.0, 1.0) : 0.0;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$value$unit',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: isDark ? AppColors.surfaceDark : Colors.grey[300],
              valueColor: AlwaysStoppedAnimation<Color>(color),
              minHeight: 4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '/ $target$unit',
            style: TextStyle(
              fontSize: 10,
              color: isDark ? AppColors.textTertiaryDark : AppColors.textTertiaryLight,
            ),
          ),
        ],
      ),
    );
  }
}

class _MealCard extends StatelessWidget {
  final MealEntry meal;

  const _MealCard({required this.meal});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                _getMealIcon(meal.mealType),
                style: const TextStyle(fontSize: 24),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  meal.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  meal.mealTypeDisplay,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${meal.calories} kcal',
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
              if (meal.protein != null)
                Text(
                  '${meal.protein}g protein',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _getMealIcon(String mealType) {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return '🌅';
      case 'lunch':
        return '☀️';
      case 'dinner':
        return '🌙';
      case 'snack':
        return '🍎';
      case 'protein':
        return '💪';
      case 'extra':
        return '➕';
      default:
        return '🍽️';
    }
  }
}

class AddMealSheet extends StatefulWidget {
  final VoidCallback onMealAdded;

  const AddMealSheet({super.key, required this.onMealAdded});

  @override
  State<AddMealSheet> createState() => _AddMealSheetState();
}

class _AddMealSheetState extends State<AddMealSheet> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _caloriesController = TextEditingController();
  final _proteinController = TextEditingController();
  
  String _selectedMealType = 'snack';
  bool _isSubmitting = false;
  final ApiService _api = ApiService();

  final List<Map<String, dynamic>> _mealTypes = [
    {'value': 'breakfast', 'label': 'Breakfast', 'icon': '🌅'},
    {'value': 'lunch', 'label': 'Lunch', 'icon': '☀️'},
    {'value': 'dinner', 'label': 'Dinner', 'icon': '🌙'},
    {'value': 'snack', 'label': 'Snack', 'icon': '🍎'},
    {'value': 'protein', 'label': 'Protein', 'icon': '💪'},
    {'value': 'extra', 'label': 'Extra Meal', 'icon': '➕'},
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _caloriesController.dispose();
    _proteinController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      await _api.post(
        ApiConstants.nutritionLogs,
        body: {
          'name': _nameController.text.trim(),
          'mealType': _selectedMealType,
          'calories': int.parse(_caloriesController.text),
          'protein': _proteinController.text.isNotEmpty
              ? int.parse(_proteinController.text)
              : null,
        },
      );

      if (mounted) {
        Navigator.pop(context);
        widget.onMealAdded();
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
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[400],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              
              const Text(
                'Add Food',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 20),

              // Meal Type Selection
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _mealTypes.map((type) {
                  final isSelected = _selectedMealType == type['value'];
                  return GestureDetector(
                    onTap: () => setState(() => _selectedMealType = type['value']),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary.withOpacity(0.1)
                            : (isDark ? AppColors.cardDark : AppColors.cardLight),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? AppColors.primary : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(type['icon'], style: const TextStyle(fontSize: 16)),
                          const SizedBox(width: 6),
                          Text(
                            type['label'],
                            style: TextStyle(
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                              color: isSelected ? AppColors.primary : null,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Name Field
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Food Name',
                  hintText: 'e.g., Chicken Salad',
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter food name';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Calories Field
              TextFormField(
                controller: _caloriesController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Calories',
                  hintText: 'e.g., 350',
                  suffixText: 'kcal',
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter calories';
                  }
                  if (int.tryParse(value) == null) {
                    return 'Please enter a valid number';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Protein Field
              TextFormField(
                controller: _proteinController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Protein (optional)',
                  hintText: 'e.g., 25',
                  suffixText: 'g',
                ),
              ),
              const SizedBox(height: 24),

              // Submit Button
              ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Add Food'),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }
}
