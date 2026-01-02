import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Star, StarOff, Shield, TrendingUp, Dumbbell, Loader2, User, ChevronRight } from "lucide-react";
import { Link } from "wouter";

type Member = {
  id: number;
  username: string;
};

type StarMember = {
  id: number;
  memberId: number;
};

type MemberStats = {
  full: boolean;
  stats: {
    totalWorkouts: number;
    streak: number;
    last7Days?: number;
  };
  progress?: any[];
};

export default function StarMembersPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: starMembers = [] } = useQuery<StarMember[]>({
    queryKey: ["/api/trainer/star-members"]
  });

  const { data: assignedMembers = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/trainer/members"]
  });
  
  const starMemberIds = new Set(starMembers.map((s: StarMember) => s.memberId));
  
  const members: Member[] = assignedMembers.map((m: any) => ({
    id: m.id,
    username: m.username
  }));

  const addStarMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await apiRequest("POST", "/api/trainer/star-members", { memberId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/star-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/members"] });
      toast({ title: "Member added to stars" });
    },
    onError: () => {
      toast({ title: "Failed to add star member", variant: "destructive" });
    }
  });

  const removeStarMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await apiRequest("DELETE", `/api/trainer/star-members/${memberId}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/star-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/members"] });
      toast({ title: "Member removed from stars" });
    },
    onError: () => {
      toast({ title: "Failed to remove star member", variant: "destructive" });
    }
  });

  if (user?.role !== "trainer") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Trainers Only</h2>
        <p className="text-muted-foreground">This page is only for trainers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Star Members</h2>
        <p className="text-muted-foreground mt-1">
          Mark your top performers as stars to track their progress and create diet plans for them.
        </p>
      </div>

      {membersLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No Members Assigned</h3>
            <p className="text-muted-foreground mt-2">You don't have any members assigned yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member: any) => {
            const isStar = starMemberIds.has(member.id);
            return (
              <MemberCard
                key={member.id}
                member={member}
                isStar={isStar}
                onToggleStar={() => 
                  isStar ? removeStarMutation.mutate(member.id) : addStarMutation.mutate(member.id)
                }
                isPending={addStarMutation.isPending || removeStarMutation.isPending}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  isStar,
  onToggleStar,
  isPending
}: {
  member: Member;
  isStar: boolean;
  onToggleStar: () => void;
  isPending: boolean;
}) {
  const { data: stats } = useQuery<MemberStats>({
    queryKey: ["/api/trainer/members", member.id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/members/${member.id}/stats`, {
        credentials: "include"
      });
      return res.json();
    },
    enabled: isStar
  });

  const cardContent = (
    <Card className={`${isStar ? "border-yellow-500/50" : ""} ${isStar ? "hover-elevate cursor-pointer" : ""}`} data-testid={`card-member-${member.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isStar ? "bg-yellow-500" : "bg-primary"}`}>
            {member.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <CardTitle className="text-base">{member.username}</CardTitle>
            {isStar && (
              <Badge variant="secondary" className="text-yellow-600">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Star
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant={isStar ? "default" : "outline"}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleStar(); }}
            disabled={isPending}
            className={isStar ? "bg-yellow-500 hover:bg-yellow-600" : ""}
            data-testid={`button-toggle-star-${member.id}`}
          >
            {isStar ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
          </Button>
          {isStar && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent>
        {isStar && stats?.full ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="font-bold">{stats.stats.totalWorkouts}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="font-bold">{stats.stats.streak}</p>
              <p className="text-xs text-muted-foreground">Streak</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="font-bold">{stats.stats.last7Days || 0}</p>
              <p className="text-xs text-muted-foreground">7 Days</p>
            </div>
          </div>
        ) : !isStar ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Mark as star to view full stats and create diet plans
          </p>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isStar) {
    return (
      <Link href={`/star-members/${member.id}`} data-testid={`link-member-detail-${member.id}`}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
