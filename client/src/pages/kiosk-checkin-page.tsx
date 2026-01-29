import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, CheckCircle, Phone, User, Mail, FileText, ArrowRight, Loader2, CreditCard, Smartphone, Wallet, DollarSign, Link, ExternalLink } from "lucide-react";
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

type PaymentLinks = {
  upi?: string;
  venmo?: string;
  cashapp?: string;
  zelle?: string;
  paypal?: string;
  bankDetails?: string;
  customLink?: string;
  customLinkLabel?: string;
};

interface KioskInfo {
  valid: boolean;
  gymName: string;
  gymId: number;
  sessionId: number;
  currency?: string;
  dayPassPrice?: number;
  paymentLinks?: PaymentLinks;
}

const emailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Enter 6-digit OTP"),
});

const detailsSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().optional().or(z.literal("")),
  visitType: z.enum(["day_pass", "trial", "enquiry"]),
  daysCount: z.string().optional(),
  amountPaid: z.string().optional(),
  notes: z.string().optional(),
});

type EmailForm = z.infer<typeof emailSchema>;
type OTPForm = z.infer<typeof otpSchema>;
type DetailsForm = z.infer<typeof detailsSchema>;

type Step = "loading" | "invalid" | "email" | "otp" | "details" | "success";

export default function KioskCheckinPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>("loading");
  const [kioskInfo, setKioskInfo] = useState<KioskInfo | null>(null);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const otpForm = useForm<OTPForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const detailsForm = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name: "",
      phone: "",
      visitType: "enquiry",
      daysCount: "1",
      amountPaid: "",
      notes: "",
    },
  });

  const visitType = detailsForm.watch("visitType");

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
      setStep("email");
    } catch (error) {
      setErrorMessage("Failed to validate link");
      setStep("invalid");
    }
  };

  const requestOTP = async (data: EmailForm) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kiosk/${token}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });
      const result = await res.json();
      
      if (!res.ok) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      
      setEmail(data.email);
      setStep("details");
      toast({ title: "OTP Sent", description: "Check your email for the verification code" });
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
          email,
          otp: data.otp,
          name: detailsData.name,
          phone: detailsData.phone || undefined,
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

  const submitDetails = async (data: DetailsForm) => {
    setStep("otp");
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
          {step === "email" && (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(requestOTP)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="your@email.com"
                            type="email"
                            className="pl-10"
                            {...field}
                            data-testid="input-email"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>We'll send you a verification code</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-continue">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    <>
                      Send Verification Code
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Your phone number" className="pl-10" {...field} data-testid="input-phone" />
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

                {visitType === "day_pass" && kioskInfo?.dayPassPrice && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Day Pass Price
                      </span>
                      <Badge variant="secondary" className="text-base">
                        {kioskInfo.currency === "USD" ? "$" : "₹"}{(kioskInfo.dayPassPrice / 100).toFixed(0)}
                      </Badge>
                    </div>
                    
                    {kioskInfo.paymentLinks && Object.keys(kioskInfo.paymentLinks).some(k => kioskInfo.paymentLinks?.[k as keyof PaymentLinks]) && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Pay using:</p>
                        <div className="flex flex-wrap gap-2">
                          {kioskInfo.paymentLinks.upi && (
                            <Badge variant="outline" className="gap-1" data-testid="badge-upi">
                              <Smartphone className="w-3 h-3" />
                              UPI: {kioskInfo.paymentLinks.upi}
                            </Badge>
                          )}
                          {kioskInfo.paymentLinks.venmo && (
                            <a href={`https://venmo.com/${kioskInfo.paymentLinks.venmo.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex" data-testid="link-venmo">
                              <Badge variant="outline" className="gap-1">
                                <Wallet className="w-3 h-3" />
                                Venmo
                                <ExternalLink className="w-3 h-3" />
                              </Badge>
                            </a>
                          )}
                          {kioskInfo.paymentLinks.cashapp && (
                            <a href={`https://cash.app/${kioskInfo.paymentLinks.cashapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex" data-testid="link-cashapp">
                              <Badge variant="outline" className="gap-1">
                                <DollarSign className="w-3 h-3" />
                                Cash App
                                <ExternalLink className="w-3 h-3" />
                              </Badge>
                            </a>
                          )}
                          {kioskInfo.paymentLinks.paypal && (
                            <a href={kioskInfo.paymentLinks.paypal.startsWith("http") ? kioskInfo.paymentLinks.paypal : `https://paypal.me/${kioskInfo.paymentLinks.paypal}`} target="_blank" rel="noopener noreferrer" className="inline-flex" data-testid="link-paypal">
                              <Badge variant="outline" className="gap-1">
                                <Wallet className="w-3 h-3" />
                                PayPal
                                <ExternalLink className="w-3 h-3" />
                              </Badge>
                            </a>
                          )}
                          {kioskInfo.paymentLinks.zelle && (
                            <Badge variant="outline" className="gap-1" data-testid="badge-zelle">
                              <Building2 className="w-3 h-3" />
                              Zelle: {kioskInfo.paymentLinks.zelle}
                            </Badge>
                          )}
                          {kioskInfo.paymentLinks.customLink && (
                            <a href={kioskInfo.paymentLinks.customLink} target="_blank" rel="noopener noreferrer" className="inline-flex" data-testid="link-custom">
                              <Badge variant="outline" className="gap-1">
                                <Link className="w-3 h-3" />
                                {kioskInfo.paymentLinks.customLinkLabel || "Pay Here"}
                                <ExternalLink className="w-3 h-3" />
                              </Badge>
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Complete payment and check in. Staff will verify your payment.</p>
                      </div>
                    )}
                  </div>
                )}

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

                <Button type="submit" className="w-full" data-testid="button-submit-details">
                  Continue to Verification
                  <ArrowRight className="ml-2 h-4 w-4" />
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
                  <p className="font-medium">{email}</p>
                </div>
                
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
