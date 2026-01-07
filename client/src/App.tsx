import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Layout } from "@/components/layout";
import { Loader2 } from "lucide-react";

import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import MembersPage from "@/pages/members-page";
import TrainersPage from "@/pages/trainers-page";
import AttendancePage from "@/pages/attendance-page";
import PaymentsPage from "@/pages/payments-page";
import TrainerWorkoutPage from "@/pages/trainer-workout-page";
import MemberWorkoutPage from "@/pages/member-workout-page";
import ProgressPage from "@/pages/progress-page";
import WorkoutHistoryPage from "@/pages/workout-history-page";
import StatsPage from "@/pages/stats-page";
import RequestsPage from "@/pages/requests-page";
import ProfilePage from "@/pages/profile-page";
import MyBodyPage from "@/pages/my-body-page";
import StarMembersPage from "@/pages/star-members-page";
import StarMemberDetailPage from "@/pages/star-member-detail-page";
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
import AnnouncementsPage from "@/pages/announcements-page";
import GymRequestPage from "@/pages/gym-request-page";
import JoinGymPage from "@/pages/join-gym-page";
import OwnerJoinRequestsPage from "@/pages/owner-join-requests-page";
import AdminLoginPage from "@/pages/admin-login-page";
import AdminDashboardPage from "@/pages/admin-dashboard-page";
import PendingApprovalPage from "@/pages/pending-approval-page";
import FeedPage from "@/pages/feed-page";
import TournamentsPage from "@/pages/tournaments-page";
import MemberOnboardingPage from "@/pages/member-onboarding-page";
import SupportPage from "@/pages/support-page";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";

type ProtectedRouteProps = {
  component: React.ComponentType;
  allowWithoutGym?: boolean;
  allowWithoutOnboarding?: boolean;
  requiredRole?: "owner" | "trainer" | "member";
};

function ProtectedRoute({ component: Component, allowWithoutGym = false, allowWithoutOnboarding = false, requiredRole }: ProtectedRouteProps) {
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
    // Trainers/members without gym go to pending approval
    return <PendingApprovalPage />;
  }

  // Redirect members who haven't completed onboarding
  if (user.role === "member" && user.gymId && !user.onboardingCompleted && !allowWithoutOnboarding) {
    return <Redirect to="/onboarding" />;
  }

  return (
    <Layout>
      <Component />
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

  // If no gym yet, redirect to pending approval
  if (!user.gymId) {
    return <PendingApprovalPage />;
  }

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
        <ProtectedRoute component={DashboardPage} />
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
        <ProtectedRoute component={MemberWorkoutPage} />
      </Route>

      <Route path="/progress">
        <ProtectedRoute component={ProgressPage} />
      </Route>

      <Route path="/progress/workouts">
        <ProtectedRoute component={WorkoutHistoryPage} />
      </Route>

      <Route path="/progress/stats">
        <ProtectedRoute component={StatsPage} />
      </Route>

      <Route path="/stats">
        <ProtectedRoute component={StatsPage} />
      </Route>

      <Route path="/progress/missed">
        <ProtectedRoute component={MissedWorkoutsPage} />
      </Route>

      <Route path="/progress/phases">
        <ProtectedRoute component={MemberPhasesPage} requiredRole="member" />
      </Route>

      <Route path="/progress/phases/:phaseId">
        <ProtectedRoute component={PhaseDetailPage} />
      </Route>

      <Route path="/requests">
        <ProtectedRoute component={RequestsPage} />
      </Route>

      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>

      <Route path="/my-body">
        <ProtectedRoute component={MyBodyPage} requiredRole="member" />
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
        <ProtectedRoute component={SupportPage} allowWithoutGym={true} allowWithoutOnboarding={true} />
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
      <Route path="/admin/dashboard" component={AdminDashboardPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
