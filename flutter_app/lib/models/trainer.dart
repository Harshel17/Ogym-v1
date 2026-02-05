class TrainerDashboard {
  final int totalAssignedMembers;
  final int todaySessions;
  final int starMembers;
  final int pendingDietPlans;
  final List<AssignedMember> assignedMembers;
  final List<TodaySession> todaySessions_;

  TrainerDashboard({
    required this.totalAssignedMembers,
    required this.todaySessions,
    required this.starMembers,
    required this.pendingDietPlans,
    required this.assignedMembers,
    required this.todaySessions_,
  });

  factory TrainerDashboard.fromJson(Map<String, dynamic> json) {
    return TrainerDashboard(
      totalAssignedMembers: json['totalAssignedMembers'] as int? ?? json['total_assigned_members'] as int? ?? 0,
      todaySessions: json['todaySessions'] as int? ?? json['today_sessions'] as int? ?? 0,
      starMembers: json['starMembers'] as int? ?? json['star_members'] as int? ?? 0,
      pendingDietPlans: json['pendingDietPlans'] as int? ?? json['pending_diet_plans'] as int? ?? 0,
      assignedMembers: (json['assignedMembers'] as List<dynamic>? ?? json['assigned_members'] as List<dynamic>? ?? [])
          .map((e) => AssignedMember.fromJson(e as Map<String, dynamic>))
          .toList(),
      todaySessions_: (json['todaySessionsList'] as List<dynamic>? ?? json['today_sessions_list'] as List<dynamic>? ?? [])
          .map((e) => TodaySession.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class AssignedMember {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? profileImage;
  final bool isStarMember;
  final int workoutCompletion;
  final DateTime? lastWorkout;
  final String? currentCycle;
  final bool hasDietPlan;

  AssignedMember({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.profileImage,
    required this.isStarMember,
    required this.workoutCompletion,
    this.lastWorkout,
    this.currentCycle,
    required this.hasDietPlan,
  });

  factory AssignedMember.fromJson(Map<String, dynamic> json) {
    return AssignedMember(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      profileImage: json['profileImage'] as String? ?? json['profile_image'] as String?,
      isStarMember: json['isStarMember'] as bool? ?? json['is_star_member'] as bool? ?? false,
      workoutCompletion: json['workoutCompletion'] as int? ?? json['workout_completion'] as int? ?? 0,
      lastWorkout: json['lastWorkout'] != null 
          ? DateTime.parse(json['lastWorkout'] as String) 
          : json['last_workout'] != null
              ? DateTime.parse(json['last_workout'] as String)
              : null,
      currentCycle: json['currentCycle'] as String? ?? json['current_cycle'] as String?,
      hasDietPlan: json['hasDietPlan'] as bool? ?? json['has_diet_plan'] as bool? ?? false,
    );
  }

  String get initials {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase();
  }
}

class TodaySession {
  final int id;
  final int memberId;
  final String memberName;
  final String? memberImage;
  final DateTime scheduledTime;
  final String type;
  final String status;
  final String? notes;

  TodaySession({
    required this.id,
    required this.memberId,
    required this.memberName,
    this.memberImage,
    required this.scheduledTime,
    required this.type,
    required this.status,
    this.notes,
  });

  factory TodaySession.fromJson(Map<String, dynamic> json) {
    return TodaySession(
      id: json['id'] as int,
      memberId: json['memberId'] as int? ?? json['member_id'] as int? ?? 0,
      memberName: json['memberName'] as String? ?? json['member_name'] as String? ?? '',
      memberImage: json['memberImage'] as String? ?? json['member_image'] as String?,
      scheduledTime: json['scheduledTime'] != null 
          ? DateTime.parse(json['scheduledTime'] as String) 
          : json['scheduled_time'] != null
              ? DateTime.parse(json['scheduled_time'] as String)
              : DateTime.now(),
      type: json['type'] as String? ?? 'training',
      status: json['status'] as String? ?? 'scheduled',
      notes: json['notes'] as String?,
    );
  }
}

class StarMember {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? profileImage;
  final String? dietPlan;
  final String? specialNotes;
  final int workoutAdherence;
  final int nutritionAdherence;
  final DateTime? lastContact;
  final List<DietPlanMeal>? mealPlan;

  StarMember({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.profileImage,
    this.dietPlan,
    this.specialNotes,
    required this.workoutAdherence,
    required this.nutritionAdherence,
    this.lastContact,
    this.mealPlan,
  });

  factory StarMember.fromJson(Map<String, dynamic> json) {
    return StarMember(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      profileImage: json['profileImage'] as String? ?? json['profile_image'] as String?,
      dietPlan: json['dietPlan'] as String? ?? json['diet_plan'] as String?,
      specialNotes: json['specialNotes'] as String? ?? json['special_notes'] as String?,
      workoutAdherence: json['workoutAdherence'] as int? ?? json['workout_adherence'] as int? ?? 0,
      nutritionAdherence: json['nutritionAdherence'] as int? ?? json['nutrition_adherence'] as int? ?? 0,
      lastContact: json['lastContact'] != null 
          ? DateTime.parse(json['lastContact'] as String) 
          : json['last_contact'] != null
              ? DateTime.parse(json['last_contact'] as String)
              : null,
      mealPlan: (json['mealPlan'] as List<dynamic>? ?? json['meal_plan'] as List<dynamic>?)
          ?.map((e) => DietPlanMeal.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  String get initials {
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.substring(0, name.length >= 2 ? 2 : 1).toUpperCase();
  }
}

class DietPlanMeal {
  final String mealType;
  final String name;
  final int calories;
  final int protein;
  final String? notes;

  DietPlanMeal({
    required this.mealType,
    required this.name,
    required this.calories,
    required this.protein,
    this.notes,
  });

  factory DietPlanMeal.fromJson(Map<String, dynamic> json) {
    return DietPlanMeal(
      mealType: json['mealType'] as String? ?? json['meal_type'] as String? ?? 'meal',
      name: json['name'] as String? ?? '',
      calories: json['calories'] as int? ?? 0,
      protein: json['protein'] as int? ?? 0,
      notes: json['notes'] as String?,
    );
  }
}
