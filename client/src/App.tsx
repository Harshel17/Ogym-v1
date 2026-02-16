import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { Loader2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { refreshStatusBar, isIOS, isNative } from "@/lib/capacitor-init";

import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import MembersPage from "@/pages/members-page";
import TrainersPage from "@/pages/trainers-page";
import AttendancePage from "@/pages/attendance-page";
import ProgressPage from "@/pages/progress-page";
import WorkoutHistoryPage from "@/pages/workout-history-page";
import StatsPage from "@/pages/stats-page";
import RequestsPage from "@/pages/requests-page";
import ProfilePage from "@/pages/profile-page";
import MyBodyPage from "@/pages/my-body-page";
import NutritionPage from "@/pages/nutrition-page";
import SportsModePage from "@/pages/sports-mode-page";
import HealthPage from "@/pages/health-page";
import StarMembersPage from "@/pages/star-members-page";
import DietPlansPage from "@/pages/diet-plans-page";
import MyDietPlanPage from "@/pages/my-diet-plan-page";
import WorkoutTemplatesPage from "@/pages/workout-templates-page";
import TransfersPage from "@/pages/transfers-page";
import MissedWorkoutsPage from "@/pages/missed-workouts-page";
import MemberPhasesPage from "@/pages/member-phases-page";
import PhaseDetailPage from "@/pages/phase-detail-page";
import OwnerAttendancePage from "@/pages/owner-attendance-page";
import OwnerMemberDetailPage from "@/pages/owner-member-detail-page";
import OwnerRevenuePage from "@/pages/owner-revenue-page";
import OwnerMemberAnalyticsPage from "@/pages/owner-member-analytics-page";
import OwnerAnnouncementsPage from "@/pages/owner-announcements-page";
import OwnerWalkInVisitorsPage from "@/pages/owner-walk-in-visitors-page";
import OwnerFollowUpsPage from "@/pages/owner-follow-ups-page";
import OwnerKioskPage from "@/pages/owner-kiosk-page";
import OwnerAiInsightsPage from "@/pages/owner-ai-insights-page";
import OwnerAutomatedEmailsPage from "@/pages/owner-automated-emails-page";
import KioskCheckinPage from "@/pages/kiosk-checkin-page";
import AnnouncementsPage from "@/pages/announcements-page";
import GymRequestPage from "@/pages/gym-request-page";
import JoinGymPage from "@/pages/join-gym-page";
import OwnerJoinRequestsPage from "@/pages/owner-join-requests-page";
import AdminLoginPage from "@/pages/admin-login-page";
import PendingApprovalPage from "@/pages/pending-approval-page";
import FeedPage from "@/pages/feed-page";
import TournamentsPage from "@/pages/tournaments-page";
import MemberOnboardingPage from "@/pages/member-onboarding-page";
import PersonalOnboardingPage from "@/pages/personal-onboarding-page";
import SupportPage from "@/pages/support-page";
import HelpPage from "@/pages/help-page";
import TermsPage from "@/pages/terms-page";
import PrivacyPage from "@/pages/privacy-page";
import DeleteAccountPage from "@/pages/delete-account-page";
import SubscriptionExpiredPage from "@/pages/subscription-expired-page";
import WeeklyReportPage from "@/pages/weekly-report-page";
import DikaPage from "@/pages/dika-page";
import DikaWebPage from "@/pages/dika-web-page";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { SwipeNavigationProvider } from "@/hooks/use-swipe-navigation";

const PaymentsPage = lazy(() => import("@/pages/payments-page"));
const TrainerWorkoutPage = lazy(() => import("@/pages/trainer-workout-page"));
const MemberWorkoutPage = lazy(() => import("@/pages/member-workout-page"));
const StarMemberDetailPage = lazy(() => import("@/pages/star-member-detail-page"));
const AdminDashboardPage = lazy(() => import("@/pages/admin-dashboard-page"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

type ProtectedRouteProps = {
  component: React.ComponentType;
  allowWithoutGym?: boolean;
  allowWithoutOnboarding?: boolean;
  allowWithExpiredSubscription?: boolean;
  requiredRole?: "owner" | "trainer" | "member";
  blockOnIOSOwner?: boolean;
};

function ProtectedRoute({ component: Component, allowWithoutGym = false, allowWithoutOnboarding = false, allowWithExpiredSubscription = false, requiredRole, blockOnIOSOwner = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Block owner access to business/payment pages on iOS native app (Apple Guideline 3.1.1)
  if (blockOnIOSOwner && user.role === "owner" && isNative() && isIOS()) {
    return <Redirect to="/" />;
  }

  // Role guard - redirect if user doesn't have required role
  if (requiredRole && user.role !== requiredRole) {
    return <Redirect to="/" />;
  }

  // Redirect users without gym to appropriate page (except for specific allowed routes)
  if (!user.gymId && !allowWithoutGym) {
    // Owners without gym should go to gym-request page
    if (user.role === "owner") {
      return <Redirect to="/gym-request" />;
    }
    // Trainers without gym go to pending approval (they need gym approval)
    if (user.role === "trainer") {
      return <PendingApprovalPage />;
    }
    // Members without gym are in Personal Mode - they can access personal dashboard
    // Note: The Dashboard route has allowWithoutGym=true for members
  }

  // Check subscription status - block access if expired (unless explicitly allowed)
  if (user.gymId && !allowWithExpiredSubscription && user.subscriptionStatus) {
    const { isActive, status } = user.subscriptionStatus;
    if (!isActive && (status === "expired" || status === "no_subscription")) {
      return <SubscriptionExpiredPage />;
    }
  }

  // Redirect members who haven't completed onboarding (both gym and personal mode)
  if (user.role === "member" && !user.onboardingCompleted && !allowWithoutOnboarding) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </Layout>
  );
}

function TokenAuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [tokenState, setTokenState] = useState<"checking" | "confirming" | "logging_in" | "done" | "error">("checking");
  const [tokenUser, setTokenUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [tokenValue, setTokenValue] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const verifyToken = useCallback(async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setTokenState("done");
      return;
    }
    setTokenValue(token);
    try {
      const res = await fetch("/api/auth/token-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json();
        setTokenUser(data);
        setTokenState("confirming");
      } else {
        setTokenState("error");
      }
    } catch {
      setTokenState("error");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token")) {
      verifyToken();
    } else {
      setTokenState("done");
    }
  }, [verifyToken]);

  const confirmLogin = useCallback(async () => {
    if (!tokenValue) return;
    setTokenState("logging_in");
    try {
      const res = await fetch("/api/auth/token-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tokenValue }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        window.history.replaceState({}, "", "/dika-web");
        setTokenState("done");
      } else {
        setTokenState("error");
      }
    } catch {
      setTokenState("error");
    }
  }, [tokenValue]);

  if (tokenState === "checking" || tokenState === "logging_in") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b1220]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (tokenState === "confirming" && tokenUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b1220]">
        <div className="bg-[#131c2e] border border-slate-700/50 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">{tokenUser.username.charAt(0).toUpperCase()}</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">Welcome back!</h2>
          <p className="text-slate-400 mb-6">
            Continue as <span className="text-amber-400 font-medium">{tokenUser.username}</span>?
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={confirmLogin}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:opacity-90 transition-opacity"
              data-testid="button-confirm-token-login"
            >
              Continue
            </button>
            <button
              onClick={() => {
                window.history.replaceState({}, "", "/dika-web");
                navigate("/auth");
              }}
              className="w-full py-3 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
              data-testid="button-switch-account"
            >
              Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (tokenState === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0b1220]">
        <div className="bg-[#131c2e] border border-slate-700/50 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-red-400">!</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Link expired</h2>
          <p className="text-slate-400 mb-6">This login link has expired. Please try again from the app or sign in below.</p>
          <button
            onClick={() => {
              window.history.replaceState({}, "", "/dika-web");
              navigate("/auth");
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium hover:opacity-90 transition-opacity"
            data-testid="button-go-to-login"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

function OnboardingRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Only members need onboarding
  if (user.role !== "member") {
    return <Redirect to="/" />;
  }

  // If already completed, redirect to dashboard
  if (user.onboardingCompleted) {
    return <Redirect to="/" />;
  }

  // Personal Mode members (no gym) get optional body measurements onboarding
  if (!user.gymId) {
    return <PersonalOnboardingPage />;
  }

  // Gym members get full onboarding
  return <MemberOnboardingPage />;
}

function RouteChangeHandler() {
  const [location] = useLocation();
  
  useEffect(() => {
    refreshStatusBar();
  }, [location]);
  
  return null;
}

function Router() {
  return (
    <>
    <RouteChangeHandler />
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <Route path="/onboarding">
        <OnboardingRoute />
      </Route>
      
      <Route path="/">
        <ProtectedRoute component={DashboardPage} allowWithoutGym={true} />
      </Route>
      
      <Route path="/members">
        <ProtectedRoute component={MembersPage} />
      </Route>

      <Route path="/trainers">
        <ProtectedRoute component={TrainersPage} />
      </Route>
      
      <Route path="/attendance">
        <ProtectedRoute component={AttendancePage} />
      </Route>
      
      <Route path="/payments">
        <ProtectedRoute component={PaymentsPage} blockOnIOSOwner />
      </Route>

      <Route path="/workouts">
        <ProtectedRoute component={TrainerWorkoutPage} />
      </Route>

      <Route path="/my-workout">
        <ProtectedRoute component={MemberWorkoutPage} allowWithoutGym={true} />
      </Route>

      <Route path="/my-workouts">
        <ProtectedRoute component={MemberWorkoutPage} allowWithoutGym={true} />
      </Route>

      <Route path="/dika">
        <ProtectedRoute component={DikaPage} allowWithoutGym={true} />
      </Route>

      <Route path="/dika-web">
        <TokenAuthRoute component={DikaWebPage} />
      </Route>

      <Route path="/progress">
        <ProtectedRoute component={ProgressPage} allowWithoutGym={true} />
      </Route>

      <Route path="/progress/workouts">
        <ProtectedRoute component={WorkoutHistoryPage} allowWithoutGym={true} />
      </Route>

      <Route path="/progress/stats">
        <ProtectedRoute component={StatsPage} allowWithoutGym={true} />
      </Route>

      <Route path="/stats">
        <ProtectedRoute component={StatsPage} allowWithoutGym={true} />
      </Route>

      <Route path="/progress/missed">
        <ProtectedRoute component={MissedWorkoutsPage} allowWithoutGym={true} />
      </Route>

      <Route path="/progress/phases">
        <ProtectedRoute component={MemberPhasesPage} requiredRole="member" allowWithoutGym={true} />
      </Route>

      <Route path="/progress/phases/:phaseId">
        <ProtectedRoute component={PhaseDetailPage} allowWithoutGym={true} />
      </Route>

      <Route path="/requests">
        <ProtectedRoute component={RequestsPage} />
      </Route>

      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} allowWithoutGym={true} />
      </Route>

      <Route path="/my-body">
        <ProtectedRoute component={MyBodyPage} requiredRole="member" allowWithoutGym={true} />
      </Route>

      <Route path="/nutrition">
        <ProtectedRoute component={NutritionPage} requiredRole="member" allowWithoutGym={true} />
      </Route>

      <Route path="/sports-mode">
        <ProtectedRoute component={SportsModePage} requiredRole="member" allowWithoutGym={true} />
      </Route>

      <Route path="/health">
        <ProtectedRoute component={HealthPage} requiredRole="member" allowWithoutGym={true} />
      </Route>

      <Route path="/star-members/:memberId">
        <ProtectedRoute component={StarMemberDetailPage} />
      </Route>

      <Route path="/star-members">
        <ProtectedRoute component={StarMembersPage} />
      </Route>

      <Route path="/diet-plans">
        <ProtectedRoute component={DietPlansPage} />
      </Route>

      <Route path="/templates">
        <ProtectedRoute component={WorkoutTemplatesPage} requiredRole="trainer" />
      </Route>

      <Route path="/my-diet-plan">
        <ProtectedRoute component={MyDietPlanPage} />
      </Route>

      <Route path="/transfers">
        <ProtectedRoute component={TransfersPage} blockOnIOSOwner />
      </Route>

      <Route path="/owner/attendance">
        <ProtectedRoute component={OwnerAttendancePage} requiredRole="owner" />
      </Route>

      <Route path="/owner/members/:memberId">
        <ProtectedRoute component={OwnerMemberDetailPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/revenue">
        <ProtectedRoute component={OwnerRevenuePage} requiredRole="owner" blockOnIOSOwner />
      </Route>

      <Route path="/owner/member-analytics">
        <ProtectedRoute component={OwnerMemberAnalyticsPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/announcements">
        <ProtectedRoute component={OwnerAnnouncementsPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/walk-in-visitors">
        <ProtectedRoute component={OwnerWalkInVisitorsPage} requiredRole="owner" blockOnIOSOwner />
      </Route>

      <Route path="/owner/follow-ups">
        <ProtectedRoute component={OwnerFollowUpsPage} requiredRole="owner" blockOnIOSOwner />
      </Route>

      <Route path="/owner/kiosk">
        <ProtectedRoute component={OwnerKioskPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/ai-insights">
        <ProtectedRoute component={OwnerAiInsightsPage} requiredRole="owner" blockOnIOSOwner />
      </Route>

      <Route path="/owner/automated-emails">
        <ProtectedRoute component={OwnerAutomatedEmailsPage} requiredRole="owner" blockOnIOSOwner />
      </Route>

      <Route path="/checkin/:token" component={KioskCheckinPage} />
      <Route path="/kiosk/:token" component={KioskCheckinPage} />

      <Route path="/announcements">
        <ProtectedRoute component={AnnouncementsPage} />
      </Route>

      <Route path="/feed">
        <ProtectedRoute component={FeedPage} />
      </Route>

      <Route path="/tournaments">
        <ProtectedRoute component={TournamentsPage} />
      </Route>

      <Route path="/support">
        <ProtectedRoute component={SupportPage} allowWithoutGym={true} allowWithoutOnboarding={true} allowWithExpiredSubscription={true} />
      </Route>

      <Route path="/help">
        <ProtectedRoute component={HelpPage} allowWithoutGym={true} allowWithoutOnboarding={true} allowWithExpiredSubscription={true} />
      </Route>

      <Route path="/subscription-expired">
        <ProtectedRoute component={SubscriptionExpiredPage} allowWithExpiredSubscription={true} />
      </Route>

      <Route path="/gym-request">
        <ProtectedRoute component={GymRequestPage} allowWithoutGym={true} requiredRole="owner" />
      </Route>

      <Route path="/join-gym">
        <ProtectedRoute component={JoinGymPage} allowWithoutGym={true} />
      </Route>

      <Route path="/owner/join-requests">
        <ProtectedRoute component={OwnerJoinRequestsPage} requiredRole="owner" />
      </Route>

      <Route path="/admin" component={AdminLoginPage} />
      <Route path="/admin/dashboard">
        <Suspense fallback={<PageLoader />}>
          <AdminDashboardPage />
        </Suspense>
      </Route>

      <Route path="/report/:token" component={WeeklyReportPage} />

      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/delete-account" component={DeleteAccountPage} />

      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <SwipeNavigationProvider>
              <Router />
            </SwipeNavigationProvider>
            <Toaster />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
