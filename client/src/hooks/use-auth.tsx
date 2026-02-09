import { createContext, ReactNode, useContext, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Gym } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

type SubscriptionStatus = {
  isActive: boolean;
  status: "active" | "expired" | "pending" | "no_subscription";
  validUntil: string | null;
  daysRemaining: number | null;
};

type AuthUser = User & { 
  gym?: Gym | null;
  subscriptionStatus?: SubscriptionStatus | null;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  error: Error | null;
  pendingVerification: { email: string } | null;
  setPendingVerification: (data: { email: string } | null) => void;
  loginMutation: ReturnType<typeof useLoginMutation>;
  logoutMutation: ReturnType<typeof useLogoutMutation>;
  registerMutation: ReturnType<typeof useRegisterMutation>;
  verifyEmailMutation: ReturnType<typeof useVerifyEmailMutation>;
  resendCodeMutation: ReturnType<typeof useResendCodeMutation>;
  forgotPasswordMutation: ReturnType<typeof useForgotPasswordMutation>;
  resetPasswordMutation: ReturnType<typeof useResetPasswordMutation>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const loginInput = z.object({
  email: z.string().email(),
  password: z.string(),
});

const registerInput = z.object({
  username: z.string().min(4).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string(),
  role: z.enum(["owner", "trainer", "member"]),
  gymCode: z.string().optional(),
});

const verifyEmailInput = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const resendCodeInput = z.object({
  email: z.string().email(),
});

const forgotPasswordInput = z.object({
  email: z.string().email(),
});

const resetPasswordInput = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, "Must contain at least 1 letter and 1 number"),
});

function useLoginMutation(setPendingVerification: (data: { email: string } | null) => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (credentials: z.infer<typeof loginInput>) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.requiresVerification) {
          return { requiresVerification: true, email: data.email, message: data.message };
        }
        throw new Error(data.message || "Login failed");
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.requiresVerification) {
        setPendingVerification({ email: data.email });
        toast({
          title: "Verification Required",
          description: data.message,
        });
        return;
      }
      queryClient.setQueryData(["/api/auth/me"], data);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.email || data.username}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useRegisterMutation(setPendingVerification: (data: { email: string } | null) => void) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof registerInput>) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Registration failed");
      }
      return result;
    },
    onSuccess: (result) => {
      if (result.requiresVerification) {
        setPendingVerification({ email: result.email });
        toast({
          title: "Check Your Email",
          description: "A verification code has been sent to your email.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useVerifyEmailMutation(setPendingVerification: (data: { email: string } | null) => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof verifyEmailInput>) => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Verification failed");
      }
      return result;
    },
    onSuccess: (result) => {
      setPendingVerification(null);
      if (result.user) {
        queryClient.setQueryData(["/api/auth/me"], result.user);
      }
      toast({
        title: "Email Verified!",
        description: "Welcome to OGym!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useResendCodeMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof resendCodeInput>) => {
      const res = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Failed to resend code");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Code Sent",
        description: "A new verification code has been sent to your email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resend code",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useForgotPasswordMutation() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof forgotPasswordInput>) => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Failed to send reset code");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Code Sent",
        description: "If an account exists, a reset code has been sent to your email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useResetPasswordMutation(onSuccess?: () => void) {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof resetPasswordInput>) => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Password reset failed");
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Password Reset",
        description: "Your password has been reset. You can now log in.",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

function useLogoutMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
      toast({
        title: "Logged out",
        description: "See you next time!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [pendingVerification, setPendingVerification] = useState<{ email: string } | null>(null);

  const {
    data: user,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const loginMutation = useLoginMutation(setPendingVerification);
  const logoutMutation = useLogoutMutation();
  const registerMutation = useRegisterMutation(setPendingVerification);
  const verifyEmailMutation = useVerifyEmailMutation(setPendingVerification);
  const resendCodeMutation = useResendCodeMutation();
  const forgotPasswordMutation = useForgotPasswordMutation();
  const resetPasswordMutation = useResetPasswordMutation();

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error: error as Error | null,
        pendingVerification,
        setPendingVerification,
        loginMutation,
        logoutMutation,
        registerMutation,
        verifyEmailMutation,
        resendCodeMutation,
        forgotPasswordMutation,
        resetPasswordMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
