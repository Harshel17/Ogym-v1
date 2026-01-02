import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { UserCircle, Building2, Calendar, Mail, Phone, Loader2, Save, History, Users } from "lucide-react";

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
      </div>
    </div>
  );
}
