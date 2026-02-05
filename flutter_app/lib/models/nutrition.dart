class NutritionSummary {
  final int totalCalories;
  final int totalProtein;
  final int totalCarbs;
  final int totalFat;
  final int targetCalories;
  final int targetProtein;
  final List<MealEntry> meals;

  NutritionSummary({
    required this.totalCalories,
    required this.totalProtein,
    required this.totalCarbs,
    required this.totalFat,
    required this.targetCalories,
    required this.targetProtein,
    required this.meals,
  });

  factory NutritionSummary.fromJson(Map<String, dynamic> json) {
    return NutritionSummary(
      totalCalories: json['totalCalories'] as int? ?? json['total_calories'] as int? ?? 0,
      totalProtein: json['totalProtein'] as int? ?? json['total_protein'] as int? ?? 0,
      totalCarbs: json['totalCarbs'] as int? ?? json['total_carbs'] as int? ?? 0,
      totalFat: json['totalFat'] as int? ?? json['total_fat'] as int? ?? 0,
      targetCalories: json['targetCalories'] as int? ?? json['target_calories'] as int? ?? 2000,
      targetProtein: json['targetProtein'] as int? ?? json['target_protein'] as int? ?? 150,
      meals: (json['meals'] as List<dynamic>? ?? [])
          .map((e) => MealEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  double get calorieProgress => targetCalories > 0 ? totalCalories / targetCalories : 0;
  double get proteinProgress => targetProtein > 0 ? totalProtein / targetProtein : 0;
}

class MealEntry {
  final int id;
  final String name;
  final String mealType; // breakfast, lunch, dinner, snack, protein, extra
  final int calories;
  final int? protein;
  final int? carbs;
  final int? fat;
  final String? notes;
  final DateTime loggedAt;

  MealEntry({
    required this.id,
    required this.name,
    required this.mealType,
    required this.calories,
    this.protein,
    this.carbs,
    this.fat,
    this.notes,
    required this.loggedAt,
  });

  factory MealEntry.fromJson(Map<String, dynamic> json) {
    return MealEntry(
      id: json['id'] as int,
      name: json['name'] as String? ?? 'Meal',
      mealType: json['mealType'] as String? ?? json['meal_type'] as String? ?? 'snack',
      calories: json['calories'] as int? ?? 0,
      protein: json['protein'] as int?,
      carbs: json['carbs'] as int?,
      fat: json['fat'] as int?,
      notes: json['notes'] as String?,
      loggedAt: json['loggedAt'] != null 
          ? DateTime.parse(json['loggedAt'] as String) 
          : json['logged_at'] != null 
              ? DateTime.parse(json['logged_at'] as String)
              : DateTime.now(),
    );
  }

  String get mealTypeDisplay {
    switch (mealType.toLowerCase()) {
      case 'breakfast':
        return 'Breakfast';
      case 'lunch':
        return 'Lunch';
      case 'dinner':
        return 'Dinner';
      case 'snack':
        return 'Snack';
      case 'protein':
        return 'Protein';
      case 'extra':
        return 'Extra Meal';
      default:
        return mealType;
    }
  }

  String get mealTypeIcon {
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

class CalorieAnalytics {
  final List<DailyCalories> weeklyData;
  final List<DailyCalories> monthlyData;
  final double weeklyAverage;
  final double monthlyAverage;
  final double adherenceRate;

  CalorieAnalytics({
    required this.weeklyData,
    required this.monthlyData,
    required this.weeklyAverage,
    required this.monthlyAverage,
    required this.adherenceRate,
  });

  factory CalorieAnalytics.fromJson(Map<String, dynamic> json) {
    return CalorieAnalytics(
      weeklyData: (json['weeklyData'] as List<dynamic>? ?? json['weekly_data'] as List<dynamic>? ?? [])
          .map((e) => DailyCalories.fromJson(e as Map<String, dynamic>))
          .toList(),
      monthlyData: (json['monthlyData'] as List<dynamic>? ?? json['monthly_data'] as List<dynamic>? ?? [])
          .map((e) => DailyCalories.fromJson(e as Map<String, dynamic>))
          .toList(),
      weeklyAverage: (json['weeklyAverage'] as num?)?.toDouble() ?? 0,
      monthlyAverage: (json['monthlyAverage'] as num?)?.toDouble() ?? 0,
      adherenceRate: (json['adherenceRate'] as num?)?.toDouble() ?? 0,
    );
  }
}

class DailyCalories {
  final DateTime date;
  final int actual;
  final int target;

  DailyCalories({
    required this.date,
    required this.actual,
    required this.target,
  });

  factory DailyCalories.fromJson(Map<String, dynamic> json) {
    return DailyCalories(
      date: DateTime.parse(json['date'] as String),
      actual: json['actual'] as int? ?? 0,
      target: json['target'] as int? ?? 2000,
    );
  }

  double get adherence => target > 0 ? (actual / target).clamp(0.0, 2.0) : 0;
}

class Restaurant {
  final String id;
  final String name;
  final String? cuisine;
  final double? distance;
  final double? lat;
  final double? lon;
  final List<String>? healthyOptions;
  final String? address;

  Restaurant({
    required this.id,
    required this.name,
    this.cuisine,
    this.distance,
    this.lat,
    this.lon,
    this.healthyOptions,
    this.address,
  });

  factory Restaurant.fromJson(Map<String, dynamic> json) {
    return Restaurant(
      id: json['id']?.toString() ?? '',
      name: json['name'] as String? ?? 'Restaurant',
      cuisine: json['cuisine'] as String?,
      distance: (json['distance'] as num?)?.toDouble(),
      lat: (json['lat'] as num?)?.toDouble(),
      lon: (json['lon'] as num?)?.toDouble(),
      healthyOptions: (json['healthyOptions'] as List<dynamic>?)?.cast<String>(),
      address: json['address'] as String?,
    );
  }

  String get distanceDisplay {
    if (distance == null) return '';
    if (distance! < 1) {
      return '${(distance! * 1000).round()}m';
    }
    return '${distance!.toStringAsFixed(1)}km';
  }
}
