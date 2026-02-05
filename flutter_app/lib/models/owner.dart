class OwnerDashboard {
  final int totalMembers;
  final int checkedInToday;
  final int checkedInYesterday;
  final int newEnrollmentsLast30Days;
  final int pendingPayments;
  final double totalRevenue;

  OwnerDashboard({
    required this.totalMembers,
    required this.checkedInToday,
    required this.checkedInYesterday,
    required this.newEnrollmentsLast30Days,
    required this.pendingPayments,
    required this.totalRevenue,
  });

  factory OwnerDashboard.fromJson(Map<String, dynamic> json) {
    return OwnerDashboard(
      totalMembers: json['totalMembers'] as int? ?? 0,
      checkedInToday: json['checkedInToday'] as int? ?? 0,
      checkedInYesterday: json['checkedInYesterday'] as int? ?? 0,
      newEnrollmentsLast30Days: json['newEnrollmentsLast30Days'] as int? ?? 0,
      pendingPayments: json['pendingPayments'] as int? ?? 0,
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0,
    );
  }
}

class WalkIn {
  final int id;
  final String name;
  final String? phone;
  final String? email;
  final String type;
  final String status;
  final double? amount;
  final String? notes;
  final DateTime createdAt;
  final bool? paymentVerified;

  WalkIn({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    required this.type,
    required this.status,
    this.amount,
    this.notes,
    required this.createdAt,
    this.paymentVerified,
  });

  factory WalkIn.fromJson(Map<String, dynamic> json) {
    return WalkIn(
      id: json['id'] as int,
      name: json['name'] as String? ?? 'Walk-in',
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      type: json['type'] as String? ?? 'inquiry',
      status: json['status'] as String? ?? 'pending',
      amount: (json['amount'] as num?)?.toDouble(),
      notes: json['notes'] as String?,
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'] as String) 
          : DateTime.now(),
      paymentVerified: json['paymentVerified'] as bool?,
    );
  }

  String get typeDisplay {
    switch (type) {
      case 'day_pass':
        return 'Day Pass';
      case 'trial':
        return 'Trial';
      case 'inquiry':
        return 'Inquiry';
      default:
        return type;
    }
  }
}

class GymMember {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? profileImage;
  final DateTime? joinedAt;
  final String subscriptionStatus;
  final DateTime? subscriptionExpiry;
  final int? trainerId;
  final String? trainerName;
  final bool? isStarMember;
  final int attendanceCount;
  final DateTime? lastCheckIn;

  GymMember({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.profileImage,
    this.joinedAt,
    required this.subscriptionStatus,
    this.subscriptionExpiry,
    this.trainerId,
    this.trainerName,
    this.isStarMember,
    required this.attendanceCount,
    this.lastCheckIn,
  });

  factory GymMember.fromJson(Map<String, dynamic> json) {
    return GymMember(
      id: json['id'] as int,
      name: json['name'] as String? ?? json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      profileImage: json['profileImage'] as String?,
      joinedAt: json['joinedAt'] != null 
          ? DateTime.parse(json['joinedAt'] as String) 
          : json['createdAt'] != null
              ? DateTime.parse(json['createdAt'] as String)
              : null,
      subscriptionStatus: json['subscriptionStatus'] as String? ?? 'inactive',
      subscriptionExpiry: json['subscriptionExpiry'] != null 
          ? DateTime.parse(json['subscriptionExpiry'] as String) 
          : null,
      trainerId: json['trainerId'] as int?,
      trainerName: json['trainerName'] as String?,
      isStarMember: json['isStarMember'] as bool?,
      attendanceCount: json['attendanceCount'] as int? ?? 0,
      lastCheckIn: json['lastCheckIn'] != null 
          ? DateTime.parse(json['lastCheckIn'] as String) 
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

class Payment {
  final int id;
  final int memberId;
  final String memberName;
  final double amount;
  final String currency;
  final String status;
  final String? type;
  final DateTime dueDate;
  final DateTime? paidAt;
  final String? notes;

  Payment({
    required this.id,
    required this.memberId,
    required this.memberName,
    required this.amount,
    required this.currency,
    required this.status,
    this.type,
    required this.dueDate,
    this.paidAt,
    this.notes,
  });

  factory Payment.fromJson(Map<String, dynamic> json) {
    return Payment(
      id: json['id'] as int,
      memberId: json['memberId'] as int? ?? 0,
      memberName: json['memberName'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      currency: json['currency'] as String? ?? 'USD',
      status: json['status'] as String? ?? 'pending',
      type: json['type'] as String?,
      dueDate: json['dueDate'] != null 
          ? DateTime.parse(json['dueDate'] as String) 
          : DateTime.now(),
      paidAt: json['paidAt'] != null 
          ? DateTime.parse(json['paidAt'] as String) 
          : null,
      notes: json['notes'] as String?,
    );
  }

  String get formattedAmount => '$currency ${amount.toStringAsFixed(2)}';
}

class Announcement {
  final int id;
  final String title;
  final String content;
  final String targetAudience;
  final DateTime createdAt;
  final bool isActive;

  Announcement({
    required this.id,
    required this.title,
    required this.content,
    required this.targetAudience,
    required this.createdAt,
    required this.isActive,
  });

  factory Announcement.fromJson(Map<String, dynamic> json) {
    return Announcement(
      id: json['id'] as int,
      title: json['title'] as String? ?? '',
      content: json['content'] as String? ?? '',
      targetAudience: json['targetAudience'] as String? ?? 'all',
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'] as String) 
          : DateTime.now(),
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}

class MemberSubscription {
  final int id;
  final int memberId;
  final String memberName;
  final String? planName;
  final double totalAmount;
  final double paidAmount;
  final String status;
  final DateTime startDate;
  final DateTime endDate;
  final String paymentMode;

  MemberSubscription({
    required this.id,
    required this.memberId,
    required this.memberName,
    this.planName,
    required this.totalAmount,
    required this.paidAmount,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.paymentMode,
  });

  factory MemberSubscription.fromJson(Map<String, dynamic> json) {
    return MemberSubscription(
      id: json['id'] as int,
      memberId: json['memberId'] as int? ?? 0,
      memberName: json['member']?['name'] as String? ?? json['memberName'] as String? ?? '',
      planName: json['plan']?['name'] as String? ?? json['planName'] as String?,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0,
      paidAmount: (json['totalPaid'] as num?)?.toDouble() ?? (json['paidAmount'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'active',
      startDate: json['startDate'] != null 
          ? DateTime.parse(json['startDate'] as String) 
          : DateTime.now(),
      endDate: json['endDate'] != null 
          ? DateTime.parse(json['endDate'] as String) 
          : DateTime.now(),
      paymentMode: json['paymentMode'] as String? ?? 'full',
    );
  }

  double get remainingAmount => totalAmount - paidAmount;
  bool get isFullyPaid => remainingAmount <= 0;
}
