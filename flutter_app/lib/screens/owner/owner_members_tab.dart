import 'package:flutter/material.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../models/owner.dart';
import '../../services/api_service.dart';

class OwnerMembersTab extends StatefulWidget {
  const OwnerMembersTab({super.key});

  @override
  State<OwnerMembersTab> createState() => _OwnerMembersTabState();
}

class _OwnerMembersTabState extends State<OwnerMembersTab> {
  final ApiService _api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  
  List<GymMember> _members = [];
  List<GymMember> _filteredMembers = [];
  bool _isLoading = true;
  String? _error;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _fetchMembers();
    _searchController.addListener(_filterMembers);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchMembers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get(ApiConstants.ownerMembers);
      
      if (response != null) {
        final membersList = response is List ? response : (response['members'] ?? []);
        setState(() {
          _members = (membersList as List<dynamic>)
              .map((e) => GymMember.fromJson(e as Map<String, dynamic>))
              .toList();
          _filteredMembers = _members;
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _filterMembers() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredMembers = _members.where((member) {
        final matchesSearch = member.name.toLowerCase().contains(query) ||
            member.email.toLowerCase().contains(query);
        
        if (_filter == 'all') return matchesSearch;
        if (_filter == 'active') return matchesSearch && member.subscriptionStatus == 'active';
        if (_filter == 'expired') return matchesSearch && member.subscriptionStatus != 'active';
        if (_filter == 'star') return matchesSearch && member.isStarMember == true;
        
        return matchesSearch;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Members'),
        actions: [
          IconButton(
            onPressed: _fetchMembers,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search members...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: isDark ? AppColors.cardDark : AppColors.cardLight,
              ),
            ),
          ),

          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _FilterChip(
                  label: 'All',
                  isSelected: _filter == 'all',
                  onTap: () {
                    setState(() => _filter = 'all');
                    _filterMembers();
                  },
                ),
                _FilterChip(
                  label: 'Active',
                  isSelected: _filter == 'active',
                  onTap: () {
                    setState(() => _filter = 'active');
                    _filterMembers();
                  },
                ),
                _FilterChip(
                  label: 'Expired',
                  isSelected: _filter == 'expired',
                  onTap: () {
                    setState(() => _filter = 'expired');
                    _filterMembers();
                  },
                ),
                _FilterChip(
                  label: 'Star Members',
                  isSelected: _filter == 'star',
                  onTap: () {
                    setState(() => _filter == 'star');
                    _filterMembers();
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Members List
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchMembers,
              child: _buildContent(),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Add member dialog
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.person_add),
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: AppColors.error),
            const SizedBox(height: 16),
            Text(_error!),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchMembers,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_filteredMembers.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.people_outline,
              size: 64,
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppColors.textSecondaryDark
                  : AppColors.textSecondaryLight,
            ),
            const SizedBox(height: 16),
            const Text('No members found'),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _filteredMembers.length,
      itemBuilder: (context, index) {
        return _MemberCard(member: _filteredMembers[index]);
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => onTap(),
        selectedColor: AppColors.primary.withOpacity(0.2),
        checkmarkColor: AppColors.primary,
        labelStyle: TextStyle(
          color: isSelected ? AppColors.primary : null,
          fontWeight: isSelected ? FontWeight.w600 : null,
        ),
      ),
    );
  }
}

class _MemberCard extends StatelessWidget {
  final GymMember member;

  const _MemberCard({required this.member});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isActive = member.subscriptionStatus == 'active';

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
                  if (member.isStarMember == true)
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
                    Text(
                      member.email,
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                      ),
                    ),
                    if (member.trainerName != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Trainer: ${member.trainerName}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.textTertiaryDark : AppColors.textTertiaryLight,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isActive
                          ? AppColors.success.withOpacity(0.1)
                          : AppColors.error.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      isActive ? 'Active' : 'Expired',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: isActive ? AppColors.success : AppColors.error,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${member.attendanceCount} check-ins',
                    style: TextStyle(
                      fontSize: 11,
                      color: isDark ? AppColors.textTertiaryDark : AppColors.textTertiaryLight,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
