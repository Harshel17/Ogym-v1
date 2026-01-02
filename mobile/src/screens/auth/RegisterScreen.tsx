import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, borderRadius } from '../../utils/colors';

type RegisterType = 'owner' | 'join';
type JoinRole = 'trainer' | 'member';

interface Props {
  onNavigateToLogin: () => void;
}

export default function RegisterScreen({ onNavigateToLogin }: Props) {
  const { registerOwner, registerJoin } = useAuth();
  const [registerType, setRegisterType] = useState<RegisterType>('join');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gymName, setGymName] = useState('');
  const [gymCode, setGymCode] = useState('');
  const [joinRole, setJoinRole] = useState<JoinRole>('member');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (registerType === 'owner' && !gymName.trim()) {
      Alert.alert('Error', 'Please enter a gym name');
      return;
    }

    if (registerType === 'join' && !gymCode.trim()) {
      Alert.alert('Error', 'Please enter a gym code');
      return;
    }

    setIsLoading(true);
    try {
      if (registerType === 'owner') {
        await registerOwner({ username: username.trim(), password, gymName: gymName.trim() });
      } else {
        await registerJoin({ username: username.trim(), password, gymCode: gymCode.trim().toUpperCase(), role: joinRole });
      }
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>OGym</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join OGym today</Text>
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, registerType === 'join' && styles.toggleActive]}
            onPress={() => setRegisterType('join')}
          >
            <Text style={[styles.toggleText, registerType === 'join' && styles.toggleTextActive]}>
              Join Gym
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, registerType === 'owner' && styles.toggleActive]}
            onPress={() => setRegisterType('owner')}
          >
            <Text style={[styles.toggleText, registerType === 'owner' && styles.toggleTextActive]}>
              Create Gym
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />
          </View>

          {registerType === 'owner' ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Gym Name</Text>
              <TextInput
                style={styles.input}
                value={gymName}
                onChangeText={setGymName}
                placeholder="Enter your gym name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          ) : (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Gym Code</Text>
                <TextInput
                  style={styles.input}
                  value={gymCode}
                  onChangeText={setGymCode}
                  placeholder="Enter gym code (e.g. DEMO01)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Join As</Text>
                <View style={styles.roleContainer}>
                  <TouchableOpacity
                    style={[styles.roleButton, joinRole === 'member' && styles.roleActive]}
                    onPress={() => setJoinRole('member')}
                  >
                    <Text style={[styles.roleText, joinRole === 'member' && styles.roleTextActive]}>
                      Member
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleButton, joinRole === 'trainer' && styles.roleActive]}
                    onPress={() => setJoinRole('trainer')}
                  >
                    <Text style={[styles.roleText, joinRole === 'trainer' && styles.roleTextActive]}>
                      Trainer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {registerType === 'owner' ? 'Create Gym' : 'Join Gym'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={onNavigateToLogin}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: '#fff',
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleTextActive: {
    color: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.textSecondary,
  },
  footerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
