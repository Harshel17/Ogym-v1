import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { isNative, isIOS } from "@/lib/capacitor-init";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { UserCircle, Building2, Calendar, Mail, Phone, Loader2, Save, History, Users, ArrowRightLeft, Settings, MessageSquare, Flame, Dumbbell, Trophy, UserPlus, MapPin, AlertCircle, Clock, User, FileEdit, Send, Edit2, Lock, CreditCard, Copy, Trash2, LogOut, ExternalLink, Bell } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { GuestConversionBanner } from "@/components/guest-conversion-banner";
import { OwnerPaymentSettings, PaymentConfirmationsDashboard, MemberPaymentSheet } from "@/components/payment-settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatDistanceToNow, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ProfileData = {
  id: number;
  publicId: string;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string;
  gym: { id: number; name: string; code: string } | null;
  trainer?: { id: number; publicId: string; username: string } | null;
  cycle?: { id: number; name: string; endDate: string } | null;
  gymHistory?: { id: number; gymName: string; joinedAt: string; leftAt: string | null }[];
  stats?: { totalWorkouts: number; streak: number; last7Days: number };
  totalMembers?: number;
  totalStarMembers?: number;
};

type MemberProfileData = {
  id: number;
  publicId: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string | null;
  gym: { id: number; name: string } | null;
  trainer: { id: number; username: string } | null;
  cycle: { id: number; name: string } | null;
  subscription: { status: 'active' | 'expired' | 'none'; endDate: string | null; planName: string | null; subscriptionId: number | null; totalAmount: number | null } | null;
  profile: { fullName: string; gender: string; dob: string; address: string | null; emergencyContact: string | null } | null;
};

type OwnerProfileData = {
  id: number;
  publicId: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  role: string;
  createdAt: string | null;
  gym: {
    id: number;
    name: string;
    code: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    timings: string | null;
    gymType: string | null;
    facilities: string | null;
    createdAt: string | null;
    onboardingData: any;
  } | null;
};

type GymSubscription = {
  id: number;
  gymId: number;
  planType: string;
  amountPaid: number;
  paymentStatus: string;
  paidOn: string | null;
  validUntil: string | null;
  notes: string | null;
};

export default function ProfilePage() {
  const { user } = useAuth();

  if (user?.role === "member") {
    return <MemberProfileView />;
  }

  if (user?.role === "owner") {
    return <OwnerProfileView />;
  }

  return <TrainerProfileView />;
}

