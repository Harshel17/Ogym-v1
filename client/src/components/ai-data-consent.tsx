import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Brain, Lock, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function useAiConsent() {
  const { user } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const hasConsent = user?.aiDataConsent === true;

  const requireConsent = (action: () => void) => {
    if (hasConsent) {
      action();
    } else {
      setPendingAction(() => action);
      setShowDialog(true);
    }
  };

  const onConsentGranted = () => {
    setShowDialog(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const onConsentDenied = () => {
    setShowDialog(false);
    setPendingAction(null);
  };

  return { hasConsent, requireConsent, showDialog, setShowDialog, onConsentGranted, onConsentDenied };
}

export function AiDataConsentDialog({
  open,
  onConsentGranted,
  onConsentDenied,
}: {
  open: boolean;
  onConsentGranted: () => void;
  onConsentDenied: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const consentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-consent", { consent: true });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      onConsentGranted();
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onConsentDenied(); }}>
      <DialogContent className="max-w-md mx-4" data-testid="ai-consent-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <DialogTitle className="text-lg">AI Features - Data Sharing</DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3">
            <p>
              OGym uses AI-powered features to enhance your fitness experience. Before using them, we want you to know how your data is handled.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Brain className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">What data is shared</p>
                <p className="text-xs text-muted-foreground mt-1">
                  When you use AI features (Dika Assistant, photo food logging, AI workout plans, sports training), your messages, food photos, workout data, and nutrition info are sent to process your requests.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <ExternalLink className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Who receives the data</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your data is sent to OpenAI (the company behind ChatGPT) for AI processing. OpenAI processes the data according to their{" "}
                  <a
                    href="https://openai.com/policies/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                    data-testid="link-openai-privacy"
                  >
                    privacy policy
                  </a>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Lock className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm">How your data is protected</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Data is transmitted securely via encrypted connections. We only send the minimum data needed for each AI feature. Your data is not used to train AI models.
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            You can use OGym without AI features. You can change this setting anytime from your profile.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onConsentDenied}
              data-testid="button-decline-ai"
            >
              Not Now
            </Button>
            <Button
              className="flex-1"
              onClick={() => consentMutation.mutate()}
              disabled={consentMutation.isPending}
              data-testid="button-accept-ai"
            >
              {consentMutation.isPending ? "Saving..." : "I Agree"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
