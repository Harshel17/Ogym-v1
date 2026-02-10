import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GuidedEmptyState } from "@/components/guided-empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useTournaments, useTournament, useCreateTournament, useJoinTournament, useLeaveTournament, type Tournament } from "@/hooks/use-social";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Users, Calendar, Award, Plus, Medal, Crown, Dumbbell, CheckCircle, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";

const metricLabels: Record<string, string> = {
  workout_count: "Total Workout Days",
  streak_days: "Longest Streak",
  total_exercises: "Total Exercises",
  attendance_days: "Attendance Days",
};

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/10 text-blue-500",
  active: "bg-green-500/10 text-green-500",
  completed: "bg-gray-500/10 text-gray-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const statusIcons: Record<string, typeof Clock> = {
  upcoming: Clock,
  active: CheckCircle,
  completed: Trophy,
  cancelled: XCircle,
};

function TournamentCard({ tournament, onSelect }: { tournament: Tournament; onSelect: () => void }) {
  const StatusIcon = statusIcons[tournament.status] || Clock;
  
  return (
    <Card className="hover-elevate cursor-pointer" onClick={onSelect} data-testid={`card-tournament-${tournament.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg" data-testid={`text-tournament-name-${tournament.id}`}>{tournament.name}</CardTitle>
          </div>
          <Badge className={statusColors[tournament.status]}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {tournament.status}
          </Badge>
        </div>
        {tournament.description && (
          <CardDescription>{tournament.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Award className="h-4 w-4" />
          <span>{metricLabels[tournament.metricType]}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(new Date(tournament.startDate), "MMM d")} - {format(new Date(tournament.endDate), "MMM d, yyyy")}</span>
        </div>
        {tournament.prizeDescription && (
          <div className="flex items-center gap-2 text-sm">
            <Medal className="h-4 w-4 text-yellow-500" />
            <span className="font-medium">{tournament.prizeDescription}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TournamentDetail({ tournamentId, onClose }: { tournamentId: number; onClose: () => void }) {
  const { user } = useAuth();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const joinTournament = useJoinTournament();
  const leaveTournament = useLeaveTournament();
  
  if (isLoading || !tournament) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  
  const canJoin = (tournament.status === "upcoming" || tournament.status === "active") && !tournament.isParticipating;
  const canLeave = tournament.isParticipating && tournament.status === "upcoming";
  
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-tournament-detail-name">
            <Trophy className="h-6 w-6 text-yellow-500" />
            {tournament.name}
          </h2>
          {tournament.description && (
            <p className="text-muted-foreground mt-1">{tournament.description}</p>
          )}
        </div>
        <Badge className={statusColors[tournament.status]} data-testid="badge-tournament-status">
          {tournament.status}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Competition</span>
            </div>
            <p className="font-medium">{metricLabels[tournament.metricType]}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Duration</span>
            </div>
            <p className="font-medium">{format(new Date(tournament.startDate), "MMM d")} - {format(new Date(tournament.endDate), "MMM d")}</p>
          </CardContent>
        </Card>
      </div>
      
      {tournament.prizeDescription && (
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="flex items-center gap-3 pt-4">
            <Medal className="h-6 w-6 text-yellow-500" />
            <div>
              <p className="text-sm text-muted-foreground">Prize</p>
              <p className="font-medium" data-testid="text-prize">{tournament.prizeDescription}</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex gap-2">
        {canJoin && (
          <Button onClick={() => joinTournament.mutate(tournamentId)} disabled={joinTournament.isPending} data-testid="button-join-tournament">
            <Users className="h-4 w-4 mr-2" />
            Join Tournament
          </Button>
        )}
        {canLeave && (
          <Button variant="outline" onClick={() => leaveTournament.mutate(tournamentId)} disabled={leaveTournament.isPending} data-testid="button-leave-tournament">
            Leave Tournament
          </Button>
        )}
        {tournament.isParticipating && (
          <Badge variant="secondary" className="self-center" data-testid="badge-participating">
            <CheckCircle className="h-3 w-3 mr-1" />
            Participating
          </Badge>
        )}
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          Leaderboard
        </h3>
        {tournament.leaderboard && tournament.leaderboard.length > 0 ? (
          <div className="space-y-2">
            {tournament.leaderboard.map((entry, idx) => (
              <Card key={entry.userId} className={entry.userId === user?.id ? "ring-2 ring-primary" : ""} data-testid={`card-leaderboard-${entry.userId}`}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      idx === 0 ? "bg-yellow-500 text-white" :
                      idx === 1 ? "bg-gray-400 text-white" :
                      idx === 2 ? "bg-amber-700 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {entry.rank}
                    </div>
                    <span className="font-medium" data-testid={`text-leaderboard-username-${entry.userId}`}>{entry.username}</span>
                    {entry.userId === user?.id && <Badge variant="outline">You</Badge>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" data-testid={`text-leaderboard-score-${entry.userId}`}>{entry.score}</p>
                    <p className="text-xs text-muted-foreground">{metricLabels[tournament.metricType].toLowerCase()}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No participants yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CreateTournamentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const createTournament = useCreateTournament();
  const [form, setForm] = useState({
    name: "",
    description: "",
    metricType: "workout_count",
    startDate: "",
    endDate: "",
    prizeDescription: "",
  });
  
  const handleSubmit = () => {
    createTournament.mutate(form, {
      onSuccess: () => {
        setOpen(false);
        setForm({ name: "", description: "", metricType: "workout_count", startDate: "", endDate: "", prizeDescription: "" });
        onCreated();
      }
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-tournament">
          <Plus className="h-4 w-4 mr-2" />
          Create Tournament
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Tournament</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tournament Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="January Fitness Challenge"
              data-testid="input-tournament-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Get fit this month!"
              data-testid="input-tournament-description"
            />
          </div>
          <div className="space-y-2">
            <Label>Competition Type</Label>
            <Select value={form.metricType} onValueChange={(v) => setForm({ ...form, metricType: v })}>
              <SelectTrigger data-testid="select-metric-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workout_count">Total Workout Days</SelectItem>
                <SelectItem value="total_exercises">Total Exercises</SelectItem>
                <SelectItem value="attendance_days">Attendance Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                data-testid="input-end-date"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prize (optional)</Label>
            <Input
              value={form.prizeDescription}
              onChange={(e) => setForm({ ...form, prizeDescription: e.target.value })}
              placeholder="1 Month Free Membership"
              data-testid="input-prize"
            />
          </div>
          <Button onClick={handleSubmit} disabled={!form.name || !form.startDate || !form.endDate || createTournament.isPending} className="w-full" data-testid="button-submit-tournament">
            Create Tournament
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TournamentsPage() {
  const { user } = useAuth();
  const { data: tournaments, isLoading, refetch } = useTournaments();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  const canCreate = user?.role === "owner" || user?.role === "trainer";
  
  const activeTournaments = tournaments?.filter(t => t.status === "active" || t.status === "upcoming") || [];
  const pastTournaments = tournaments?.filter(t => t.status === "completed" || t.status === "cancelled") || [];
  
  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }
  
  if (selectedId) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <Button variant="ghost" onClick={() => setSelectedId(null)} className="mb-4" data-testid="button-back">
          Back to Tournaments
        </Button>
        <TournamentDetail tournamentId={selectedId} onClose={() => setSelectedId(null)} />
      </div>
    );
  }
  
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Tournaments</h1>
        {canCreate && <CreateTournamentDialog onCreated={refetch} />}
      </div>
      
      {activeTournaments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Active & Upcoming
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} onSelect={() => setSelectedId(t.id)} />
            ))}
          </div>
        </div>
      )}
      
      {pastTournaments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Past Tournaments</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pastTournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} onSelect={() => setSelectedId(t.id)} />
            ))}
          </div>
        </div>
      )}
      
      {(!tournaments || tournaments.length === 0) && (
        <GuidedEmptyState
          icon={Trophy}
          title="No Tournaments Yet"
          description={canCreate 
            ? "Create fitness challenges and tournaments to motivate your gym members and build community spirit."
            : "Your gym hasn't started any tournaments yet. Check back soon for exciting fitness challenges!"}
          features={canCreate ? [
            "Create custom fitness challenges with leaderboards",
            "Set duration and track participant progress",
            "Award points and build competitive spirit",
          ] : [
            "Compete in gym fitness challenges",
            "Climb the leaderboard and earn recognition",
            "Track your progress against other members",
          ]}
          iconGradient="from-amber-500 to-orange-600"
        />
      )}
    </div>
  );
}