function MemberProfileView() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [changeField, setChangeField] = useState<"email" | "gender" | "dob">("email");
  const [requestedValue, setRequestedValue] = useState("");
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);

  const { data: profile, isLoading } = useQuery<MemberProfileData>({
    queryKey: ["/api/member/profile"]
  });

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone || "");
      setAddress(profile.profile?.address || "");
      setEmergencyContact(profile.profile?.emergencyContact || "");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: { phone?: string; address?: string; emergencyContact?: string }) => {
      const res = await apiRequest("PATCH", "/api/member/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/profile"] });
      toast({ title: "Profile updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  });

  const changeRequestMutation = useMutation({
    mutationFn: async (data: { field: string; currentValue?: string; requestedValue: string }) => {
      const res = await apiRequest("POST", "/api/member/profile/change-request", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Change request submitted", description: "Your gym owner will review your request." });
      setChangeRequestOpen(false);
      setRequestedValue("");
    },
    onError: () => {
      toast({ title: "Failed to submit request", variant: "destructive" });
    }
  });

  const handleSave = () => {
    updateMutation.mutate({ phone, address, emergencyContact });
  };

  const handleChangeRequest = () => {
    const currentValue = changeField === "email" ? profile?.email || "" 
      : changeField === "gender" ? profile?.profile?.gender || ""
      : profile?.profile?.dob || "";
    changeRequestMutation.mutate({ field: changeField, currentValue, requestedValue });
  };

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const subscriptionStatus = profile.subscription?.status || 'none';
  const isIOSNativeApp = isNative() && isIOS();

  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {user?.isGuest && <GuestConversionBanner variant="card" />}

      <div className="page-header-gradient">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/80 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25 ring-2 ring-background" data-testid="avatar-initials-member">
            <span className="text-xl font-bold text-white font-display">
              {(profile?.username || "U").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display">{user?.isGuest ? "Guest User" : (profile?.username || "My Profile")}</h2>
            <p className="text-sm text-muted-foreground">{user?.isGuest ? "Create an account to save your progress" : (profile?.email || "View and manage your account")}</p>
            {profile?.gym && (
              <div className="flex items-center gap-1.5 mt-1">
                <Building2 className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground/80">{profile.gym.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <UserCircle className="w-3.5 h-3.5 text-primary" />
              </div>
              Account Information
            </CardTitle>
            <CardDescription>Read-only account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Member ID</span>
              <Badge variant="outline" className="font-mono">{profile.publicId}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium">{profile.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary" className="capitalize">{profile.role}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Joined</span>
              <span className="text-sm">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}</span>
            </div>
            {profile.profile?.fullName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Full Name</span>
                <span className="font-medium">{profile.profile.fullName}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Building2 className="w-3.5 h-3.5 text-primary" />
              </div>
              Gym Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gym Name</span>
              <span className="font-medium">{profile.gym?.name || "Not assigned"}</span>
            </div>
            {profile.trainer && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Assigned Trainer</span>
                <span className="font-medium">{profile.trainer.username}</span>
              </div>
            )}
            {profile.cycle && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Cycle</span>
                <span className="font-medium">{profile.cycle.name}</span>
              </div>
            )}
            {!isIOSNativeApp && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subscription</span>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={subscriptionStatus === 'active' ? 'default' : subscriptionStatus === 'expired' ? 'destructive' : 'secondary'}
                    className="capitalize"
                  >
                    {subscriptionStatus}
                  </Badge>
                  {profile.gym && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setPaymentSheetOpen(true)}
                      data-testid="button-pay-now"
                    >
                      <CreditCard className="w-4 h-4 mr-1" />
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            )}
            {!isIOSNativeApp && profile.subscription?.planName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="text-sm">{profile.subscription.planName}</span>
              </div>
            )}
            {!isIOSNativeApp && profile.subscription?.endDate && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valid Until</span>
                <span className="text-sm">{new Date(profile.subscription.endDate).toLocaleDateString()}</span>
              </div>
            )}
            {!isIOSNativeApp && profile.subscription?.totalAmount && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="text-sm font-medium">₹{(profile.subscription.totalAmount / 100).toFixed(0)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Edit2 className="w-3.5 h-3.5 text-primary" />
                </div>
                Contact Information
              </CardTitle>
              <CardDescription>You can edit these fields</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-contact">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address (Optional)</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Your address"
                      data-testid="input-address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency">Emergency Contact (Optional)</Label>
                    <Input
                      id="emergency"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      placeholder="Emergency contact"
                      data-testid="input-emergency"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-contact">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{profile.phone || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-medium">{profile.profile?.address || "Not set"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Emergency:</span>
                  <span className="font-medium">{profile.profile?.emergencyContact || "Not set"}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Lock className="w-3.5 h-3.5 text-primary" />
              </div>
              Restricted Fields
            </CardTitle>
            <CardDescription>These require a change request to modify</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Email</span>
                </div>
                <span className="font-medium">{profile.email || "Not set"}</span>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Gender</span>
                </div>
                <span className="font-medium capitalize">{profile.profile?.gender?.replace(/_/g, ' ') || "Not set"}</span>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Date of Birth</span>
                </div>
                <span className="font-medium">{profile.profile?.dob ? new Date(profile.profile.dob).toLocaleDateString() : "Not set"}</span>
              </div>
            </div>
            <Dialog open={changeRequestOpen} onOpenChange={setChangeRequestOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-request-change">
                  <FileEdit className="w-4 h-4 mr-2" />
                  Request Change
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request Profile Change</DialogTitle>
                  <DialogDescription>
                    Select the field you want to change. Your gym owner will review and approve the request.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Field to Change</Label>
                    <Select value={changeField} onValueChange={(v) => setChangeField(v as any)}>
                      <SelectTrigger data-testid="select-change-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="gender">Gender</SelectItem>
                        <SelectItem value="dob">Date of Birth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>New Value</Label>
                    <Input
                      value={requestedValue}
                      onChange={(e) => setRequestedValue(e.target.value)}
                      placeholder={changeField === "email" ? "new@email.com" : changeField === "gender" ? "male/female" : "YYYY-MM-DD"}
                      data-testid="input-requested-value"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setChangeRequestOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleChangeRequest} 
                    disabled={!requestedValue.trim() || changeRequestMutation.isPending}
                    data-testid="button-submit-change-request"
                  >
                    {changeRequestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Submit Request
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <TrainingModeSettingsCard />
        <TransferGymCard />
        <AutoPostSettingsCard />
        <DikaSettingsCard />
        <NotificationSettingsCard />
        <PrivacyPolicyCard />
        <MyPostsCard />
        <DeleteAccountCard />
      </div>

      {profile?.gym && !isIOSNativeApp && (
        <MemberPaymentSheet
          open={paymentSheetOpen}
          onOpenChange={setPaymentSheetOpen}
          existingAmount={profile.subscription?.totalAmount ? profile.subscription.totalAmount / 100 : undefined}
          paymentType="subscription"
          subscriptionId={profile.subscription?.subscriptionId || undefined}
        />
      )}
    </div>
  );
}

function OwnerProfileView() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [timings, setTimings] = useState("");

  const { data: profile, isLoading } = useQuery<OwnerProfileData>({
    queryKey: ["/api/owner/profile"]
  });

  const { data: gymSubscription } = useQuery<GymSubscription | null>({
    queryKey: ["/api/owner/gym-subscription"]
  });

  const handleCopyCode = () => {
    if (profile?.gym?.code) {
      navigator.clipboard.writeText(profile.gym.code);
      toast({ title: "Gym code copied to clipboard!" });
    }
  };

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone || "");
      setAddress(profile.gym?.address || "");
      setTimings(profile.gym?.timings || "");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: { phone?: string; address?: string; timings?: string }) => {
      const res = await apiRequest("PATCH", "/api/owner/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/profile"] });
      toast({ title: "Profile updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  });

  const handleSave = () => {
    updateMutation.mutate({ phone, address, timings });
  };

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header-gradient">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/80 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25 ring-2 ring-background" data-testid="avatar-initials-owner">
            <span className="text-xl font-bold text-white font-display">
              {(profile?.username || "O").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display">{profile?.username || (isNative() && isIOS() ? "Profile" : "Owner Profile")}</h2>
            <p className="text-sm text-muted-foreground">{profile?.email || "Manage your account and gym details"}</p>
            {profile?.gym && (
              <div className="flex items-center gap-1.5 mt-1">
                <Building2 className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground/80">{profile.gym.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {profile.gym && (
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-bold">{profile.gym.name}</h3>
                <p className="text-primary-foreground/70 text-sm">Share this code with trainers and members</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-white/20 rounded-lg px-4 py-2 font-mono font-bold text-lg tracking-wider">
                  {profile.gym.code}
                </div>
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyCode}
                  data-testid="button-copy-code-profile"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {gymSubscription && !(isNative() && isIOS()) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4" />
              OGym Platform Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Plan:</span>{" "}
                  <span className="font-medium">{gymSubscription.planType.replace('_', ' ')}</span>
                </p>
                {gymSubscription.validUntil && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Valid until:</span>{" "}
                    <span className="font-medium">{format(new Date(gymSubscription.validUntil), 'PP')}</span>
                  </p>
                )}
              </div>
              <Badge variant={gymSubscription.paymentStatus === 'paid' ? 'default' : 'destructive'}>
                {gymSubscription.paymentStatus.charAt(0).toUpperCase() + gymSubscription.paymentStatus.slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              Account Information
            </CardTitle>
            <CardDescription>Read-only account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Owner ID</span>
              <Badge variant="outline" className="font-mono">{profile.publicId}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium">{profile.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{profile.email || "Not set"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary" className="capitalize">{profile.role}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Account Created</span>
              <span className="text-sm">{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Edit2 className="w-5 h-5" />
                Editable Details
              </CardTitle>
              <CardDescription>You can modify these fields</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-owner">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    data-testid="input-owner-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Gym Address</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Full gym address"
                    rows={2}
                    data-testid="input-owner-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timings">Gym Timings</Label>
                  <Input
                    id="timings"
                    value={timings}
                    onChange={(e) => setTimings(e.target.value)}
                    placeholder="e.g., 6 AM - 10 PM"
                    data-testid="input-owner-timings"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-owner">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </span>
                  <span className="font-medium">{profile.phone || "Not set"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Address
                  </span>
                  <span className="font-medium text-right max-w-[200px]">{profile.gym?.address || "Not set"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timings
                  </span>
                  <span className="font-medium">{profile.gym?.timings || "Not set"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {profile.gym && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Gym Details
              </CardTitle>
              <CardDescription>Read-only gym information from onboarding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Gym Name</span>
                  <p className="font-medium">{profile.gym.name}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Gym Code</span>
                  <p className="font-mono font-medium">{profile.gym.code}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Location</span>
                  <p className="font-medium">{[profile.gym.city, profile.gym.state, profile.gym.country].filter(Boolean).join(", ") || "Not set"}</p>
                </div>
                {profile.gym.gymType && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Gym Type</span>
                    <p className="font-medium capitalize">{profile.gym.gymType}</p>
                  </div>
                )}
                {profile.gym.facilities && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Facilities</span>
                    <p className="font-medium">{profile.gym.facilities}</p>
                  </div>
                )}
                {profile.gym.createdAt && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Gym Created</span>
                    <p className="font-medium">{new Date(profile.gym.createdAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {profile.gym.onboardingData && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h4 className="font-medium mb-4">Onboarding Data</h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(profile.gym.onboardingData).map(([key, value]) => (
                        <div key={key} className="p-4 bg-muted/50 rounded-lg">
                          <span className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                          <p className="font-medium">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!(isNative() && isIOS()) && <OwnerPaymentSettings />}
        {!(isNative() && isIOS()) && <PaymentConfirmationsDashboard />}
        <DikaSettingsCard />
        <NotificationSettingsCard />
        <PrivacyPolicyCard />
        <DeleteAccountCard />
      </div>
    </div>
  );
}

function TrainerProfileView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile/my"]
  });

  useEffect(() => {
    if (profile) {
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: { email?: string; phone?: string }) => {
      const res = await apiRequest("PATCH", "/api/profile/my", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/my"] });
      toast({ title: "Profile updated successfully" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  });

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header-gradient">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/80 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25 ring-2 ring-background" data-testid="avatar-initials-trainer">
            <span className="text-xl font-bold text-white font-display">
              {(profile?.username || "T").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display">{profile?.username || "My Profile"}</h2>
            <p className="text-sm text-muted-foreground">{profile?.email || "View and manage your account details"}</p>
            {profile?.gym && (
              <div className="flex items-center gap-1.5 mt-1">
                <Building2 className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground/80">{profile.gym.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <UserCircle className="w-3.5 h-3.5 text-primary" />
              </div>
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Trainer ID</span>
              <Badge variant="outline" className="font-mono">{profile.publicId}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Username</span>
              <span className="font-medium">{profile.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary" className="capitalize">{profile.role}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Joined</span>
              <span className="text-sm">{new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact Details
            </CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    data-testid="input-phone"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateMutation.mutate({ email: email || undefined, phone: phone || undefined })}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </span>
                  <span className="font-medium">{profile.email || "Not set"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </span>
                  <span className="font-medium">{profile.phone || "Not set"}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {profile.gym && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Gym Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gym Name</span>
                <span className="font-medium">{profile.gym.name}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Trainer Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{profile.totalMembers || 0}</p>
              <p className="text-sm text-muted-foreground">Total Members</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-2xl font-bold">{profile.totalStarMembers || 0}</p>
              <p className="text-sm text-muted-foreground">Star Members</p>
            </div>
          </CardContent>
        </Card>

        <TransferGymCard />
        <DikaSettingsCard />
        <NotificationSettingsCard />
        <PrivacyPolicyCard />
        <DeleteAccountCard />
      </div>
    </div>
  );
}

function TransferGymCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [gymCode, setGymCode] = useState("");

  const { data: pendingTransfer } = useQuery({
    queryKey: ["/api/member/transfer-request"]
  });

  const requestTransferMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/member/transfer-request", { gymCode: code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/transfer-request"] });
      toast({ title: "Transfer request submitted", description: "Waiting for both gym owners to approve." });
      setOpen(false);
      setGymCode("");
    },
    onError: (error: any) => {
      toast({ title: "Transfer request failed", description: error?.message || "Invalid gym code or already pending", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (gymCode.trim()) {
      requestTransferMutation.mutate(gymCode.trim().toUpperCase());
    }
  };

  return (
    <Card className="card-elevated md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
          </div>
          Transfer Gym
        </CardTitle>
        <CardDescription>Request to transfer to a different gym</CardDescription>
      </CardHeader>
      <CardContent>
        {pendingTransfer ? (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="font-medium text-yellow-700 dark:text-yellow-400">Transfer Request Pending</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your transfer request is awaiting approval from both gym owners.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the code of the gym you want to transfer to. Both your current gym owner and the new gym owner must approve the transfer.
            </p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-request-transfer">
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Request Transfer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transfer to Another Gym</DialogTitle>
                  <DialogDescription>
                    Enter the gym code of your new gym. Both owners must approve.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="gymCode">New Gym Code</Label>
                    <Input
                      id="gymCode"
                      placeholder="e.g., DEMO01"
                      value={gymCode}
                      onChange={(e) => setGymCode(e.target.value.toUpperCase())}
                      className="font-mono"
                      data-testid="input-gym-code"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={!gymCode.trim() || requestTransferMutation.isPending}
                      data-testid="button-submit-transfer"
                    >
                      {requestTransferMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Submit Request
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type FeedPost = {
  id: number;
  type: string;
  content: string | null;
  metadata: any;
  createdAt: string;
  isHidden: boolean;
};

function AutoPostSettingsCard() {
  const { toast } = useToast();
  
  const { data: autoPostSettings, isLoading } = useQuery<{ autoPostEnabled: boolean }>({
    queryKey: ["/api/me/auto-post"]
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("PUT", "/api/me/auto-post", { autoPostEnabled: enabled });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/auto-post"] });
      toast({ 
        title: data.autoPostEnabled ? "Auto-posting enabled" : "Auto-posting disabled",
        description: data.autoPostEnabled 
          ? "Your workout completions will be shared on the feed" 
          : "Your workouts will no longer be automatically shared"
      });
    },
    onError: () => {
      toast({ title: "Failed to update setting", variant: "destructive" });
    }
  });

  return (
    <Card className="card-elevated md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Settings className="w-3.5 h-3.5 text-primary" />
          </div>
          Feed Settings
        </CardTitle>
        <CardDescription>Control how your activity appears on the gym feed</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">Auto-post workout completions</p>
            <p className="text-sm text-muted-foreground">
              When enabled, your daily workout progress will be automatically shared on the gym feed
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Switch
              checked={autoPostSettings?.autoPostEnabled ?? true}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
              data-testid="switch-auto-post"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TrainingModeSettingsCard() {
  const { user } = useAuth();
  
  const { data: trainingModeData, isLoading } = useQuery<{ trainingMode: string }>({
    queryKey: ["/api/member/training-mode"]
  });

  const isTrainerLed = trainingModeData?.trainingMode === 'trainer_led';

  if (!user?.gymId) return null;

  return (
    <Card className="card-elevated md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Dumbbell className="w-3.5 h-3.5 text-primary" />
          </div>
          Training Mode
        </CardTitle>
        <CardDescription>Your current workout management mode</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">
              {isLoading ? "Loading..." : (isTrainerLed ? "Trainer-Led Mode" : "Self-Guided Mode")}
            </p>
            <p className="text-sm text-muted-foreground">
              {isTrainerLed 
                ? "Your trainer manages your workout cycles and can track your progress."
                : "You're managing your own workouts. Your trainer cannot see or modify them."
              }
            </p>
          </div>
          <Badge variant={isTrainerLed ? "default" : "secondary"} data-testid="badge-training-mode">
            {isTrainerLed ? "Trainer-Led" : "Self-Guided"}
          </Badge>
        </div>
        {!isTrainerLed && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-lg text-sm">
            <strong>Note:</strong> While in self-guided mode, your trainer cannot assign workouts to you. 
            Your gym attendance{isNative() && isIOS() ? "" : " and payments"} {isNative() && isIOS() ? "is" : "are"} still tracked normally.
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Contact your gym owner to change your training mode.
        </p>
      </CardContent>
    </Card>
  );
}

function DikaSettingsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);

  const { data: aiConsent, isLoading: consentLoading } = useQuery<{ consented: boolean; consentDate: string | null }>({
    queryKey: ['/api/ai-consent'],
    staleTime: 5 * 60 * 1000,
  });
  
  const toggleMutation = useMutation({
    mutationFn: async (hideDika: boolean) => {
      const res = await apiRequest("PATCH", "/api/dika/settings", { hideDika });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ 
        title: user?.hideDika ? "Dika enabled" : "Dika hidden",
        description: user?.hideDika 
          ? "The Dika assistant button is now visible" 
          : "Dika is now hidden from your screen"
      });
    },
    onError: () => {
      toast({ title: "Failed to update setting", variant: "destructive" });
    }
  });

  const consentMutation = useMutation({
    mutationFn: async (consent: boolean) => {
      const res = await apiRequest('POST', '/api/ai-consent', { consent });
      return res.json();
    },
    onSuccess: (_, consent) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-consent'] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setRevokeDialogOpen(false);
      toast({
        title: consent ? "AI data sharing enabled" : "AI data sharing disabled",
        description: consent 
          ? "Dika can now use your fitness data to provide personalized insights"
          : "AI features like Dika chat and nutrition estimation are now disabled",
      });
    },
    onError: () => {
      toast({ title: "Failed to update AI consent", variant: "destructive" });
    }
  });

  return (
    <Card className="card-elevated md:col-span-2" data-testid="card-dika-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
          </div>
          Dika Assistant
        </CardTitle>
        <CardDescription>Your gym's memory - answers questions about workouts, attendance{isNative() && isIOS() ? "" : ", and payments"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">Show Dika button</p>
            <p className="text-sm text-muted-foreground">
              When enabled, the floating Dika button appears on your screen for quick questions
            </p>
          </div>
          <Switch
            checked={!user?.hideDika}
            onCheckedChange={(checked) => toggleMutation.mutate(!checked)}
            disabled={toggleMutation.isPending}
            data-testid="switch-dika"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">AI data sharing</p>
            <p className="text-sm text-muted-foreground">
              {aiConsent?.consented
                ? "Your fitness data is shared with OpenAI to power Dika's personalized insights"
                : "Enable to allow Dika to use your data for personalized AI-powered advice"}
            </p>
            {aiConsent?.consented && aiConsent.consentDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Consented {formatDistanceToNow(new Date(aiConsent.consentDate), { addSuffix: true })}
              </p>
            )}
          </div>
          <Switch
            checked={aiConsent?.consented ?? false}
            onCheckedChange={(checked) => {
              if (!checked) {
                setRevokeDialogOpen(true);
              } else {
                consentMutation.mutate(true);
              }
            }}
            disabled={consentLoading || consentMutation.isPending}
            data-testid="switch-ai-consent"
          />
        </div>
      </CardContent>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="dialog-revoke-consent">
          <DialogHeader>
            <DialogTitle>Disable AI Data Sharing?</DialogTitle>
            <DialogDescription>
              This will turn off AI-powered features including Dika chat, nutrition estimation, and intelligence reports. Your existing data won't be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              data-testid="btn-cancel-revoke"
            >
              Keep Enabled
            </Button>
            <Button
              variant="destructive"
              onClick={() => consentMutation.mutate(false)}
              disabled={consentMutation.isPending}
              data-testid="btn-confirm-revoke"
            >
              {consentMutation.isPending ? "Disabling..." : "Disable AI Sharing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MyPostsCard() {
  const { data: posts, isLoading } = useQuery<FeedPost[]>({
    queryKey: ["/api/me/posts"]
  });

  const getPostIcon = (type: string) => {
    switch (type) {
      case "workout_complete": return <Dumbbell className="w-4 h-4 text-green-500" />;
      case "streak_milestone": return <Flame className="w-4 h-4 text-orange-500" />;
      case "achievement": return <Trophy className="w-4 h-4 text-yellow-500" />;
      case "new_member": return <UserPlus className="w-4 h-4 text-blue-500" />;
      default: return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPostLabel = (type: string) => {
    switch (type) {
      case "workout_complete": return "Workout";
      case "streak_milestone": return "Streak";
      case "achievement": return "Achievement";
      case "new_member": return "Joined";
      case "manual": return "Post";
      default: return type;
    }
  };

  const getPostDescription = (post: FeedPost) => {
    const meta = post.metadata || {};
    switch (post.type) {
      case "workout_complete":
        return `Completed ${meta.exerciseCount || 1} exercises${meta.focusLabel ? ` - ${meta.focusLabel}` : ""}`;
      case "streak_milestone":
        return `Reached ${meta.streakDays || 0} day streak`;
      case "achievement":
        return meta.type === "personal_record" 
          ? `New PR: ${meta.exercise} - ${meta.value}` 
          : "Earned achievement";
      case "new_member":
        return "Joined the gym";
      case "manual":
        return post.content || "Shared an update";
      default:
        return post.content || "Activity";
    }
  };

  return (
    <Card className="card-elevated md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
          </div>
          My Posts
        </CardTitle>
        <CardDescription>Your activity and posts on the gym feed</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !posts || posts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No posts yet</p>
            <p className="text-sm">Complete workouts or share updates to see them here</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {posts.map((post) => (
              <div key={post.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="mt-0.5">
                  {getPostIcon(post.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {getPostLabel(post.type)}
                    </Badge>
                    {post.isHidden && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Hidden</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{getPostDescription(post)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteAccountCard() {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const navigate = useLocation()[1];

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/users/me");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete account");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "Account deleted", description: "Your account has been permanently deleted." });
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete account", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleDelete = () => {
    if (confirmText.toLowerCase() === "delete") {
      deleteMutation.mutate();
    }
  };

  return (
    <Card className="card-elevated md:col-span-2 border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <div className="p-1.5 rounded-lg bg-destructive/10">
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </div>
          Delete Account
        </CardTitle>
        <CardDescription>Permanently delete your account and all associated data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
          <div>
            <p className="font-medium">Danger Zone</p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All your data will be permanently deleted.
            </p>
          </div>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" data-testid="button-delete-account">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  Delete Your Account?
                </DialogTitle>
                <DialogDescription>
                  This will permanently delete your account and all associated data. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm font-medium text-destructive">Warning: This will delete:</p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Your profile and account information</li>
                    <li>• All workout history and progress</li>
                    {!(isNative() && isIOS()) && <li>• Payment records and subscriptions</li>}
                    <li>• Posts, comments, and reactions</li>
                    <li>• Body measurements and health data</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label>Type "delete" to confirm</Label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="delete"
                    data-testid="input-confirm-delete"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                <Button 
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={confirmText.toLowerCase() !== "delete" || deleteMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Permanently Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

// Privacy Policy link for App Store compliance
function PrivacyPolicyCard() {
  const handleOpenPrivacyPolicy = async () => {
    const privacyUrl = "https://app.ogym.fitness/privacy";
    
    if (Capacitor.isNativePlatform()) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: privacyUrl });
      } catch { window.open(privacyUrl, "_blank"); }
    } else {
      window.open(privacyUrl, "_blank");
    }
  };

  return (
    <Card className="card-elevated md:col-span-2" data-testid="card-privacy-policy">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <ExternalLink className="w-3.5 h-3.5 text-primary" />
          </div>
          Privacy & Legal
        </CardTitle>
        <CardDescription>View our privacy policy and terms of service</CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={handleOpenPrivacyPolicy}
          data-testid="button-privacy-policy"
        >
          <ExternalLink className="w-4 h-4" />
          Privacy Policy
        </Button>
      </CardContent>
    </Card>
  );
}

// Notification settings with opt-in for push notifications (App Store compliant)
function NotificationSettingsCard() {
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!Capacitor.isNativePlatform()) {
      toast({ 
        title: "Notifications", 
        description: enabled ? "Browser notifications are not supported yet" : "Notifications disabled" 
      });
      setNotificationsEnabled(enabled);
      return;
    }

    if (enabled) {
      setIsLoading(true);
      try {
        // Dynamic import to avoid loading on web
        const { PushNotifications } = await import("@capacitor/push-notifications");
        
        const permResult = await PushNotifications.requestPermissions();
        
        if (permResult.receive === "granted") {
          await PushNotifications.register();
          setNotificationsEnabled(true);
          toast({ title: "Notifications enabled", description: "You'll receive updates about your gym activity" });
        } else {
          setNotificationsEnabled(false);
          toast({ 
            title: "Notifications denied", 
            description: "You can enable notifications in your device settings",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Failed to enable notifications:", error);
        toast({ title: "Failed to enable notifications", variant: "destructive" });
        setNotificationsEnabled(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      setNotificationsEnabled(false);
      toast({ title: "Notifications disabled" });
    }
  };

  return (
    <Card className="card-elevated md:col-span-2" data-testid="card-notification-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Bell className="w-3.5 h-3.5 text-primary" />
          </div>
          Notifications
        </CardTitle>
        <CardDescription>Manage how you receive updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-sm text-muted-foreground">
              Get notified about announcements, workout reminders, and gym updates
            </p>
          </div>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleToggleNotifications}
              data-testid="switch-notifications"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
