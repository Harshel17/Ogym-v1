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

function TrainerHomeScreen() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/trainer/members');
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch members:', error);
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
    return <LoadingScreen message="Loading..." />;
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
          <Text style={styles.role}>Trainer at {user?.gym?.name}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon={<Text style={{ fontSize: 24 }}>{'👥'}</Text>}
          value={members.length}
          label="My Members"
          color={colors.blue}
        />
        <StatCard
          icon={<Text style={{ fontSize: 24 }}>{'⭐'}</Text>}
          value={members.filter((m: any) => m.isStarred).length}
          label="Star Members"
          color={colors.orange}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Members</Text>
        {members.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'👥'}</Text>
            <Text style={styles.emptyText}>No members assigned yet</Text>
          </View>
        ) : (
          members.slice(0, 5).map((member: any) => (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>{member.username?.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.username}</Text>
                <Text style={styles.memberRole}>Member</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
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

function StarMembersScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'⭐'}</Text>
      <Text style={styles.placeholderText}>Star Members</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

function DietPlansScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'🥗'}</Text>
      <Text style={styles.placeholderText}>Diet Plans</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

export default function TrainerNavigator() {
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
        component={TrainerHomeScreen}
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
        name="Stars"
        component={StarMembersScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'⭐'}</Text>,
        }}
      />
      <Tab.Screen
        name="Diet"
        component={DietPlansScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'🥗'}</Text>,
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
    backgroundColor: colors.blue,
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  memberInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  memberRole: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
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
