class User {
  final int id;
  final String email;
  final String name;
  final String role;
  final int? gymId;
  final String? gymName;
  final String? profileImage;
  final String? phone;
  final DateTime? createdAt;
  final bool? isPersonalMode;
  final String? trainingMode;

  User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.gymId,
    this.gymName,
    this.profileImage,
    this.phone,
    this.createdAt,
    this.isPersonalMode,
    this.trainingMode,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      email: json['email'] as String,
      name: json['name'] as String? ?? json['email'] as String,
      role: json['role'] as String,
      gymId: json['gym_id'] as int? ?? json['gymId'] as int?,
      gymName: json['gym_name'] as String? ?? json['gymName'] as String?,
      profileImage: json['profile_image'] as String? ?? json['profileImage'] as String?,
      phone: json['phone'] as String?,
      createdAt: json['created_at'] != null 
          ? DateTime.parse(json['created_at'] as String) 
          : null,
      isPersonalMode: json['is_personal_mode'] as bool? ?? json['isPersonalMode'] as bool?,
      trainingMode: json['training_mode'] as String? ?? json['trainingMode'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'role': role,
      'gym_id': gymId,
      'gym_name': gymName,
      'profile_image': profileImage,
      'phone': phone,
      'created_at': createdAt?.toIso8601String(),
      'is_personal_mode': isPersonalMode,
      'training_mode': trainingMode,
    };
  }

  bool get isOwner => role == 'owner';
  bool get isMember => role == 'member';
  bool get isTrainer => role == 'trainer';

  String get displayName => name.isNotEmpty ? name : email.split('@').first;

  String get initials {
    final parts = displayName.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return displayName.substring(0, displayName.length >= 2 ? 2 : 1).toUpperCase();
  }
}
