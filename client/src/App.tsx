import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Layout } from "@/components/layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { Loader2 } from "lucide-react";
import { useEffect, lazy, Suspense } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";

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
import SubscriptionExpiredPage from "@/pages/subscription-expired-page";
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
};

function ProtectedRoute({ component: Component, allowWithoutGym = false, allowWithoutOnboarding = false, allowWithExpiredSubscription = false, requiredRole }: ProtectedRouteProps) {
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

function Router() {
  return (
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
        <ProtectedRoute component={PaymentsPage} />
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
        <ProtectedRoute component={TransfersPage} />
      </Route>

      <Route path="/owner/attendance">
        <ProtectedRoute component={OwnerAttendancePage} requiredRole="owner" />
      </Route>

      <Route path="/owner/members/:memberId">
        <ProtectedRoute component={OwnerMemberDetailPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/revenue">
        <ProtectedRoute component={OwnerRevenuePage} requiredRole="owner" />
      </Route>

      <Route path="/owner/member-analytics">
        <ProtectedRoute component={OwnerMemberAnalyticsPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/announcements">
        <ProtectedRoute component={OwnerAnnouncementsPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/walk-in-visitors">
        <ProtectedRoute component={OwnerWalkInVisitorsPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/follow-ups">
        <ProtectedRoute component={OwnerFollowUpsPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/kiosk">
        <ProtectedRoute component={OwnerKioskPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/ai-insights">
        <ProtectedRoute component={OwnerAiInsightsPage} requiredRole="owner" />
      </Route>

      <Route path="/owner/automated-emails">
        <ProtectedRoute component={OwnerAutomatedEmailsPage} requiredRole="owner" />
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

      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const configureStatusBar = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.setStyle({ style: Style.Dark });
          if (Capacitor.getPlatform() === 'android') {
            await StatusBar.setBackgroundColor({ color: '#00000000' });
          }
        } catch (error) {
          console.log('StatusBar configuration error:', error);
        }
      }
    };
    configureStatusBar();
  }, []);

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
