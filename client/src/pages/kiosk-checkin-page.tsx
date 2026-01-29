import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, CheckCircle, Phone, User, Mail, FileText, ArrowRight, Loader2, CreditCard, Smartphone, Wallet, DollarSign, Link, ExternalLink, Upload, Camera, Calendar, Clock, ArrowLeft } from "lucide-react";
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
  notes: z.string().optional(),
});

type EmailForm = z.infer<typeof emailSchema>;
type OTPForm = z.infer<typeof otpSchema>;
type DetailsForm = z.infer<typeof detailsSchema>;

// Steps: loading -> invalid -> visitType -> payment (day_pass only) -> email -> otp -> success
type Step = "loading" | "invalid" | "visitType" | "payment" | "email" | "otp" | "success";
type VisitType = "enquiry" | "trial" | "day_pass";

export default function KioskCheckinPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<Step>("loading");
  const [kioskInfo, setKioskInfo] = useState<KioskInfo | null>(null);
  const [visitType, setVisitType] = useState<VisitType>("enquiry");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [checkinCode, setCheckinCode] = useState<string>("");

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
      setStep("visitType");
    } catch (error) {
      setErrorMessage("Failed to validate link");
      setStep("invalid");
    }
  };

  const handleVisitTypeSelect = (type: VisitType) => {
    setVisitType(type);
    if (type === "day_pass" && kioskInfo?.dayPassPrice) {
      setStep("payment");
    } else {
      setStep("email");
    }
  };

  const handleScreenshotUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPaymentScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentContinue = () => {
    if (!paymentScreenshot) {
      toast({ title: "Screenshot Required", description: "Please upload your payment screenshot", variant: "destructive" });
      return;
    }
    if (!selectedPaymentMethod) {
      toast({ title: "Payment Method Required", description: "Please select which payment method you used", variant: "destructive" });
      return;
    }
    setStep("email");
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
      setStep("otp");
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
          name: detailsData.name || email.split("@")[0],
          phone: detailsData.phone || undefined,
          visitType,
          daysCount: 1,
          amountPaid: visitType === "day_pass" && kioskInfo?.dayPassPrice ? kioskInfo.dayPassPrice : 0,
          paymentMethod: selectedPaymentMethod || undefined,
          paymentScreenshot: screenshotPreview || undefined,
          notes: detailsData.notes || undefined,
        }),
      });
      const result = await res.json();
      
      if (!res.ok) {
        toast({ title: "Error", description: result.message, variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      
      setCheckinCode(result.checkinCode || "");
      setStep("success");
    } catch (error) {
      toast({ title: "Error", description: "Failed to complete check-in", variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "upi": return <Smartphone className="w-5 h-5" />;
      case "venmo": return <Wallet className="w-5 h-5" />;
      case "cashapp": return <DollarSign className="w-5 h-5" />;
      case "zelle": return <Building2 className="w-5 h-5" />;
      case "paypal": return <Wallet className="w-5 h-5" />;
      case "bank": return <Building2 className="w-5 h-5" />;
      default: return <CreditCard className="w-5 h-5" />;
    }
  };

  const getPaymentUrl = (method: string, value: string) => {
    switch (method) {
      case "venmo": return `https://venmo.com/${value.replace("@", "")}`;
      case "cashapp": return `https://cash.app/${value}`;
      case "paypal": return value.startsWith("http") ? value : `https://paypal.me/${value}`;
      default: return null;
    }
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
              Welcome to {kioskInfo?.gymName}
            </p>
            
            {visitType === "day_pass" && checkinCode && (
              <div className="mb-6 p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Your Day Pass Code</p>
                <div className="text-3xl font-bold tracking-widest text-primary mb-2">
                  {checkinCode}
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Valid for 24 hours</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Show this code to gym staff for entry
                </p>
              </div>
            )}

            {visitType === "day_pass" && (
              <p className="text-sm text-muted-foreground mb-4">
                Your payment is pending verification. The gym will confirm shortly.
              </p>
            )}
            
            <Badge variant="outline" className="text-sm">
              You can screenshot this page for your records
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
          {/* Step 1: Visit Type Selection */}
          {step === "visitType" && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground mb-4">
                What brings you here today?
              </p>
              
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleVisitTypeSelect("enquiry")}
                data-testid="button-enquiry"
              >
                <FileText className="h-6 w-6" />
                <span className="font-medium">Just Looking / Enquiry</span>
                <span className="text-xs text-muted-foreground">Get information about the gym</span>
              </Button>

              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleVisitTypeSelect("trial")}
                data-testid="button-trial"
              >
                <Calendar className="h-6 w-6" />
                <span className="font-medium">Free Trial</span>
                <span className="text-xs text-muted-foreground">Try the gym for free</span>
              </Button>

              {kioskInfo?.dayPassPrice && (
                <Button
                  variant="outline"
                  className="w-full h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => handleVisitTypeSelect("day_pass")}
                  data-testid="button-day-pass"
                >
                  <CreditCard className="h-6 w-6" />
                  <span className="font-medium">Day Pass</span>
                  <Badge variant="secondary" className="mt-1">
                    {kioskInfo.currency === "USD" ? "$" : "₹"}{(kioskInfo.dayPassPrice / 100).toFixed(0)}
                  </Badge>
                </Button>
              )}
            </div>
          )}

          {/* Step 2: Payment (Day Pass Only) */}
          {step === "payment" && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("visitType")}
                className="mb-2"
                data-testid="button-back-to-visit-type"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="text-center mb-4">
                <h3 className="font-semibold text-lg mb-1">Day Pass Payment</h3>
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {kioskInfo?.currency === "USD" ? "$" : "₹"}{kioskInfo?.dayPassPrice ? (kioskInfo.dayPassPrice / 100).toFixed(0) : "0"}
                </Badge>
              </div>

              {/* Payment Methods */}
              {kioskInfo?.paymentLinks && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">1. Pay using one of these methods:</p>
                  <div className="grid gap-2">
                    {kioskInfo.paymentLinks.venmo && (
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPaymentMethod === "venmo" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedPaymentMethod("venmo")}
                        data-testid="payment-venmo"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Wallet className="w-5 h-5 text-blue-500" />
                            <div>
                              <p className="font-medium">Venmo</p>
                              <p className="text-sm text-muted-foreground">{kioskInfo.paymentLinks.venmo}</p>
                            </div>
                          </div>
                          <a 
                            href={`https://venmo.com/${kioskInfo.paymentLinks.venmo.replace("@", "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    )}

                    {kioskInfo.paymentLinks.cashapp && (
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPaymentMethod === "cashapp" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedPaymentMethod("cashapp")}
                        data-testid="payment-cashapp"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <DollarSign className="w-5 h-5 text-green-500" />
                            <div>
                              <p className="font-medium">Cash App</p>
                              <p className="text-sm text-muted-foreground">{kioskInfo.paymentLinks.cashapp}</p>
                            </div>
                          </div>
                          <a 
                            href={`https://cash.app/${kioskInfo.paymentLinks.cashapp}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    )}

                    {kioskInfo.paymentLinks.zelle && (
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPaymentMethod === "zelle" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedPaymentMethod("zelle")}
                        data-testid="payment-zelle"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-purple-500" />
                          <div>
                            <p className="font-medium">Zelle</p>
                            <p className="text-sm text-muted-foreground">{kioskInfo.paymentLinks.zelle}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {kioskInfo.paymentLinks.paypal && (
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPaymentMethod === "paypal" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedPaymentMethod("paypal")}
                        data-testid="payment-paypal"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Wallet className="w-5 h-5 text-blue-600" />
                            <div>
                              <p className="font-medium">PayPal</p>
                              <p className="text-sm text-muted-foreground">{kioskInfo.paymentLinks.paypal}</p>
                            </div>
                          </div>
                          <a 
                            href={kioskInfo.paymentLinks.paypal.startsWith("http") ? kioskInfo.paymentLinks.paypal : `https://paypal.me/${kioskInfo.paymentLinks.paypal}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    )}

                    {kioskInfo.paymentLinks.upi && (
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPaymentMethod === "upi" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedPaymentMethod("upi")}
                        data-testid="payment-upi"
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-orange-500" />
                          <div>
                            <p className="font-medium">UPI</p>
                            <p className="text-sm text-muted-foreground">{kioskInfo.paymentLinks.upi}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {kioskInfo.paymentLinks.bankDetails && (
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPaymentMethod === "bank" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedPaymentMethod("bank")}
                        data-testid="payment-bank"
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Bank Transfer</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{kioskInfo.paymentLinks.bankDetails}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {kioskInfo.paymentLinks.customLink && (
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPaymentMethod === "other" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                        onClick={() => setSelectedPaymentMethod("other")}
                        data-testid="payment-custom"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Link className="w-5 h-5" />
                            <div>
                              <p className="font-medium">{kioskInfo.paymentLinks.customLinkLabel || "Pay Here"}</p>
                            </div>
                          </div>
                          <a 
                            href={kioskInfo.paymentLinks.customLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-primary"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Screenshot Upload */}
              <div className="space-y-3 pt-4 border-t">
                <p className="text-sm font-medium">2. Upload payment screenshot:</p>
                
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handleScreenshotUpload}
                  className="hidden"
                  data-testid="input-screenshot"
                />

                {screenshotPreview ? (
                  <div className="relative">
                    <img 
                      src={screenshotPreview} 
                      alt="Payment screenshot" 
                      className="w-full rounded-lg border max-h-48 object-contain bg-muted"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-change-screenshot"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-screenshot"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6" />
                      <span>Tap to upload screenshot</span>
                    </div>
                  </Button>
                )}
              </div>

              <Button 
                className="w-full" 
                onClick={handlePaymentContinue}
                disabled={!paymentScreenshot || !selectedPaymentMethod}
                data-testid="button-continue-after-payment"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 3: Email Entry */}
          {step === "email" && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(visitType === "day_pass" ? "payment" : "visitType")}
                className="mb-2"
                data-testid="button-back-to-previous"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

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
                  <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-send-otp">
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
            </div>
          )}

          {/* Step 4: OTP Verification */}
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
                  onClick={() => setStep("email")}
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
