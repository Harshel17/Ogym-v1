import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import ProfileScreen from '../screens/member/ProfileScreen';
import { colors, spacing, borderRadius } from '../utils/colors';
import { useAuth } from '../contexts/AuthContext';
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../api/client';
import LoadingScreen from '../components/LoadingScreen';
import StatCard from '../components/StatCard';

const Tab = createBottomTabNavigator();

interface DashboardMetrics {
  totalMembers: number;
  checkedInToday: number;
  checkedInYesterday: number;
  newEnrollmentsLast30Days: number;
}

function OwnerHomeScreen() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/owner/dashboard-metrics');
      setMetrics(response.data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.username?.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.role}>Owner of {user?.gym?.name}</Text>
        </View>
      </View>

      <View style={styles.gymCodeCard}>
        <Text style={styles.gymCodeLabel}>Gym Code</Text>
        <Text style={styles.gymCode}>{user?.gym?.code}</Text>
        <Text style={styles.gymCodeHint}>Share this code with members and trainers</Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon={<Text style={{ fontSize: 24 }}>{'👥'}</Text>}
          value={metrics?.totalMembers || 0}
          label="Total Members"
          color={colors.blue}
        />
        <StatCard
          icon={<Text style={{ fontSize: 24 }}>{'✅'}</Text>}
          value={metrics?.checkedInToday || 0}
          label="Checked In Today"
          color={colors.green}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon={<Text style={{ fontSize: 24 }}>{'📅'}</Text>}
          value={metrics?.checkedInYesterday || 0}
          label="Yesterday"
          color={colors.orange}
        />
        <StatCard
          icon={<Text style={{ fontSize: 24 }}>{'🆕'}</Text>}
          value={metrics?.newEnrollmentsLast30Days || 0}
          label="New (30 days)"
          color={colors.purple}
        />
      </View>
    </ScrollView>
  );
}

function TrainersScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'🏋️'}</Text>
      <Text style={styles.placeholderText}>Trainers</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

function MembersScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'👥'}</Text>
      <Text style={styles.placeholderText}>Members</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

function PaymentsScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'💰'}</Text>
      <Text style={styles.placeholderText}>Payments</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

function AnnouncementsScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'📢'}</Text>
      <Text style={styles.placeholderText}>Announcements</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

export default function OwnerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={OwnerHomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'🏠'}</Text>,
        }}
      />
      <Tab.Screen
        name="Members"
        component={MembersScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'👥'}</Text>,
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'💰'}</Text>,
        }}
      />
      <Tab.Screen
        name="Announce"
        component={AnnouncementsScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'📢'}</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'👤'}</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.purple,
    borderRadius: borderRadius.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  role: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  gymCodeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gymCodeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  gymCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 4,
  },
  gymCodeHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
