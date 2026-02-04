import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save, CreditCard, DollarSign, Smartphone, Wallet, Building2, Link, Edit2, Check, X } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

type PaymentSettings = {
  paymentLinks: PaymentLinks;
  dayPassPrice: number | null;
  currency: string;
};

export function OwnerPaymentSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinks>({});
  const [dayPassPrice, setDayPassPrice] = useState("");

  const { data: settings, isLoading } = useQuery<PaymentSettings>({
    queryKey: ["/api/owner/payment-settings"],
  });

  useEffect(() => {
    if (settings) {
      setPaymentLinks(settings.paymentLinks || {});
      setDayPassPrice(settings.dayPassPrice ? String(settings.dayPassPrice / 100) : "");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { paymentLinks?: PaymentLinks; dayPassPrice?: number }) => {
      const res = await apiRequest("PUT", "/api/owner/payment-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/payment-settings"] });
      toast({ title: "Payment settings saved" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to save payment settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      paymentLinks,
      dayPassPrice: dayPassPrice ? Math.round(parseFloat(dayPassPrice) * 100) : undefined,
    });
  };

  const currencySymbol = settings?.currency === "USD" ? "$" : "₹";
  const isUSA = settings?.currency === "USD";
  const isIndia = settings?.currency !== "USD";

  const updateLink = (key: keyof PaymentLinks, value: string) => {
    setPaymentLinks((prev) => ({ ...prev, [key]: value }));
  };

  const hasAnyPaymentMethod = Object.values(paymentLinks).some((v) => v && v.trim() !== "");

  if (isLoading) {
    return (
      <Card className="md:col-span-2">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Methods
          </CardTitle>
          <CardDescription>
            Add your payment links so members can pay directly. Works for subscriptions and day passes.
          </CardDescription>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-payment">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {isIndia && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4" />
                      UPI ID
                    </Label>
                    <Input
                      value={paymentLinks.upi || ""}
                      onChange={(e) => updateLink("upi", e.target.value)}
                      placeholder="yourname@upi"
                      data-testid="input-upi"
                    />
                  </div>
                )}
                {isUSA && (
                  <>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        Venmo
                      </Label>
                      <Input
                        value={paymentLinks.venmo || ""}
                        onChange={(e) => updateLink("venmo", e.target.value)}
                        placeholder="@yourvenmo"
                        data-testid="input-venmo"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Cash App
                      </Label>
                      <Input
                        value={paymentLinks.cashapp || ""}
                        onChange={(e) => updateLink("cashapp", e.target.value)}
                        placeholder="$yourcashtag"
                        data-testid="input-cashapp"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Zelle (Email/Phone)
                      </Label>
                      <Input
                        value={paymentLinks.zelle || ""}
                        onChange={(e) => updateLink("zelle", e.target.value)}
                        placeholder="your@email.com or phone"
                        data-testid="input-zelle"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    PayPal
                  </Label>
                  <Input
                    value={paymentLinks.paypal || ""}
                    onChange={(e) => updateLink("paypal", e.target.value)}
                    placeholder="paypal.me/yourname or email"
                    data-testid="input-paypal"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Bank Details
                  </Label>
                  <Input
                    value={paymentLinks.bankDetails || ""}
                    onChange={(e) => updateLink("bankDetails", e.target.value)}
                    placeholder="Bank name, account info"
                    data-testid="input-bank"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Custom Payment Link
                  </Label>
                  <Input
                    value={paymentLinks.customLink || ""}
                    onChange={(e) => updateLink("customLink", e.target.value)}
                    placeholder="https://..."
                    data-testid="input-custom-link"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom Link Label</Label>
                  <Input
                    value={paymentLinks.customLinkLabel || ""}
                    onChange={(e) => updateLink("customLinkLabel", e.target.value)}
                    placeholder="e.g., Stripe, Square"
                    data-testid="input-custom-label"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Day Pass Price ({currencySymbol})
                </Label>
                <div className="flex items-center gap-2 max-w-xs">
                  <span className="text-muted-foreground">{currencySymbol}</span>
                  <Input
                    type="number"
                    value={dayPassPrice}
                    onChange={(e) => setDayPassPrice(e.target.value)}
                    placeholder="e.g., 200"
                    data-testid="input-day-pass-price"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Set the price for a single day pass. Leave empty if not offering day passes.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-payment">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Payment Settings
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!hasAnyPaymentMethod ? (
              <div className="text-center py-6 text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No payment methods configured yet.</p>
                <p className="text-sm">Add your payment links so members can pay directly.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {paymentLinks.upi && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">UPI</span>
                    </div>
                    <Badge variant="outline">{paymentLinks.upi}</Badge>
                  </div>
                )}
                {paymentLinks.venmo && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Venmo</span>
                    </div>
                    <Badge variant="outline">{paymentLinks.venmo}</Badge>
                  </div>
                )}
                {paymentLinks.cashapp && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Cash App</span>
                    </div>
                    <Badge variant="outline">{paymentLinks.cashapp}</Badge>
                  </div>
                )}
                {paymentLinks.zelle && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Zelle</span>
                    </div>
                    <Badge variant="outline">{paymentLinks.zelle}</Badge>
                  </div>
                )}
                {paymentLinks.paypal && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">PayPal</span>
                    </div>
                    <Badge variant="outline">{paymentLinks.paypal}</Badge>
                  </div>
                )}
                {paymentLinks.bankDetails && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Bank</span>
                    </div>
                    <Badge variant="outline" className="max-w-[150px] truncate">{paymentLinks.bankDetails}</Badge>
                  </div>
                )}
                {paymentLinks.customLink && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{paymentLinks.customLinkLabel || "Custom"}</span>
                    </div>
                    <Badge variant="outline">Configured</Badge>
                  </div>
                )}
              </div>
            )}

            {settings?.dayPassPrice && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Day Pass Price</span>
                  <span className="font-medium">{currencySymbol}{(settings.dayPassPrice / 100).toFixed(0)}</span>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type MembershipPlan = {
  id: number;
  name: string;
  durationMonths: number;
  priceAmount: number;
  isActive: boolean;
};

export function MemberPaymentSheet({ 
  open, 
  onOpenChange, 
  existingAmount, 
  paymentType,
  subscriptionId 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  existingAmount?: number;
  paymentType: "subscription" | "day_pass";
  subscriptionId?: number;
}) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [referenceNote, setReferenceNote] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);
  const [step, setStep] = useState<"plan" | "payment">("plan");

  const { data: settings, isLoading: settingsLoading } = useQuery<PaymentSettings>({
    queryKey: ["/api/gym/payment-options"],
    enabled: open,
  });

  const { data: plans, isLoading: plansLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/member/membership-plans"],
    enabled: open && step === "plan",
  });

  const amount = selectedPlan ? selectedPlan.priceAmount / 100 : (existingAmount || 0);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/member/payment-confirmation", {
        paymentType,
        paymentMethod: selectedMethod,
        amount: Math.round(amount * 100),
        referenceNote: referenceNote || undefined,
        subscriptionId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payment confirmation submitted", description: "Your gym owner will confirm receipt." });
      onOpenChange(false);
      setSelectedMethod(null);
      setReferenceNote("");
    },
    onError: () => {
      toast({ title: "Failed to submit confirmation", variant: "destructive" });
    },
  });

  const paymentMethods: { key: keyof PaymentLinks; label: string; icon: typeof CreditCard; getUrl?: (v: string) => string }[] = [
    { key: "upi", label: "UPI", icon: Smartphone },
    { key: "venmo", label: "Venmo", icon: Wallet, getUrl: (v) => `https://venmo.com/${v.replace("@", "")}` },
    { key: "cashapp", label: "Cash App", icon: DollarSign, getUrl: (v) => `https://cash.app/${v.replace("$", "$")}` },
    { key: "zelle", label: "Zelle", icon: Building2 },
    { key: "paypal", label: "PayPal", icon: Wallet, getUrl: (v) => v.startsWith("http") ? v : `https://paypal.me/${v}` },
    { key: "bankDetails", label: "Bank Transfer", icon: Building2 },
    { key: "customLink", label: settings?.paymentLinks?.customLinkLabel || "Other", icon: Link, getUrl: (v) => v },
  ];

  const currencySymbol = settings?.currency === "USD" ? "$" : "₹";
  const availableMethods = paymentMethods.filter(m => settings?.paymentLinks?.[m.key]);
  const isLoading = settingsLoading || plansLoading;
  const activePlans = plans?.filter(p => p.isActive) || [];

  const handleClose = () => {
    onOpenChange(false);
    setSelectedMethod(null);
    setSelectedPlan(null);
    setReferenceNote("");
    setStep("plan");
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "block" : "hidden"}`}>
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed inset-x-4 bottom-0 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full">
        <Card>
          {step === "plan" ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Select Plan
                </CardTitle>
                <CardDescription>
                  Choose a membership plan to pay for.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : activePlans.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No plans available.</p>
                    <p className="text-sm">Contact your gym owner.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      {activePlans.map((plan) => {
                        const isSelected = selectedPlan?.id === plan.id;
                        return (
                          <button
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan)}
                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                              isSelected ? "border-primary bg-primary/5" : "border-border hover-elevate"
                            }`}
                            data-testid={`plan-${plan.id}`}
                          >
                            <div className="text-left">
                              <p className="font-medium">{plan.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {plan.durationMonths} {plan.durationMonths === 1 ? "month" : "months"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{currencySymbol}{(plan.priceAmount / 100).toFixed(0)}</span>
                              {isSelected && <Check className="w-5 h-5 text-primary" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => setStep("payment")}
                        disabled={!selectedPlan}
                        className="flex-1"
                        data-testid="button-continue-to-payment"
                      >
                        Continue
                      </Button>
                      <Button variant="outline" onClick={handleClose}>
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Pay {currencySymbol}{amount.toFixed(0)}
                </CardTitle>
                <CardDescription>
                  {selectedPlan ? selectedPlan.name : "Choose a payment method"}. After paying, confirm to notify your gym.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : availableMethods.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No payment methods available.</p>
                    <p className="text-sm">Contact your gym owner.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      {availableMethods.map(({ key, label, icon: Icon, getUrl }) => {
                        const value = settings?.paymentLinks?.[key];
                        const isSelected = selectedMethod === key;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              setSelectedMethod(key);
                              if (getUrl && value) {
                                window.open(getUrl(value), "_blank");
                              }
                            }}
                            className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                              isSelected ? "border-primary bg-primary/5" : "border-border hover-elevate"
                            }`}
                            data-testid={`payment-method-${key}`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5" />
                              <div className="text-left">
                                <p className="font-medium">{label}</p>
                                <p className="text-sm text-muted-foreground">{value}</p>
                              </div>
                            </div>
                            {isSelected && <Check className="w-5 h-5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>

                    {selectedMethod && (
                      <div className="space-y-2">
                        <Label>Reference/Transaction ID (optional)</Label>
                        <Input
                          value={referenceNote}
                          onChange={(e) => setReferenceNote(e.target.value)}
                          placeholder="e.g., UPI ref number"
                          data-testid="input-reference"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      {!existingAmount && (
                        <Button variant="outline" onClick={() => setStep("plan")}>
                          Back
                        </Button>
                      )}
                      <Button
                        onClick={() => submitMutation.mutate()}
                        disabled={!selectedMethod || submitMutation.isPending}
                        className="flex-1"
                        data-testid="button-confirm-payment"
                      >
                        {submitMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        I've Paid
                      </Button>
                      <Button variant="outline" onClick={handleClose}>
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export function PaymentConfirmationsDashboard() {
  const { toast } = useToast();

  const { data: confirmations = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/owner/payment-confirmations", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/owner/payment-confirmations?status=pending");
      if (!res.ok) {
        return []; // Return empty array on error instead of crashing
      }
      const data = await res.json();
      return Array.isArray(data) ? data : []; // Ensure it's always an array
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "confirmed" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/owner/payment-confirmations/${id}`, { status });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/payment-confirmations"] });
      toast({ title: `Payment ${variables.status}` });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (confirmations.length === 0) {
    return null;
  }

  const formatMethod = (m: string) => {
    const map: Record<string, string> = {
      upi: "UPI",
      venmo: "Venmo",
      cashapp: "Cash App",
      zelle: "Zelle",
      paypal: "PayPal",
      bank_transfer: "Bank",
      cash: "Cash",
      other: "Other",
    };
    return map[m] || m;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Pending Payment Confirmations
        </CardTitle>
        <CardDescription>
          Members waiting for you to confirm their payments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {confirmations.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">
                  {c.memberName || c.visitorName || "Unknown"}
                  {c.memberPublicId && <span className="text-muted-foreground text-sm ml-2">#{c.memberPublicId}</span>}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{formatMethod(c.paymentMethod)}</Badge>
                  <span>•</span>
                  <span>{c.paymentType === "day_pass" ? "Day Pass" : "Subscription"}</span>
                  {c.referenceNote && (
                    <>
                      <span>•</span>
                      <span>Ref: {c.referenceNote}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium mr-2">
                  {c.amount ? `₹${(c.amount / 100).toFixed(0)}` : ""}
                </span>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: c.id, status: "confirmed" })}
                  disabled={updateMutation.isPending}
                  data-testid={`button-confirm-${c.id}`}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateMutation.mutate({ id: c.id, status: "rejected" })}
                  disabled={updateMutation.isPending}
                  data-testid={`button-reject-${c.id}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
