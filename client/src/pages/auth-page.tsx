import { useEffect, useState } from "react";
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
import { Dumbbell, Mail, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  if (data.role !== "owner") {
    return data.gymCode && data.gymCode.length > 0;
  }
  return true;
}, {
  message: "Gym code is required to join a gym",
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
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");

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

  const forgotPasswordForm = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetPasswordForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { otp: "", newPassword: "", confirmPassword: "" },
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

  const handleForgotPasswordSubmit = (data: z.infer<typeof forgotPasswordSchema>) => {
    setForgotPasswordEmail(data.email);
    forgotPasswordMutation.mutate({ email: data.email }, {
      onSuccess: () => {
        setForgotPasswordStep("reset");
      },
    });
  };

  const handleResetPasswordSubmit = (data: z.infer<typeof resetPasswordSchema>) => {
    resetPasswordMutation.mutate({
      email: forgotPasswordEmail,
      otp: data.otp,
      newPassword: data.newPassword,
    }, {
      onSuccess: () => {
        setForgotPasswordOpen(false);
        setForgotPasswordStep("email");
        setForgotPasswordEmail("");
        forgotPasswordForm.reset();
        resetPasswordForm.reset();
      },
    });
  };

  const handleCloseForgotPassword = () => {
    setForgotPasswordOpen(false);
    setForgotPasswordStep("email");
    setForgotPasswordEmail("");
    forgotPasswordForm.reset();
    resetPasswordForm.reset();
  };

  if (user) return null;

  if (pendingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="absolute top-4 right-4">
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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-zinc-900 text-white overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-purple-800/90 z-10" />
          <img 
            src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop" 
            alt="Gym Background" 
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
          />
        </div>

        <div className="relative z-20 flex items-center gap-3">
          <div className="bg-white/20 backdrop-blur p-2 rounded-lg">
            <Dumbbell className="w-8 h-8" />
          </div>
          <span className="text-2xl font-bold font-display tracking-wide">OGym</span>
        </div>

        <div className="relative z-20 max-w-lg">
          <h2 className="text-4xl font-bold font-display mb-6 leading-tight">
            Manage your fitness business with precision and style.
          </h2>
          <p className="text-lg text-white/80 font-light">
            Whether you're an owner, trainer, or dedicated member, OGym connects your community and tracks your progress effortlessly.
          </p>
        </div>
        
        <div className="relative z-20 text-sm text-white/40">
          2024 OGym Inc. All rights reserved.
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="premium-gradient p-2.5 rounded-xl shadow-lg shadow-primary/25">
              <Dumbbell className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold font-display text-foreground">OGym</span>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">Create Account</TabsTrigger>
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
                        className="w-full h-11 text-base" 
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
                      variant="link"
                      className="text-sm text-muted-foreground"
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
                    <form onSubmit={registerForm.handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
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
                                <SelectItem value="owner">Gym Owner</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="gymCode"
                        render={({ field }) => (
                          <FormItem className={selectedRole !== "owner" ? "animate-in fade-in zoom-in-95 duration-200" : "hidden"}>
                            <FormLabel>Gym Code</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter the code provided by your gym" 
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
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <a 
              href="/admin" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-admin-login"
            >
              Admin Login
            </a>
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
              <Form {...forgotPasswordForm}>
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPasswordSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={forgotPasswordForm.control}
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
                            data-testid="input-forgot-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
              </Form>
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
                    <span className="font-medium text-foreground">{forgotPasswordEmail}</span>
                  </DialogDescription>
                </div>
              </DialogHeader>
              <Form {...resetPasswordForm}>
                <form onSubmit={resetPasswordForm.handleSubmit(handleResetPasswordSubmit)} className="space-y-4 mt-4">
                  <FormField
                    control={resetPasswordForm.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center">
                        <FormLabel className="sr-only">Verification Code</FormLabel>
                        <FormControl>
                          <InputOTP
                            maxLength={6}
                            value={field.value}
                            onChange={field.onChange}
                            data-testid="input-reset-otp"
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
                  <FormField
                    control={resetPasswordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Minimum 8 characters, 1 letter and 1 number"
                            {...field}
                            className="h-11"
                            data-testid="input-new-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={resetPasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Re-enter your new password"
                            {...field}
                            className="h-11"
                            data-testid="input-confirm-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setForgotPasswordStep("email")}
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
              </Form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
