import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User, LoginData, RegisterOwnerData, RegisterJoinData } from '../api/auth';
import { initSession, clearSession } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  registerOwner: (data: RegisterOwnerData) => Promise<void>;
  registerJoin: (data: RegisterJoinData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      await initSession();
      const currentUser = await authApi.getMe();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginData) => {
    const loggedInUser = await authApi.login(data);
    setUser(loggedInUser);
  };

  const registerOwner = async (data: RegisterOwnerData) => {
    const newUser = await authApi.registerOwner(data);
    setUser(newUser);
  };

  const registerJoin = async (data: RegisterJoinData) => {
    const newUser = await authApi.registerJoin(data);
    setUser(newUser);
  };

  const logout = async () => {
    await authApi.logout();
    await clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, registerOwner, registerJoin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
