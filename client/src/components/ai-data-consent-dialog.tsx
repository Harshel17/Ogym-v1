import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, Eye, Server, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface AiDataConsentDialogProps {
  open: boolean;
  onConsentGranted: () => void;
  onDeclined: () => void;
}

export function AiDataConsentDialog({ open, onConsentGranted, onDeclined }: AiDataConsentDialogProps) {
  const [showDetails, setShowDetails] = useState(false);
  const queryClient = useQueryClient();

  const consentMutation = useMutation({
    mutationFn: async (consent: boolean) => {
      const res = await apiRequest('POST', '/api/ai-consent', { consent });
      return res.json();
    },
    onSuccess: (_, consent) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-consent'] });
      if (consent) {
        onConsentGranted();
      } else {
        onDeclined();
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDeclined(); }}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto" data-testid="ai-consent-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg">AI Assistant Data Sharing</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Dika, your AI fitness assistant, uses a third-party AI service to provide personalized insights and responses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-start gap-3">
              <Server className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Who receives your data</p>
                <p className="text-xs text-muted-foreground">Your data is sent to <strong>OpenAI</strong> (openai.com) to process your requests and generate responses.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Eye className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">What data is shared</p>
                <p className="text-xs text-muted-foreground">When you chat with Dika, the following may be included for context:</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc pl-4">
                  <li>Your messages to the AI assistant</li>
                  <li>Workout and exercise data</li>
                  <li>Nutrition and meal logs</li>
                  <li>Body measurements and fitness goals</li>
                  <li>Health and activity data (if connected)</li>
                  <li>Sports and match history</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Why it's needed</p>
                <p className="text-xs text-muted-foreground">This data helps Dika give you personalized fitness advice, track your progress, and provide meal and workout recommendations.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="toggle-consent-details"
          >
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showDetails ? 'Hide details' : 'More details'}
          </button>

          {showDetails && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
              <p><strong>Data processing:</strong> OpenAI processes your data to generate responses. Your data is not used to train OpenAI's models when accessed through our API.</p>
              <p><strong>Data retention:</strong> OpenAI may retain API inputs and outputs for up to 30 days for abuse monitoring, after which it is deleted.</p>
              <p><strong>Your control:</strong> You can revoke this consent at any time from your Profile settings. Revoking consent will disable the AI assistant features.</p>
              <p><strong>No personal identifiers:</strong> Your name, email, and account credentials are never sent to OpenAI.</p>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => consentMutation.mutate(true)}
              disabled={consentMutation.isPending}
              className="w-full"
              data-testid="btn-consent-agree"
            >
              {consentMutation.isPending ? 'Processing...' : 'I Agree — Enable AI Assistant'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                consentMutation.mutate(false);
              }}
              disabled={consentMutation.isPending}
              className="w-full"
              data-testid="btn-consent-decline"
            >
              No Thanks
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              By agreeing, you consent to sharing the data described above with OpenAI. You can change this anytime in Settings.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useAiConsent() {
  const { data, isLoading } = useQuery<{ consented: boolean; consentDate: string | null }>({
    queryKey: ['/api/ai-consent'],
    staleTime: 5 * 60 * 1000,
  });

  return {
    hasConsent: data?.consented ?? false,
    consentDate: data?.consentDate ?? null,
    isLoading,
  };
}
