class OwnerDashboard {
  final int totalMembers;
  final int activeMembers;
  final int newMembersThisMonth;
  final int todayCheckIns;
  final double monthlyRevenue;
  final int pendingPayments;
  final int expiringSubscriptions;
  final String? currency;
  final List<RecentActivity> recentActivity;

  OwnerDashboard({
    required this.totalMembers,
    required this.activeMembers,
    required this.newMembersThisMonth,
    required this.todayCheckIns,
    required this.monthlyRevenue,
    required this.pendingPayments,
    required this.expiringSubscriptions,
    this.currency,
    required this.recentActivity,
  });

  factory OwnerDashboard.fromJson(Map<String, dynamic> json) {
    return OwnerDashboard(
      totalMembers: json['totalMembers'] as int? ?? json['total_members'] as int? ?? 0,
      activeMembers: json['activeMembers'] as int? ?? json['active_members'] as int? ?? 0,
      newMembersThisMonth: json['newMembersThisMonth'] as int? ?? json['new_members_this_month'] as int? ?? 0,
      todayCheckIns: json['todayCheckIns'] as int? ?? json['today_check_ins'] as int? ?? 0,
      monthlyRevenue: (json['monthlyRevenue'] as num?)?.toDouble() ?? 
          (json['monthly_revenue'] as num?)?.toDouble() ?? 0,
      pendingPayments: json['pendingPayments'] as int? ?? json['pending_payments'] as int? ?? 0,
      expiringSubscriptions: json['expiringSubscriptions'] as int? ?? json['expiring_subscriptions'] as int? ?? 0,
      currency: json['currency'] as String?,
      recentActivity: (json['recentActivity'] as List<dynamic>? ?? json['recent_activity'] as List<dynamic>? ?? [])
          .map((e) => RecentActivity.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class RecentActivity {
  final String type;
  final String message;
  final DateTime timestamp;
  final String? memberName;

  RecentActivity({
    required this.type,
    required this.message,
    required this.timestamp,
    this.memberName,
  });

  factory RecentActivity.fromJson(Map<String, dynamic> json) {
    return RecentActivity(
      type: json['type'] as String? ?? 'info',
      message: json['message'] as String? ?? '',
      timestamp: json['timestamp'] != null 
          ? DateTime.parse(json['timestamp'] as String) 
          : DateTime.now(),
      memberName: json['memberName'] as String? ?? json['member_name'] as String?,
    );
  }
}

class AIInsight {
  final String id;
  final String type;
  final String title;
  final String description;
  final String priority; // high, medium, low
  final String? actionText;
  final Map<String, dynamic>? data;

  AIInsight({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.priority,
    this.actionText,
    this.data,
  });

  factory AIInsight.fromJson(Map<String, dynamic> json) {
    return AIInsight(
      id: json['id']?.toString() ?? '',
      type: json['type'] as String? ?? 'info',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      priority: json['priority'] as String? ?? 'medium',
      actionText: json['actionText'] as String? ?? json['action_text'] as String?,
      data: json['data'] as Map<String, dynamic>?,
    );
  }
}

class WalkIn {
  final int id;
  final String name;
  final String? phone;
  final String? email;
  final String type; // day_pass, trial, inquiry
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
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'] as String)
              : DateTime.now(),
      paymentVerified: json['paymentVerified'] as bool? ?? json['payment_verified'] as bool?,
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
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      profileImage: json['profileImage'] as String? ?? json['profile_image'] as String?,
      joinedAt: json['joinedAt'] != null 
          ? DateTime.parse(json['joinedAt'] as String) 
          : json['joined_at'] != null
              ? DateTime.parse(json['joined_at'] as String)
              : null,
      subscriptionStatus: json['subscriptionStatus'] as String? ?? json['subscription_status'] as String? ?? 'inactive',
      subscriptionExpiry: json['subscriptionExpiry'] != null 
          ? DateTime.parse(json['subscriptionExpiry'] as String) 
          : json['subscription_expiry'] != null
              ? DateTime.parse(json['subscription_expiry'] as String)
              : null,
      trainerId: json['trainerId'] as int? ?? json['trainer_id'] as int?,
      trainerName: json['trainerName'] as String? ?? json['trainer_name'] as String?,
      isStarMember: json['isStarMember'] as bool? ?? json['is_star_member'] as bool?,
      attendanceCount: json['attendanceCount'] as int? ?? json['attendance_count'] as int? ?? 0,
      lastCheckIn: json['lastCheckIn'] != null 
          ? DateTime.parse(json['lastCheckIn'] as String) 
          : json['last_check_in'] != null
              ? DateTime.parse(json['last_check_in'] as String)
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
  final String status; // paid, pending, overdue
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
      memberId: json['memberId'] as int? ?? json['member_id'] as int? ?? 0,
      memberName: json['memberName'] as String? ?? json['member_name'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      currency: json['currency'] as String? ?? 'USD',
      status: json['status'] as String? ?? 'pending',
      type: json['type'] as String?,
      dueDate: json['dueDate'] != null 
          ? DateTime.parse(json['dueDate'] as String) 
          : json['due_date'] != null
              ? DateTime.parse(json['due_date'] as String)
              : DateTime.now(),
      paidAt: json['paidAt'] != null 
          ? DateTime.parse(json['paidAt'] as String) 
          : json['paid_at'] != null
              ? DateTime.parse(json['paid_at'] as String)
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
  final String targetAudience; // all, members, trainers
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
      targetAudience: json['targetAudience'] as String? ?? json['target_audience'] as String? ?? 'all',
      createdAt: json['createdAt'] != null 
          ? DateTime.parse(json['createdAt'] as String) 
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'] as String)
              : DateTime.now(),
      isActive: json['isActive'] as bool? ?? json['is_active'] as bool? ?? true,
    );
  }
}
