import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
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
import StarMembersPage from "@/pages/star-members-page";
import StarMemberDetailPage from "@/pages/star-member-detail-page";
import DietPlansPage from "@/pages/diet-plans-page";
import MyDietPlanPage from "@/pages/my-diet-plan-page";
import TransfersPage from "@/pages/transfers-page";
import MissedWorkoutsPage from "@/pages/missed-workouts-page";
import OwnerAttendancePage from "@/pages/owner-attendance-page";
import OwnerMemberDetailPage from "@/pages/owner-member-detail-page";
import OwnerAnnouncementsPage from "@/pages/owner-announcements-page";
import AnnouncementsPage from "@/pages/announcements-page";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
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

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
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

      <Route path="/progress/missed">
        <ProtectedRoute component={MissedWorkoutsPage} />
      </Route>

      <Route path="/requests">
        <ProtectedRoute component={RequestsPage} />
      </Route>

      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
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

      <Route path="/my-diet-plan">
        <ProtectedRoute component={MyDietPlanPage} />
      </Route>

      <Route path="/transfers">
        <ProtectedRoute component={TransfersPage} />
      </Route>

      <Route path="/owner/attendance">
        <ProtectedRoute component={OwnerAttendancePage} />
      </Route>

      <Route path="/owner/members/:memberId">
        <ProtectedRoute component={OwnerMemberDetailPage} />
      </Route>

      <Route path="/owner/announcements">
        <ProtectedRoute component={OwnerAnnouncementsPage} />
      </Route>

      <Route path="/announcements">
        <ProtectedRoute component={AnnouncementsPage} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
