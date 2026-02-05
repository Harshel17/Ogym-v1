import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/trainer.dart';
import '../../services/api_service.dart';

class TrainerMembersTab extends StatefulWidget {
  const TrainerMembersTab({super.key});

  @override
  State<TrainerMembersTab> createState() => _TrainerMembersTabState();
}

class _TrainerMembersTabState extends State<TrainerMembersTab> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;
  
  List<AssignedMember> _members = [];
  List<StarMember> _starMembers = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        _api.get(ApiConstants.trainerMembers),
        _api.get(ApiConstants.trainerStarMembers).catchError((_) => null),
      ]);

      setState(() {
        if (results[0] != null) {
          final membersList = results[0] is List 
              ? results[0] 
              : (results[0] as Map<String, dynamic>)['members'] ?? [];
          _members = (membersList as List<dynamic>)
              .map((e) => AssignedMember.fromJson(e as Map<String, dynamic>))
              .toList();
        }

        if (results[1] != null) {
          final starList = results[1] is List 
              ? results[1] 
              : (results[1] as Map<String, dynamic>)['starMembers'] ?? [];
          _starMembers = (starList as List<dynamic>)
              .map((e) => StarMember.fromJson(e as Map<String, dynamic>))
              .toList();
        }

        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Members'),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.people),
                  const SizedBox(width: 8),
                  Text('All (${_members.length})'),
                ],
              ),
            ),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.star),
                  const SizedBox(width: 8),
                  Text('Star (${_starMembers.length})'),
                ],
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _buildError()
                : TabBarView(
                    controller: _tabController,
                    children: [
                      _AllMembersList(members: _members),
                      _StarMembersList(members: _starMembers),
                    ],
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
          Text(_error!),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _fetchData,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _AllMembersList extends StatelessWidget {
  final List<AssignedMember> members;

  const _AllMembersList({required this.members});

  @override
  Widget build(BuildContext context) {
    if (members.isEmpty) {
      return _buildEmpty(context, 'No members assigned to you yet');
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: members.length,
      itemBuilder: (context, index) {
        return _MemberCard(member: members[index]);
      },
    );
  }

  Widget _buildEmpty(BuildContext context, String message) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.people_outline,
            size: 64,
            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          ),
          const SizedBox(height: 16),
          Text(message),
        ],
      ),
    );
  }
}

class _StarMembersList extends StatelessWidget {
  final List<StarMember> members;

  const _StarMembersList({required this.members});

  @override
  Widget build(BuildContext context) {
    if (members.isEmpty) {
      return _buildEmpty(context, 'No star members yet');
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: members.length,
      itemBuilder: (context, index) {
        return _StarMemberCard(member: members[index]);
      },
    );
  }

  Widget _buildEmpty(BuildContext context, String message) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.star_outline,
            size: 64,
            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
          ),
          const SizedBox(height: 16),
          Text(message),
        ],
      ),
    );
  }
}

class _MemberCard extends StatelessWidget {
  final AssignedMember member;

  const _MemberCard({required this.member});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          // Navigate to member details
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.primary.withOpacity(0.1),
                    backgroundImage: member.profileImage != null
                        ? NetworkImage(member.profileImage!)
                        : null,
                    child: member.profileImage == null
                        ? Text(
                            member.initials,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          )
                        : null,
                  ),
                  if (member.isStarMember)
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          color: AppColors.warning,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isDark ? AppColors.cardDark : Colors.white,
                            width: 2,
                          ),
                        ),
                        child: const Icon(
                          Icons.star,
                          size: 10,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      member.name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (member.currentCycle != null)
                      Text(
                        member.currentCycle!,
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                        ),
                      ),
                    const SizedBox(height: 8),
                    // Progress bar
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: member.workoutCompletion / 100,
                              backgroundColor: isDark ? AppColors.surfaceDark : Colors.grey[300],
                              valueColor: AlwaysStoppedAnimation<Color>(
                                member.workoutCompletion >= 70
                                    ? AppColors.success
                                    : member.workoutCompletion >= 40
                                        ? AppColors.warning
                                        : AppColors.error,
                              ),
                              minHeight: 6,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${member.workoutCompletion}%',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: member.workoutCompletion >= 70
                                ? AppColors.success
                                : member.workoutCompletion >= 40
                                    ? AppColors.warning
                                    : AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class _StarMemberCard extends StatelessWidget {
  final StarMember member;

  const _StarMemberCard({required this.member});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          // Navigate to star member details
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.warning.withOpacity(0.1),
                    backgroundImage: member.profileImage != null
                        ? NetworkImage(member.profileImage!)
                        : null,
                    child: member.profileImage == null
                        ? Text(
                            member.initials,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppColors.warning,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              member.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Icon(
                              Icons.star,
                              size: 16,
                              color: AppColors.warning,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          member.email,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (member.dietPlan == null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'No Diet',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: AppColors.error,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _ProgressStat(
                      label: 'Workout',
                      value: member.workoutAdherence,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _ProgressStat(
                      label: 'Nutrition',
                      value: member.nutritionAdherence,
                      color: AppColors.success,
                    ),
                  ),
                ],
              ),
              if (member.specialNotes != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.surfaceDark : Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.note,
                        size: 16,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          member.specialNotes!,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ProgressStat extends StatelessWidget {
  final String label;
  final int value;
  final Color color;

  const _ProgressStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
            ),
            Text(
              '$value%',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value / 100,
            backgroundColor: isDark ? AppColors.surfaceDark : Colors.grey[300],
            valueColor: AlwaysStoppedAnimation<Color>(color),
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}
