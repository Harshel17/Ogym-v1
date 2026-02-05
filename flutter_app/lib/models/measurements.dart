class BodyMeasurements {
  final int? id;
  final double? weight;
  final double? height;
  final double? bodyFat;
  final double? chest;
  final double? waist;
  final double? hips;
  final double? biceps;
  final double? thighs;
  final double? calves;
  final double? shoulders;
  final double? neck;
  final double? forearms;
  final String? notes;
  final DateTime? measuredAt;

  BodyMeasurements({
    this.id,
    this.weight,
    this.height,
    this.bodyFat,
    this.chest,
    this.waist,
    this.hips,
    this.biceps,
    this.thighs,
    this.calves,
    this.shoulders,
    this.neck,
    this.forearms,
    this.notes,
    this.measuredAt,
  });

  factory BodyMeasurements.fromJson(Map<String, dynamic> json) {
    return BodyMeasurements(
      id: json['id'] as int?,
      weight: (json['weight'] as num?)?.toDouble(),
      height: (json['height'] as num?)?.toDouble(),
      bodyFat: (json['bodyFat'] as num?)?.toDouble() ?? (json['body_fat'] as num?)?.toDouble(),
      chest: (json['chest'] as num?)?.toDouble(),
      waist: (json['waist'] as num?)?.toDouble(),
      hips: (json['hips'] as num?)?.toDouble(),
      biceps: (json['biceps'] as num?)?.toDouble(),
      thighs: (json['thighs'] as num?)?.toDouble(),
      calves: (json['calves'] as num?)?.toDouble(),
      shoulders: (json['shoulders'] as num?)?.toDouble(),
      neck: (json['neck'] as num?)?.toDouble(),
      forearms: (json['forearms'] as num?)?.toDouble(),
      notes: json['notes'] as String?,
      measuredAt: json['measuredAt'] != null 
          ? DateTime.parse(json['measuredAt'] as String) 
          : json['measured_at'] != null
              ? DateTime.parse(json['measured_at'] as String)
              : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'weight': weight,
      'height': height,
      'bodyFat': bodyFat,
      'chest': chest,
      'waist': waist,
      'hips': hips,
      'biceps': biceps,
      'thighs': thighs,
      'calves': calves,
      'shoulders': shoulders,
      'neck': neck,
      'forearms': forearms,
      'notes': notes,
    };
  }

  double? get bmi {
    if (weight != null && height != null && height! > 0) {
      final heightInMeters = height! / 100;
      return weight! / (heightInMeters * heightInMeters);
    }
    return null;
  }

  String get bmiCategory {
    final bmiValue = bmi;
    if (bmiValue == null) return 'Unknown';
    if (bmiValue < 18.5) return 'Underweight';
    if (bmiValue < 25) return 'Normal';
    if (bmiValue < 30) return 'Overweight';
    return 'Obese';
  }
}

class MeasurementHistory {
  final List<BodyMeasurements> measurements;
  final MeasurementProgress? progress;

  MeasurementHistory({
    required this.measurements,
    this.progress,
  });

  factory MeasurementHistory.fromJson(Map<String, dynamic> json) {
    return MeasurementHistory(
      measurements: (json['measurements'] as List<dynamic>? ?? [])
          .map((e) => BodyMeasurements.fromJson(e as Map<String, dynamic>))
          .toList(),
      progress: json['progress'] != null 
          ? MeasurementProgress.fromJson(json['progress'] as Map<String, dynamic>)
          : null,
    );
  }
}

class MeasurementProgress {
  final double? weightChange;
  final double? bodyFatChange;
  final double? chestChange;
  final double? waistChange;
  final String? trend; // gaining, losing, maintaining

  MeasurementProgress({
    this.weightChange,
    this.bodyFatChange,
    this.chestChange,
    this.waistChange,
    this.trend,
  });

  factory MeasurementProgress.fromJson(Map<String, dynamic> json) {
    return MeasurementProgress(
      weightChange: (json['weightChange'] as num?)?.toDouble() ?? (json['weight_change'] as num?)?.toDouble(),
      bodyFatChange: (json['bodyFatChange'] as num?)?.toDouble() ?? (json['body_fat_change'] as num?)?.toDouble(),
      chestChange: (json['chestChange'] as num?)?.toDouble() ?? (json['chest_change'] as num?)?.toDouble(),
      waistChange: (json['waistChange'] as num?)?.toDouble() ?? (json['waist_change'] as num?)?.toDouble(),
      trend: json['trend'] as String?,
    );
  }
}
