import { apiClient } from './client';

export interface User {
  id: number;
  publicId: string | null;
  gymId: number | null;
  username: string;
  role: 'owner' | 'trainer' | 'member';
  email: string | null;
  phone: string | null;
  gym?: {
    id: number;
    name: string;
    code: string;
  } | null;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterOwnerData {
  username: string;
  password: string;
  gymName: string;
}

export interface RegisterJoinData {
  username: string;
  password: string;
  gymCode: string;
  role: 'trainer' | 'member';
}

export const authApi = {
  async login(data: LoginData): Promise<User> {
    const response = await apiClient.post('/api/auth/login', data);
    return response.data;
  },

  async registerOwner(data: RegisterOwnerData): Promise<User> {
    const response = await apiClient.post('/api/auth/register-owner', data);
    return response.data;
  },

  async registerJoin(data: RegisterJoinData): Promise<User> {
    const response = await apiClient.post('/api/auth/register-join', data);
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/api/auth/logout');
  },

  async getMe(): Promise<User | null> {
    try {
      const response = await apiClient.get('/api/auth/me');
      return response.data;
    } catch {
      return null;
    }
  },
};
