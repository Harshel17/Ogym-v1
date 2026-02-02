import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Building2, CheckCircle2, XCircle, Loader2, LogOut, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { isIOS, isNative } from "@/lib/capacitor-init";

// Helper: Check if we're running on iOS native app (not web)
const isIOSNativeApp = () => isNative() && isIOS();

type GymRequest = {
  id: number;
  gymName: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type JoinRequest = {
  id: number;
  gymId: number;
  gymName: string;
  gymCode: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};

export default function PendingApprovalPage() {
  const { user, logoutMutation } = useAuth();

  const { data: gymRequest, isLoading: isLoadingGymRequest } = useQuery<GymRequest | null>({
    queryKey: ["/api/gym-requests/my"],
    enabled: user?.role === "owner"
  });

  const { data: joinRequest, isLoading: isLoadingJoinRequest } = useQuery<JoinRequest | null>({
    queryKey: ["/api/join-requests/my"],
    enabled: user?.role === "trainer" || user?.role === "member"
  });

  const isLoading = isLoadingGymRequest || isLoadingJoinRequest;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = user?.role === "owner";
  const request = isOwner ? gymRequest : joinRequest;
  const isPending = request?.status === "pending";
  const isRejected = request?.status === "rejected";
  const isApproved = request?.status === "approved";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display">OGym</h1>
          <p className="text-muted-foreground mt-1">Welcome, {user?.username}</p>
        </div>

        {isPending && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                <Clock className="w-12 h-12 text-yellow-500" />
              </div>
              <CardTitle>Awaiting Approval</CardTitle>
              <CardDescription>
                {isOwner 
                  ? "Your gym registration request is being reviewed by our team."
                  : `Your request to join ${(joinRequest as JoinRequest)?.gymName} is being reviewed by the gym owner.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {isOwner ? "Gym Name" : "Gym"}
                </span>
                <span className="font-medium">
                  {isOwner ? (gymRequest as GymRequest)?.gymName : (joinRequest as JoinRequest)?.gymName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="secondary">Pending</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span className="text-sm">{new Date(request?.createdAt || "").toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-center text-muted-foreground pt-4">
                You'll be notified once your request is reviewed. Check back later!
              </p>
            </CardContent>
          </Card>
        )}

        {isRejected && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <CardTitle>Request Rejected</CardTitle>
              <CardDescription>
                {isOwner 
                  ? `Your gym registration for "${(gymRequest as GymRequest)?.gymName}" was not approved.`
                  : `Your request to join ${(joinRequest as JoinRequest)?.gymName} was not approved.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(gymRequest as GymRequest)?.adminNotes && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Reason: {(gymRequest as GymRequest)?.adminNotes}
                  </p>
                </div>
              )}
              {/* Hide resubmit button on iOS native app for owners per Apple Guideline 3.1.1 */}
              {isOwner && isIOSNativeApp() ? (
                <p className="text-sm text-center text-muted-foreground">
                  Gym owner accounts are created outside the app. Existing accounts can sign in.
                </p>
              ) : (
                <>
                  <p className="text-sm text-center text-muted-foreground">
                    You can submit a new request with updated information.
                  </p>
                  <Link href={isOwner ? "/gym-request" : "/join-gym"}>
                    <Button className="w-full" data-testid="button-resubmit-request">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Submit New Request
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isApproved && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <CardTitle>Request Approved!</CardTitle>
              <CardDescription>
                {isOwner 
                  ? "Your gym has been created! Please refresh the page to continue."
                  : "You have been added to the gym! Please refresh the page to continue."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => window.location.reload()}
                data-testid="button-refresh"
              >
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        )}

        {!request && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>No Pending Request</CardTitle>
              <CardDescription>
                {isOwner 
                  ? (isIOSNativeApp() 
                      ? "Gym owner accounts are created outside the app. Existing accounts can sign in."
                      : "You haven't submitted a gym registration request yet.")
                  : "You haven't submitted a request to join a gym yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Hide gym registration button on iOS native app per Apple Guideline 3.1.1 */}
              {!(isOwner && isIOSNativeApp()) && (
                <Link href={isOwner ? "/gym-request" : "/join-gym"}>
                  <Button className="w-full" data-testid="button-submit-request">
                    {isOwner ? "Register Your Gym" : "Join a Gym"}
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => logoutMutation.mutate()}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
