import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function SubscriptionExpiredPage() {
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Subscription Expired</CardTitle>
          <CardDescription>
            Your gym's subscription has expired. Access to the app is temporarily disabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">What this means:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• You and your gym members cannot access the app</li>
              <li>• Your data is safe and will be restored when renewed</li>
              <li>• Please contact OGym support to renew your subscription</li>
            </ul>
          </div>

          {user?.role === "owner" ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-center">Contact OGym to renew:</p>
              <div className="flex flex-col gap-2">
                <a 
                  href="mailto:billing@ogym.fitness?subject=Subscription Renewal Request"
                  className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                  data-testid="link-email-billing"
                >
                  <Mail className="w-4 h-4" />
                  billing@ogym.fitness
                </a>
                <a 
                  href="mailto:support@ogym.fitness"
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-email-support"
                >
                  <Mail className="w-4 h-4" />
                  General support: support@ogym.fitness
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Please contact your gym owner to renew the subscription.
              </p>
            </div>
          )}

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
