import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { UserCircle, Building2, Calendar, Mail, Phone, Loader2, Save, History, Users, ArrowRightLeft, Settings, MessageSquare, Flame, Dumbbell, Trophy, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

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

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile/my"],
    onSuccess: (data: ProfileData) => {
      setEmail(data.email || "");
      setPhone(data.phone || "");
    }
  } as any);

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

  const canTransfer = user?.role === "member" || user?.role === "trainer";

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">My Profile</h2>
        <p className="text-muted-foreground mt-1">View and manage your account details.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5" />
              Account Information
            </CardTitle>
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gym Code</span>
                <Badge variant="outline" className="font-mono">{profile.gym.code}</Badge>
              </div>
              {profile.trainer && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trainer</span>
                  <span className="font-medium">{profile.trainer.username}</span>
                </div>
              )}
              {profile.cycle && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current Cycle</span>
                  <span className="font-medium">{profile.cycle.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {profile.stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Workout Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{profile.stats.totalWorkouts}</p>
                <p className="text-xs text-muted-foreground">Total Workouts</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{profile.stats.streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{profile.stats.last7Days}</p>
                <p className="text-xs text-muted-foreground">Last 7 Days</p>
              </div>
            </CardContent>
          </Card>
        )}

        {user?.role === "trainer" && (
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
        )}

        {profile.gymHistory && profile.gymHistory.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Gym History
              </CardTitle>
              <CardDescription>Your membership history across gyms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profile.gymHistory.map((record: any) => (
                  <div key={record.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{record.gymName}</p>
                      <p className="text-sm text-muted-foreground">
                        Joined {new Date(record.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {record.leftAt ? (
                      <Badge variant="outline">Left {new Date(record.leftAt).toLocaleDateString()}</Badge>
                    ) : (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {canTransfer && (
          <TransferGymCard />
        )}

        {user?.role === "member" && (
          <AutoPostSettingsCard />
        )}

        {user?.role === "member" && (
          <MyPostsCard />
        )}
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
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5" />
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
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
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
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
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
