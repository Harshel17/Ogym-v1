import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { getTimezoneHeaders } from "./timezone";

const MOBILE_TOKEN_KEY = "ogym_mobile_token";

export function getMobileToken(): string | null {
  try {
    return localStorage.getItem(MOBILE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setMobileToken(token: string) {
  try {
    localStorage.setItem(MOBILE_TOKEN_KEY, token);
  } catch {}
}

export function clearMobileToken() {
  try {
    localStorage.removeItem(MOBILE_TOKEN_KEY);
  } catch {}
}

export const isNativeApp = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

export const API_BASE_URL = isNativeApp
  ? "https://app.ogym.fitness"
  : (import.meta.env.VITE_API_BASE_URL || "");

function getMobileHeaders(): Record<string, string> {
  if (!isNativeApp) return {};
  const headers: Record<string, string> = {
    "X-Mobile-App": "true",
  };
  const token = getMobileToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function getNetworkErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    if (!navigator.onLine) {
      return "You appear to be offline. Please check your internet connection.";
    }
    return "Unable to connect to the server. Please try again.";
  }
  return (error as Error).message || "An unexpected error occurred.";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const friendlyMessages: Record<number, string> = {
      400: "Invalid request. Please check your input.",
      401: "Please log in to continue.",
      403: "You don't have permission to do this.",
      404: "The requested resource was not found.",
      429: "Too many requests. Please wait and try again.",
      500: "Server error. Please try again later.",
      502: "Server is temporarily unavailable. Please try again.",
      503: "Service unavailable. Please try again later.",
    };
    const message = friendlyMessages[res.status] || text;
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getTimezoneHeaders(),
    ...getMobileHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {})
  };
  
  try {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: isNativeApp ? "omit" : "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    throw new Error(getNetworkErrorMessage(error));
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const url = `${API_BASE_URL}${queryKey.join("/")}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(url, {
        credentials: isNativeApp ? "omit" : "include",
        headers: {
          ...getTimezoneHeaders(),
          ...getMobileHeaders(),
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error("Request timed out. Please try again.");
      }
      throw new Error(getNetworkErrorMessage(error));
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const message = (error as Error).message || '';
        return message.includes('timeout') || message.includes('connect') || message.includes('network');
      },
      retryDelay: 1000,
    },
    mutations: {
      retry: false,
    },
  },
});
