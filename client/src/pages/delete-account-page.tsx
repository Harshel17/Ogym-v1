import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2, Loader2, AlertTriangle, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { isNative, isIOS } from "@/lib/capacitor-init";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function DeleteAccountPage() {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isIOSNativeApp = isNative() && isIOS();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [deleted, setDeleted] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/users/me");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete account");
      }
      return res.json();
    },
    onSuccess: () => {
      setDeleted(true);
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete account",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleDelete = () => {
    if (confirmText.toLowerCase() === "delete") {
      deleteMutation.mutate();
    }
  };

  if (deleted) {
    return (
      <div className="h-full overflow-y-auto bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Account Deleted</CardTitle>
              <CardDescription>
                Your account and all associated data have been permanently deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => setLocation("/auth")} data-testid="button-go-login">
                <LogIn className="w-4 h-4 mr-2" />
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full overflow-y-auto bg-background p-4 md:p-8">
        <div className="max-w-2xl mx-auto mt-12">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">Delete Your Account</CardTitle>
              <CardDescription>
                You need to be logged in to delete your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => setLocation("/auth")} data-testid="button-login-to-delete">
                <LogIn className="w-4 h-4 mr-2" />
                Log In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto pb-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Your Account
            </CardTitle>
            <CardDescription>
              Request permanent deletion of your OGym account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">This action is permanent and cannot be undone</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Deleting your account will permanently remove:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>Your profile and account information</li>
                    <li>All workout history and progress data</li>
                    {!isIOSNativeApp && <li>Payment records and subscription details</li>}
                    <li>Posts, comments, and social interactions</li>
                    <li>Body measurements and nutrition logs</li>
                    <li>Fitness goals and health data</li>
                    <li>Chat history with Dika AI assistant</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Data retention:</strong> After deletion, your data will be permanently removed from our systems 
                within 90 days. Some anonymized data may be retained for legal or analytical purposes as described in 
                our <a href="/privacy" className="underline">Privacy Policy</a>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-delete">Type "delete" to confirm account deletion</Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="delete"
                data-testid="input-confirm-delete"
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmText.toLowerCase() !== "delete" || deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Permanently Delete My Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
