import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogym-v1.replit.dev';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let sessionCookie: string | null = null;

apiClient.interceptors.request.use(async (config) => {
  if (sessionCookie) {
    config.headers.Cookie = sessionCookie;
  }
  
  // Add timezone headers for backend date consistency
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  config.headers['X-Local-Date'] = `${year}-${month}-${day}`;
  config.headers['X-Local-Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      sessionCookie = setCookie[0];
      SecureStore.setItemAsync('session', sessionCookie);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      sessionCookie = null;
      SecureStore.deleteItemAsync('session');
    }
    return Promise.reject(error);
  }
);

export const initSession = async () => {
  const stored = await SecureStore.getItemAsync('session');
  if (stored) {
    sessionCookie = stored;
  }
};

export const clearSession = async () => {
  sessionCookie = null;
  await SecureStore.deleteItemAsync('session');
};
