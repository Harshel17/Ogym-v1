import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/owner.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/stats_card.dart';

class OwnerHomeTab extends StatefulWidget {
  const OwnerHomeTab({super.key});

  @override
  State<OwnerHomeTab> createState() => _OwnerHomeTabState();
}

class _OwnerHomeTabState extends State<OwnerHomeTab> {
  final ApiService _api = ApiService();
  
  OwnerDashboard? _dashboard;
  List<AIInsight>? _insights;
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
      final results = await Future.wait([
        _api.get(ApiConstants.ownerDashboard),
        _api.get(ApiConstants.ownerInsights).catchError((_) => null),
      ]);

      setState(() {
        _dashboard = results[0] != null 
            ? OwnerDashboard.fromJson(results[0] as Map<String, dynamic>)
            : null;
        
        if (results[1] != null) {
          final insightsList = results[1] is List 
              ? results[1] 
              : (results[1] as Map<String, dynamic>)['insights'] ?? [];
          _insights = (insightsList as List<dynamic>)
              .map((e) => AIInsight.fromJson(e as Map<String, dynamic>))
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
                  : _buildContent(user?.displayName ?? 'Owner', isDark),
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
                        value: '${dashboard?.totalMembers ?? 0}',
                        label: 'Total Members',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MiniStatsCard(
                        icon: Icons.login,
                        iconColor: AppColors.success,
                        value: '${dashboard?.todayCheckIns ?? 0}',
                        label: 'Today Check-ins',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: MiniStatsCard(
                        icon: Icons.attach_money,
                        iconColor: AppColors.success,
                        value: '${dashboard?.currency ?? '\$'}${dashboard?.monthlyRevenue.toStringAsFixed(0) ?? '0'}',
                        label: 'This Month',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: MiniStatsCard(
                        icon: Icons.pending_actions,
                        iconColor: AppColors.warning,
                        value: '${dashboard?.pendingPayments ?? 0}',
                        label: 'Pending',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 24)),

        // AI Insights Section
        if (_insights != null && _insights!.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome, color: AppColors.primary),
                  const SizedBox(width: 8),
                  const Text(
                    'AI Insights',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 12)),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                child: _InsightCard(insight: _insights![index]),
              ),
              childCount: _insights!.length.clamp(0, 3),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],

        // Quick Actions
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Quick Actions',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        icon: Icons.person_add,
                        label: 'Add Member',
                        color: AppColors.primary,
                        onTap: () {},
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionButton(
                        icon: Icons.campaign,
                        label: 'Announce',
                        color: AppColors.warning,
                        onTap: () {},
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _ActionButton(
                        icon: Icons.directions_walk,
                        label: 'Walk-in',
                        color: AppColors.teal,
                        onTap: () {},
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 24)),

        // Recent Activity
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: const Text(
              'Recent Activity',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 12)),

        if (dashboard?.recentActivity.isEmpty ?? true)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Column(
                  children: [
                    Icon(
                      Icons.history,
                      size: 48,
                      color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No recent activity',
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
              (context, index) => _ActivityItem(
                activity: dashboard!.recentActivity[index],
              ),
              childCount: dashboard!.recentActivity.length.clamp(0, 5),
            ),
          ),

        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }
}

class _InsightCard extends StatelessWidget {
  final AIInsight insight;

  const _InsightCard({required this.insight});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    Color priorityColor;
    switch (insight.priority) {
      case 'high':
        priorityColor = AppColors.error;
        break;
      case 'medium':
        priorityColor = AppColors.warning;
        break;
      default:
        priorityColor = AppColors.info;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : AppColors.cardLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: priorityColor.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: priorityColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.lightbulb_outline,
              color: priorityColor,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  insight.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  insight.description,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : AppColors.cardLight,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActivityItem extends StatelessWidget {
  final RecentActivity activity;

  const _ActivityItem({required this.activity});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    IconData icon;
    Color iconColor;

    switch (activity.type) {
      case 'check_in':
        icon = Icons.login;
        iconColor = AppColors.success;
        break;
      case 'payment':
        icon = Icons.payment;
        iconColor = AppColors.primary;
        break;
      case 'new_member':
        icon = Icons.person_add;
        iconColor = AppColors.info;
        break;
      default:
        icon = Icons.notifications;
        iconColor = AppColors.secondary;
    }

    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: iconColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: iconColor, size: 20),
      ),
      title: Text(activity.message),
      subtitle: Text(
        _formatTime(activity.timestamp),
        style: TextStyle(
          fontSize: 12,
          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
        ),
      ),
    );
  }

  String _formatTime(DateTime timestamp) {
    final now = DateTime.now();
    final diff = now.difference(timestamp);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}
