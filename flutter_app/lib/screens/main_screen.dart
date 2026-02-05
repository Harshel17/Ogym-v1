import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../config/theme.dart';
import '../providers/auth_provider.dart';
import 'member/member_home_tab.dart';
import 'member/member_workouts_tab.dart';
import 'member/member_nutrition_tab.dart';
import 'member/member_profile_tab.dart';
import 'owner/owner_home_tab.dart';
import 'owner/owner_members_tab.dart';
import 'owner/owner_payments_tab.dart';
import 'owner/owner_profile_tab.dart';
import 'trainer/trainer_home_tab.dart';
import 'trainer/trainer_members_tab.dart';
import 'trainer/trainer_profile_tab.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    
    if (user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final role = user.role;
    
    return Scaffold(
      body: _buildBody(role),
      bottomNavigationBar: _buildBottomNav(role),
    );
  }

  Widget _buildBody(String role) {
    switch (role) {
      case 'owner':
        return _buildOwnerBody();
      case 'trainer':
        return _buildTrainerBody();
      case 'member':
      default:
        return _buildMemberBody();
    }
  }

  Widget _buildMemberBody() {
    switch (_currentIndex) {
      case 0:
        return const MemberHomeTab();
      case 1:
        return const MemberWorkoutsTab();
      case 2:
        return const MemberNutritionTab();
      case 3:
        return const MemberProfileTab();
      default:
        return const MemberHomeTab();
    }
  }

  Widget _buildOwnerBody() {
    switch (_currentIndex) {
      case 0:
        return const OwnerHomeTab();
      case 1:
        return const OwnerMembersTab();
      case 2:
        return const OwnerPaymentsTab();
      case 3:
        return const OwnerProfileTab();
      default:
        return const OwnerHomeTab();
    }
  }

  Widget _buildTrainerBody() {
    switch (_currentIndex) {
      case 0:
        return const TrainerHomeTab();
      case 1:
        return const TrainerMembersTab();
      case 2:
        return const TrainerProfileTab();
      default:
        return const TrainerHomeTab();
    }
  }

  Widget _buildBottomNav(String role) {
    switch (role) {
      case 'owner':
        return _buildOwnerNav();
      case 'trainer':
        return _buildTrainerNav();
      case 'member':
      default:
        return _buildMemberNav();
    }
  }

  Widget _buildMemberNav() {
    return NavigationBar(
      selectedIndex: _currentIndex,
      onDestinationSelected: (index) => setState(() => _currentIndex = index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.fitness_center_outlined),
          selectedIcon: Icon(Icons.fitness_center),
          label: 'Workouts',
        ),
        NavigationDestination(
          icon: Icon(Icons.restaurant_outlined),
          selectedIcon: Icon(Icons.restaurant),
          label: 'Nutrition',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'Profile',
        ),
      ],
    );
  }

  Widget _buildOwnerNav() {
    return NavigationBar(
      selectedIndex: _currentIndex,
      onDestinationSelected: (index) => setState(() => _currentIndex = index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Dashboard',
        ),
        NavigationDestination(
          icon: Icon(Icons.people_outline),
          selectedIcon: Icon(Icons.people),
          label: 'Members',
        ),
        NavigationDestination(
          icon: Icon(Icons.payment_outlined),
          selectedIcon: Icon(Icons.payment),
          label: 'Payments',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'Profile',
        ),
      ],
    );
  }

  Widget _buildTrainerNav() {
    return NavigationBar(
      selectedIndex: _currentIndex,
      onDestinationSelected: (index) => setState(() => _currentIndex = index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Dashboard',
        ),
        NavigationDestination(
          icon: Icon(Icons.people_outline),
          selectedIcon: Icon(Icons.people),
          label: 'Members',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'Profile',
        ),
      ],
    );
  }
}
