import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import MemberNavigator from './MemberNavigator';
import TrainerNavigator from './TrainerNavigator';
import OwnerNavigator from './OwnerNavigator';
import LoadingScreen from '../components/LoadingScreen';

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  const getRoleNavigator = () => {
    if (!user) {
      return <AuthNavigator />;
    }

    switch (user.role) {
      case 'owner':
        return <OwnerNavigator />;
      case 'trainer':
        return <TrainerNavigator />;
      case 'member':
      default:
        return <MemberNavigator />;
    }
  };

  return (
    <NavigationContainer>
      {getRoleNavigator()}
    </NavigationContainer>
  );
}
