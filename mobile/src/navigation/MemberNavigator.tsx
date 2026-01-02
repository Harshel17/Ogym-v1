import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import MemberDashboard from '../screens/member/MemberDashboard';
import MyWorkoutScreen from '../screens/member/MyWorkoutScreen';
import AttendanceScreen from '../screens/shared/AttendanceScreen';
import ProfileScreen from '../screens/member/ProfileScreen';
import { colors } from '../utils/colors';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ProgressScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'📊'}</Text>
      <Text style={styles.placeholderText}>Progress</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

function RequestsScreen() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{'📝'}</Text>
      <Text style={styles.placeholderText}>Requests</Text>
      <Text style={styles.placeholderSubtext}>Coming soon</Text>
    </View>
  );
}

export default function MemberNavigator() {
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
        component={MemberDashboard}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'🏠'}</Text>,
        }}
      />
      <Tab.Screen
        name="Workout"
        component={MyWorkoutScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'💪'}</Text>,
        }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'📅'}</Text>,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>{'📊'}</Text>,
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
