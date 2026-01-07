import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogym-v1.replit.dev';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let sessionCookie: string | null = null;

function getNetworkErrorMessage(error: AxiosError): string {
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }
  if (error.code === 'ERR_NETWORK' || !error.response) {
    return 'Unable to connect to the server. Please check your internet connection.';
  }
  const status = error.response?.status;
  const friendlyMessages: Record<number, string> = {
    400: 'Invalid request. Please check your input.',
    401: 'Please log in to continue.',
    403: "You don't have permission to do this.",
    404: 'The requested resource was not found.',
    429: 'Too many requests. Please wait and try again.',
    500: 'Server error. Please try again later.',
    502: 'Server is temporarily unavailable. Please try again.',
    503: 'Service unavailable. Please try again later.',
  };
  return friendlyMessages[status || 0] || error.message || 'An unexpected error occurred.';
}

apiClient.interceptors.request.use(async (config) => {
  if (sessionCookie) {
    config.headers.Cookie = sessionCookie;
  }
  
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
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      sessionCookie = null;
      await SecureStore.deleteItemAsync('session');
    }
    
    return Promise.reject(new Error(getNetworkErrorMessage(error)));
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
