import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/trainer.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/stats_card.dart';

class TrainerHomeTab extends StatefulWidget {
  const TrainerHomeTab({super.key});

  @override
  State<TrainerHomeTab> createState() => _TrainerHomeTabState();
}

class _TrainerHomeTabState extends State<TrainerHomeTab> {
  final ApiService _api = ApiService();
  
  TrainerDashboard? _dashboard;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get(ApiConstants.trainerDashboard);
      
      setState(() {
        _dashboard = response != null 
            ? TrainerDashboard.fromJson(response as Map<String, dynamic>)
            : null;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
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
                  : _buildContent(user?.displayName ?? 'Trainer', isDark),
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
    final dashboard = _dashboard;
    
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

        // Stats Grid
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: MiniStatsCard(
                        icon: Icons.people,
                        iconColor: AppColors.primary,
                        value: '${dashboard?.totalAssignedMembers ?? 0}',
                        label: 'My Members',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MiniStatsCard(
                        icon: Icons.star,
                        iconColor: AppColors.warning,
                        value: '${dashboard?.starMembers ?? 0}',
                        label: 'Star Members',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: MiniStatsCard(
                        icon: Icons.calendar_today,
                        iconColor: AppColors.success,
                        value: '${dashboard?.todaySessions ?? 0}',
                        label: 'Today Sessions',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MiniStatsCard(
                        icon: Icons.restaurant_menu,
                        iconColor: AppColors.error,
                        value: '${dashboard?.pendingDietPlans ?? 0}',
                        label: 'Pending Diets',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 24)),

        // Today's Sessions
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: const Text(
              "Today's Sessions",
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 12)),

        if (dashboard?.todaySessions_.isEmpty ?? true)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.event_busy,
                      size: 48,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No sessions scheduled today',
                      style: TextStyle(
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => _SessionCard(
                session: dashboard!.todaySessions_[index],
              ),
              childCount: dashboard!.todaySessions_.length,
            ),
          ),

        const SliverToBoxAdapter(child: SizedBox(height: 24)),

        // Recent Members
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'My Members',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                TextButton(
                  onPressed: () {
                    // Navigate to members tab
                  },
                  child: const Text('See All'),
                ),
              ],
            ),
          ),
        ),

        if (dashboard?.assignedMembers.isEmpty ?? true)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.people_outline,
                      size: 48,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No members assigned yet',
                      style: TextStyle(
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
        else
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => _MemberRow(
                member: dashboard!.assignedMembers[index],
              ),
              childCount: dashboard!.assignedMembers.length.clamp(0, 5),
            ),
          ),

        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }
}

class _SessionCard extends StatelessWidget {
  final TodaySession session;

  const _SessionCard({required this.session});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
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
                _formatTime(session.scheduledTime),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.memberName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  session.type,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: session.status == 'completed'
                  ? AppColors.success.withOpacity(0.1)
                  : AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              session.status.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: session.status == 'completed'
                    ? AppColors.success
                    : AppColors.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime time) {
    final hour = time.hour > 12 ? time.hour - 12 : time.hour;
    final period = time.hour >= 12 ? 'PM' : 'AM';
    return '${hour}:${time.minute.toString().padLeft(2, '0')}\n$period';
  }
}

class _MemberRow extends StatelessWidget {
  final AssignedMember member;

  const _MemberRow({required this.member});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ListTile(
      leading: Stack(
        children: [
          CircleAvatar(
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
                width: 14,
                height: 14,
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
                  size: 8,
                  color: Colors.white,
                ),
              ),
            ),
        ],
      ),
      title: Text(member.name),
      subtitle: Text(
        '${member.workoutCompletion}% completion',
        style: TextStyle(
          fontSize: 12,
          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
        ),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!member.hasDietPlan && member.isStarMember)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.warning.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Need Diet',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppColors.warning,
                ),
              ),
            ),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right),
        ],
      ),
      onTap: () {
        // Navigate to member details
      },
    );
  }
}
