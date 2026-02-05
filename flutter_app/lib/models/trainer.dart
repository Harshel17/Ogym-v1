class TrainerDashboard {
  final int totalMembers;
  final int activeWorkouts;
  final int starMembers;
  final List<dynamic> recentActivity;
  final List<dynamic> memberProgress;

  TrainerDashboard({
    required this.totalMembers,
    required this.activeWorkouts,
    required this.starMembers,
    required this.recentActivity,
    required this.memberProgress,
  });

  factory TrainerDashboard.fromJson(Map<String, dynamic> json) {
    return TrainerDashboard(
      totalMembers: json['totalMembers'] as int? ?? 0,
      activeWorkouts: json['activeWorkouts'] as int? ?? 0,
      starMembers: json['starMembers'] as int? ?? 0,
      recentActivity: json['recentActivity'] as List<dynamic>? ?? [],
      memberProgress: json['memberProgress'] as List<dynamic>? ?? [],
    );
  }
}

class AssignedMember {
  final int id;
  final String name;
  final String? email;
  final String? phone;
  final String? profileImage;
  final bool isStarMember;
  final DateTime? lastWorkout;
  final String? currentCycle;

  AssignedMember({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.profileImage,
    required this.isStarMember,
    this.lastWorkout,
    this.currentCycle,
  });

  factory AssignedMember.fromJson(Map<String, dynamic> json) {
    return AssignedMember(
      id: json['id'] as int? ?? json['memberId'] as int? ?? 0,
      name: json['name'] as String? ?? json['username'] as String? ?? '',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      profileImage: json['profileImage'] as String?,
      isStarMember: json['isStarMember'] as bool? ?? false,
      lastWorkout: json['lastWorkout'] != null 
          ? DateTime.parse(json['lastWorkout'] as String) 
          : null,
      currentCycle: json['currentCycle'] as String?,
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

class StarMember {
  final int id;
  final String name;
  final String? email;
  final String? phone;
  final String? profileImage;
  final String? dietPlan;
  final String? specialNotes;
  final int? workoutAdherence;
  final int? nutritionAdherence;
  final DateTime? lastContact;

  StarMember({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.profileImage,
    this.dietPlan,
    this.specialNotes,
    this.workoutAdherence,
    this.nutritionAdherence,
    this.lastContact,
  });

  factory StarMember.fromJson(Map<String, dynamic> json) {
    return StarMember(
      id: json['id'] as int? ?? json['memberId'] as int? ?? 0,
      name: json['name'] as String? ?? json['username'] as String? ?? '',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      profileImage: json['profileImage'] as String?,
      dietPlan: json['dietPlan'] as String?,
      specialNotes: json['specialNotes'] as String?,
      workoutAdherence: json['workoutAdherence'] as int?,
      nutritionAdherence: json['nutritionAdherence'] as int?,
      lastContact: json['lastContact'] != null 
          ? DateTime.parse(json['lastContact'] as String) 
          : null,
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
