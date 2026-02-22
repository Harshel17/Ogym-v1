import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Sparkles, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { z } from "zod";

const convertSchema = z.object({
  username: z.string()
    .min(4, "Username must be at least 4 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export function GuestConversionBanner({ variant = "banner" }: { variant?: "banner" | "card" }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const convertMutation = useMutation({
    mutationFn: async (data: { username: string; email: string; password: string }) => {
      const res = await fetch("/api/auth/convert-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Failed to upgrade account");
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/profile"] });
      setOpen(false);
      toast({
        title: "Account created!",
        description: data.requiresVerification 
          ? "Please check your email to verify your account." 
          : "Your account has been upgraded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = convertSchema.safeParse({ username, email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    convertMutation.mutate({ username, email, password });
  };

  if (!user?.isGuest || dismissed) return null;

  if (variant === "card") {
    return (
      <>
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10" data-testid="guest-conversion-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-primary" />
              Save Your Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              You're using OGym as a guest. Create an account to keep all your workouts, nutrition data, and more.
            </p>
            <Button
              size="sm"
              onClick={() => setOpen(true)}
              data-testid="button-create-account-card"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
          </CardContent>
        </Card>

        <ConversionDialog
          open={open}
          setOpen={setOpen}
          username={username}
          setUsername={setUsername}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          errors={errors}
          handleSubmit={handleSubmit}
          isPending={convertMutation.isPending}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-lg p-3 flex items-center justify-between" data-testid="guest-conversion-banner">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-full bg-primary/15 shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">You're exploring as a guest</p>
            <p className="text-xs text-muted-foreground truncate">Create an account to save your data</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setOpen(true)}
            data-testid="button-create-account-banner"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Sign Up
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setDismissed(true)}
            data-testid="button-dismiss-banner"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <ConversionDialog
        open={open}
        setOpen={setOpen}
        username={username}
        setUsername={setUsername}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        errors={errors}
        handleSubmit={handleSubmit}
        isPending={convertMutation.isPending}
      />
    </>
  );
}

function ConversionDialog({
  open, setOpen, username, setUsername, email, setEmail, password, setPassword,
  errors, handleSubmit, isPending,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  username: string;
  setUsername: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  errors: Record<string, string>;
  handleSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-convert-guest">
        <DialogHeader>
          <DialogTitle>Create Your Account</DialogTitle>
          <DialogDescription>
            All your workouts, nutrition logs, and AI conversations will be kept.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conv-username">Username</Label>
            <Input
              id="conv-username"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="input-convert-username"
            />
            {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="conv-email">Email</Label>
            <Input
              id="conv-email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-convert-email"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="conv-password">Password</Label>
            <Input
              id="conv-password"
              type="password"
              placeholder="Create a password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-convert-password"
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
            data-testid="button-convert-submit"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Account
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
