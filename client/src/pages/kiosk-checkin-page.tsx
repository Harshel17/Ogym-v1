import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, CheckCircle, Phone, User, Mail, FileText, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";

interface KioskInfo {
  valid: boolean;
  gymName: string;
  gymId: number;
  sessionId: number;
}

const phoneSchema = z.object({
  phone: z.string().min(10, "Enter a valid phone number"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Enter 6-digit OTP"),
});

const detailsSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  visitType: z.enum(["day_pass", "trial", "enquiry"]),
  daysCount: z.string().optional(),
  amountPaid: z.string().optional(),
  notes: z.string().optional(),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OTPForm = z.infer<typeof otpSchema>;
type DetailsForm = z.infer<typeof detailsSchema>;

type Step = "loading" | "invalid" | "phone" | "otp" | "details" | "success";

export default function KioskCheckinPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>("loading");
  const [kioskInfo, setKioskInfo] = useState<KioskInfo | null>(null);
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const otpForm = useForm<OTPForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const detailsForm = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name: "",
      email: "",
      visitType: "enquiry",
      daysCount: "1",
      amountPaid: "",
      notes: "",
    },
  });

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await fetch(`/api/kiosk/${token}`);
      const data = await res.json();
      
      if (!res.ok) {
        setErrorMessage(data.message || "Invalid link");
        setStep("invalid");
        return;
      }
      
      setKioskInfo(data);
      setStep("phone");
    } catch (error) {
      setErrorMessage("Failed to validate link");
      setStep("invalid");
    }
  };

  const requestOTP = async (data: PhoneForm) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kiosk/${token}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const result = await res.json();
      
      if (!res.ok) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      
      setPhone(data.phone);
      setStep("otp");
      toast({ title: "OTP Sent", description: "Check your phone for the verification code" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send OTP", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const verifyOTP = async (data: OTPForm) => {
    setIsSubmitting(true);
    const detailsData = detailsForm.getValues();
    
    try {
      const res = await fetch(`/api/kiosk/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          otp: data.otp,
          name: detailsData.name,
          email: detailsData.email || undefined,
          visitType: detailsData.visitType,
          daysCount: parseInt(detailsData.daysCount || "1"),
          amountPaid: detailsData.amountPaid ? parseInt(detailsData.amountPaid) * 100 : 0,
          notes: detailsData.notes || undefined,
        }),
      });
      const result = await res.json();
      
      if (!res.ok) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      
      setStep("success");
    } catch (error) {
      toast({ title: "Error", description: "Failed to complete check-in", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const proceedToDetails = async (data: PhoneForm) => {
    setPhone(data.phone);
    setStep("details");
  };

  const submitDetails = async (data: DetailsForm) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kiosk/${token}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await res.json();
      
      if (!res.ok) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      
      // Demo mode: capture OTP if returned (remove when SMS is configured)
      if (result.demoOtp) {
        setDemoOtp(result.demoOtp);
      }
      
      setStep("otp");
      toast({ title: "OTP Sent", description: "Check your phone for the verification code" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send OTP", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (step === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating check-in link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invalid Check-in Link</h2>
            <p className="text-muted-foreground">{errorMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Check-in Complete!</h2>
            <p className="text-muted-foreground mb-4">
              Welcome to {kioskInfo?.gymName}. The gym has been notified of your visit.
            </p>
            <Badge variant="outline" className="text-sm">
              You can close this page now
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{kioskInfo?.gymName}</CardTitle>
          <CardDescription>Visitor Self Check-in</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" && (
            <Form {...phoneForm}>
              <form onSubmit={phoneForm.handleSubmit(proceedToDetails)} className="space-y-4">
                <FormField
                  control={phoneForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Enter your phone number"
                            className="pl-10"
                            {...field}
                            data-testid="input-phone"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>We'll send you a verification code</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-continue">
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </Form>
          )}

          {step === "details" && (
            <Form {...detailsForm}>
              <form onSubmit={detailsForm.handleSubmit(submitDetails)} className="space-y-4">
                <FormField
                  control={detailsForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Enter your name" className="pl-10" {...field} data-testid="input-name" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={detailsForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="your@email.com" className="pl-10" {...field} data-testid="input-email" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={detailsForm.control}
                  name="visitType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-visit-type">
                            <SelectValue placeholder="What brings you here?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="enquiry">Just Looking / Enquiry</SelectItem>
                          <SelectItem value="trial">Free Trial</SelectItem>
                          <SelectItem value="day_pass">Day Pass</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={detailsForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anything else? (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Questions, preferences, etc."
                          className="resize-none"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-submit-details">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Verify Phone
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          )}

          {step === "otp" && (
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(verifyOTP)} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code sent to
                  </p>
                  <p className="font-medium">{phone}</p>
                </div>
                
                {demoOtp && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Demo Mode - Your OTP:</p>
                    <p className="text-2xl font-bold tracking-widest text-amber-700 dark:text-amber-300" data-testid="text-demo-otp">{demoOtp}</p>
                  </div>
                )}
                
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="flex flex-col items-center">
                      <FormControl>
                        <InputOTP maxLength={6} {...field} data-testid="input-otp">
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

                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-verify-otp">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Complete Check-in
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setStep("details")}
                  data-testid="button-back"
                >
                  Go Back
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
