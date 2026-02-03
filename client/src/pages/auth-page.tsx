import { useEffect, useState } from "react";
import { useKeyboardAwareScroll } from "@/hooks/use-keyboard";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { Mail, ArrowLeft, Loader2, KeyRound, HelpCircle, CheckCircle, Dumbbell } from "lucide-react";
import { isIOS, isNative } from "@/lib/capacitor-init";

// Helper: Check if we're running on iOS native app (not web)
const isIOSNativeApp = () => isNative() && isIOS();
import ogymLogo from "@/assets/images/ogym-logo.png";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string()
    .min(4, "Username must be at least 4 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["owner", "trainer", "member"]),
  gymCode: z.string().optional(),
}).refine((data) => {
  if (data.role === "trainer") {
    return data.gymCode && data.gymCode.length > 0;
  }
  return true;
}, {
  message: "Gym code is required for trainers",
  path: ["gymCode"],
});

const verifySchema = z.object({
  code: z.string().length(6, "Please enter the 6-digit code"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

const resetPasswordSchema = z.object({
  otp: z.string().length(6, "Please enter the 6-digit code"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, "Must contain at least 1 letter and 1 number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const { 
    user, 
    loginMutation, 
    registerMutation, 
    verifyEmailMutation,
    resendCodeMutation,
    forgotPasswordMutation,
    resetPasswordMutation,
    pendingVerification,
    setPendingVerification,
  } = useAuth();
  const [, setLocation] = useLocation();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<"email" | "reset">("email");
  
  // Separate state for reset password flow (not using react-hook-form to avoid contamination)
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetFormError, setResetFormError] = useState("");
  
  // Support dialog state
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [supportTicketId, setSupportTicketId] = useState<number | null>(null);
  const [supportRole, setSupportRole] = useState<"owner" | "trainer" | "member">("member");
  const [supportContact, setSupportContact] = useState("");
  const [supportGymCode, setSupportGymCode] = useState("");
  const [supportIssueType, setSupportIssueType] = useState<string>("");
  const [supportPriority, setSupportPriority] = useState<"low" | "medium" | "high">("medium");
  const [supportDescription, setSupportDescription] = useState("");
  const [supportError, setSupportError] = useState("");
  
  const { toast } = useToast();
  
  // Enable keyboard-aware scrolling for mobile form handling
  useKeyboardAwareScroll();
  
  const supportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/support/public", data);
      return res.json();
    },
    onSuccess: (data) => {
      setSupportTicketId(data.ticketId);
      setSupportSubmitted(true);
    },
    onError: (error: any) => {
      setSupportError(error.message || "Failed to submit support request");
    },
  });

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { 
      username: "",
      email: "", 
      password: "", 
      role: "member",
      gymCode: ""
    },
  });

  const verifyForm = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });

  const selectedRole = registerForm.watch("role");

  const handleVerifySubmit = (data: z.infer<typeof verifySchema>) => {
    if (pendingVerification) {
      verifyEmailMutation.mutate({
        email: pendingVerification.email,
        code: data.code,
      });
    }
  };

  const handleResendCode = () => {
    if (pendingVerification && resendCooldown === 0) {
      resendCodeMutation.mutate({ email: pendingVerification.email });
      setResendCooldown(60);
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      setResetFormError("Please enter a valid email");
      return;
    }
    setResetFormError("");
    forgotPasswordMutation.mutate({ email: resetEmail }, {
      onSuccess: () => {
        setResetOtp("");
        setNewPassword("");
        setConfirmPassword("");
        setForgotPasswordStep("reset");
      },
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetOtp.length !== 6) {
      setResetFormError("Please enter the 6-digit code");
      return;
    }
    if (newPassword.length < 8) {
      setResetFormError("Password must be at least 8 characters");
      return;
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setResetFormError("Password must contain at least 1 letter and 1 number");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetFormError("Passwords don't match");
      return;
    }
    setResetFormError("");
    resetPasswordMutation.mutate({
      email: resetEmail,
      otp: resetOtp,
      newPassword: newPassword,
    }, {
      onSuccess: () => {
        handleCloseForgotPassword();
      },
    });
  };

  const handleCloseForgotPassword = () => {
    setForgotPasswordOpen(false);
    setForgotPasswordStep("email");
    setResetEmail("");
    setResetOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setResetFormError("");
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSupportError("");
    
    if (!supportContact) {
      setSupportError("Please enter your email or phone");
      return;
    }
    if (!supportIssueType) {
      setSupportError("Please select an issue type");
      return;
    }
    if (supportDescription.length < 10) {
      setSupportError("Please describe your issue in at least 10 characters");
      return;
    }
    
    supportMutation.mutate({
      userRole: supportRole,
      contactEmailOrPhone: supportContact,
      gymCode: supportGymCode || undefined,
      issueType: supportIssueType,
      priority: supportPriority,
      description: supportDescription,
    });
  };

  const handleCloseSupport = () => {
    setSupportOpen(false);
    setSupportSubmitted(false);
    setSupportTicketId(null);
    setSupportRole("member");
    setSupportContact("");
    setSupportGymCode("");
    setSupportIssueType("");
    setSupportPriority("medium");
    setSupportDescription("");
    setSupportError("");
  };

  if (user) return null;

  if (pendingVerification) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="absolute right-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <Card className="border shadow-lg">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Verify Your Email</CardTitle>
                <CardDescription className="mt-2">
                  Enter the 6-digit code sent to<br />
                  <span className="font-medium text-foreground">{pendingVerification.email}</span>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...verifyForm}>
                <form onSubmit={verifyForm.handleSubmit(handleVerifySubmit)} className="space-y-6">
                  <FormField
                    control={verifyForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormControl>
                          <InputOTP
                            maxLength={6}
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-otp-code"
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full h-11" 
                    disabled={verifyEmailMutation.isPending}
                    data-testid="button-verify"
                  >
                    {verifyEmailMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Email"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resendCooldown > 0 || resendCodeMutation.isPending}
                  onClick={handleResendCode}
                  data-testid="button-resend-code"
                >
                  {resendCodeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Resend in ${resendCooldown}s`
                  ) : (
                    "Resend Code"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setPendingVerification(null)}
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2 bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-zinc-900 text-white overflow-hidden">
        <div className="absolute inset-0 magic-gradient-bg" />
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop" 
            alt="Gym Background" 
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-40"
          />
        </div>
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-20 flex items-center gap-3 animate-slide-in-up">
          <div className="w-12 h-12 rounded-xl shadow-lg animate-glow overflow-hidden">
            <img 
              src={ogymLogo} 
              alt="OGym Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-3xl font-bold font-display tracking-wide">OGym</span>
        </div>

        <div className="relative z-20 max-w-lg animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-5xl font-bold font-display mb-6 leading-tight">
            Manage your fitness business with <span className="text-white/90">precision</span> and <span className="bg-gradient-to-r from-amber-200 to-yellow-100 bg-clip-text text-transparent">style</span>.
          </h2>
          <p className="text-xl text-white/70 font-light leading-relaxed">
            Whether you're an owner, trainer, or dedicated member, OGym connects your community and tracks your progress effortlessly.
          </p>
        </div>
        
        <div className="relative z-20 text-sm text-white/40 animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
          2026 OGym. All rights reserved.
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50 dark:opacity-30">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        
        <div className="absolute right-4 z-10" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md space-y-8 relative z-10">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8 animate-slide-in-up">
            <div className="w-10 h-10 rounded-xl shadow-lg shadow-primary/25 overflow-hidden">
              <img 
                src={ogymLogo} 
                alt="OGym Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-2xl font-bold font-display magic-text">OGym</span>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 h-12">
              <TabsTrigger value="login" className="text-base" data-testid="tab-login">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="text-base" data-testid="tab-register">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>Enter your email and password to access your account</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="Enter your email" 
                                {...field} 
                                className="h-11" 
                                data-testid="input-login-email" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter your password" {...field} className="h-11" data-testid="input-login-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-semibold magic-button" 
                        disabled={loginMutation.isPending}
                        data-testid="button-login"
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>
                  </Form>
                  <div className="mt-4 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                      onClick={() => setForgotPasswordOpen(true)}
                      data-testid="button-forgot-password"
                    >
                      Forgot your password?
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register" className="animate-in fade-in slide-in-from-left-4 duration-300">
              <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-2xl">Get started</CardTitle>
                  <CardDescription>Create a new account with your email</CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit((d) => {
                      // Guard: Block owner registration on iOS native app per Apple Guideline 3.1.1
                      if (isIOSNativeApp() && d.role === "owner") {
                        toast({
                          title: "Role not available",
                          description: "This role is not available in the iOS app.",
                          variant: "destructive",
                        });
                        return;
                      }
                      registerMutation.mutate(d);
                    })} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Choose a username" 
                                {...field} 
                                className="h-11" 
                                data-testid="input-register-username" 
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">This will be your public OGym ID</p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="Enter your email" 
                                {...field} 
                                className="h-11" 
                                data-testid="input-register-email" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Create a password (min 8 characters)" {...field} className="h-11" data-testid="input-register-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>I am a</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11" data-testid="select-role">
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="trainer">Trainer</SelectItem>
                                {/* Hide Gym Owner on iOS native app per Apple Guideline 3.1.1 */}
                                {!isIOSNativeApp() && <SelectItem value="owner">Gym Owner</SelectItem>}
                              </SelectContent>
                            </Select>
                            {/* iOS native app: informational message only, no links per Apple Guideline 3.1.1 */}
                            {isIOSNativeApp() && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Gym owner accounts are created outside the app. Existing accounts can sign in.
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="gymCode"
                        render={({ field }) => (
                          <FormItem className={selectedRole !== "owner" ? "animate-in fade-in zoom-in-95 duration-200" : "hidden"}>
                            <FormLabel>
                              Gym Code {selectedRole === "member" && <span className="text-muted-foreground font-normal">(optional)</span>}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder={selectedRole === "member" ? "Enter gym code or skip for personal mode" : "Enter the code provided by your gym"}
                                value={field.value || ""} 
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                name={field.name}
                                className="h-11" 
                                data-testid="input-gym-code" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        className="w-full h-11 text-base mt-2" 
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center mt-3">
                        By creating an account, you agree to our{" "}
                        <a href="/terms" className="text-primary hover:underline" data-testid="link-terms">Terms of Service</a>
                        {" "}and{" "}
                        <a href="/privacy" className="text-primary hover:underline" data-testid="link-privacy">Privacy Policy</a>
                      </p>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center flex flex-col gap-3">
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <a href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms-footer">Terms</a>
              <span>|</span>
              <a href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy-footer">Privacy</a>
              <span>|</span>
              <a 
                href="/admin" 
                className="hover:text-foreground transition-colors"
                data-testid="link-admin-login"
              >
                Admin
              </a>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSupportOpen(true)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                data-testid="button-need-help"
              >
                <HelpCircle className="w-3 h-3" />
                Need help?
              </button>
              <span className="text-muted-foreground">|</span>
              <a
                href="mailto:support@ogym.fitness"
                className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                data-testid="link-email-support-login"
              >
                <Mail className="w-3 h-3" />
                support@ogym.fitness
              </a>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={(open) => {
        if (!open) handleCloseForgotPassword();
        else setForgotPasswordOpen(true);
      }}>
        <DialogContent className="sm:max-w-md">
          {forgotPasswordStep === "email" ? (
            <>
              <DialogHeader className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Forgot Password?</DialogTitle>
                  <DialogDescription className="mt-2">
                    Enter your email and we'll send you a code to reset your password.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="text-sm font-medium">Email</label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="h-11"
                    data-testid="input-forgot-email"
                  />
                </div>
                {resetFormError && (
                  <p className="text-sm text-destructive">{resetFormError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCloseForgotPassword}
                    data-testid="button-cancel-forgot"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={forgotPasswordMutation.isPending}
                    data-testid="button-send-reset-code"
                  >
                    {forgotPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Code"
                    )}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <DialogHeader className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Reset Password</DialogTitle>
                  <DialogDescription className="mt-2">
                    Enter the 6-digit code sent to<br />
                    <span className="font-medium text-foreground">{resetEmail}</span>
                  </DialogDescription>
                </div>
              </DialogHeader>
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label htmlFor="reset-otp" className="text-sm font-medium">6-Digit Code</label>
                  <Input
                    id="reset-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    autoComplete="one-time-code"
                    className="h-11 text-center text-lg tracking-widest"
                    data-testid="input-reset-otp"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="new-password" className="text-sm font-medium">New Password</label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimum 8 characters, 1 letter and 1 number"
                    className="h-11"
                    data-testid="input-new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter your new password"
                    className="h-11"
                    data-testid="input-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {resetFormError && (
                  <p className="text-sm text-destructive">{resetFormError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setForgotPasswordStep("email");
                      setResetFormError("");
                    }}
                    data-testid="button-back-to-email"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={resetPasswordMutation.isPending}
                    data-testid="button-reset-password"
                  >
                    {resetPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={supportOpen} onOpenChange={(open) => {
        if (!open) handleCloseSupport();
        else setSupportOpen(true);
      }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {supportSubmitted ? (
            <>
              <DialogHeader className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Ticket Created</DialogTitle>
                  <DialogDescription className="mt-2">
                    Your support ticket #{supportTicketId} has been submitted successfully. We'll get back to you soon.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <div className="mt-4">
                <Button className="w-full" onClick={handleCloseSupport} data-testid="button-close-support-success">
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                  <HelpCircle className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Contact Support</DialogTitle>
                  <DialogDescription className="mt-2">
                    Having trouble logging in? Submit a support request and we'll help you.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <form onSubmit={handleSupportSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label htmlFor="support-role" className="text-sm font-medium">Your Role</label>
                  <Select value={supportRole} onValueChange={(val: any) => setSupportRole(val)}>
                    <SelectTrigger className="h-11" data-testid="select-support-role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="support-contact" className="text-sm font-medium">Email or Phone</label>
                  <Input
                    id="support-contact"
                    placeholder="Enter your email or phone"
                    value={supportContact}
                    onChange={(e) => setSupportContact(e.target.value)}
                    className="h-11"
                    data-testid="input-support-contact"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="support-gym-code" className="text-sm font-medium">Gym Code (optional)</label>
                  <Input
                    id="support-gym-code"
                    placeholder="Enter your gym code if known"
                    value={supportGymCode}
                    onChange={(e) => setSupportGymCode(e.target.value.toUpperCase())}
                    className="h-11"
                    data-testid="input-support-gym-code"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="support-issue" className="text-sm font-medium">Issue Type</label>
                  <Select value={supportIssueType} onValueChange={setSupportIssueType}>
                    <SelectTrigger className="h-11" data-testid="select-support-issue">
                      <SelectValue placeholder="Select issue type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="login">Login Issue</SelectItem>
                      <SelectItem value="otp">OTP Not Received</SelectItem>
                      <SelectItem value="password">Password Issue</SelectItem>
                      <SelectItem value="gym_code">Gym Code Issue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="support-priority" className="text-sm font-medium">Priority</label>
                  <Select value={supportPriority} onValueChange={(val: any) => setSupportPriority(val)}>
                    <SelectTrigger className="h-11" data-testid="select-support-priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="support-description" className="text-sm font-medium">Describe Your Issue</label>
                  <Textarea
                    id="support-description"
                    placeholder="Please describe your issue in detail..."
                    value={supportDescription}
                    onChange={(e) => setSupportDescription(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="textarea-support-description"
                  />
                </div>
                
                {supportError && (
                  <p className="text-sm text-destructive">{supportError}</p>
                )}
                
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCloseSupport}
                    data-testid="button-cancel-support"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={supportMutation.isPending}
                    data-testid="button-submit-support"
                  >
                    {supportMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Request"
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
