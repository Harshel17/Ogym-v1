import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useTrainers, useAssignTrainer, useMembersDetails } from "@/hooks/use-gym";
import { useTrainerMembers } from "@/hooks/use-workouts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Shield, Check, X, Minus, Star, Loader2, ExternalLink, Dumbbell, Calendar, Layers, Moon, UserPlus, CreditCard, Users, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type MemberDetail = {
  id: number;
  username: string;
  role: string;
  createdAt: string | null;
  trainerName: string | null;
  cycleEndDate: string | null;
  paymentStatus: string | null;
  subscriptionEndDate: string | null;
  subscriptionStatus: string | null;
};

export default function MembersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "starred">("all");
  const [ownerTab, setOwnerTab] = useState<"all" | "new">("all");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string>("");
  
  const isOwner = user?.role === "owner";
  const isTrainer = user?.role === "trainer";
  
  const { data: ownerMembersDetails = [], isLoading: ownerLoading } = useMembersDetails();
  const { data: trainerMembers = [], isLoading: trainerLoading } = useTrainerMembers();
  
  const { data: starMembers = [] } = useQuery<{ id: number; memberId: number }[]>({
    queryKey: ["/api/trainer/star-members"],
    enabled: isTrainer
  });
  
  const starMemberIds = new Set((starMembers || []).map(s => s.memberId));
  
  const [pendingStarId, setPendingStarId] = useState<number | null>(null);
  
  const addStarMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const res = await apiRequest("POST", "/api/trainer/star-members", { memberId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/star-members"] });
      toast({ title: "Member added to stars" });
      setPendingStarId(null);
    },
    onError: () => {
      toast({ title: "Failed to add star", variant: "destructive" });
      setPendingStarId(null);
    }
  });

  const removeStarMutation = useMutation({
    mutationFn: async (memberId: number) => {
      await apiRequest("DELETE", `/api/trainer/star-members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/star-members"] });
      toast({ title: "Member removed from stars" });
      setPendingStarId(null);
    },
    onError: () => {
      toast({ title: "Failed to remove star", variant: "destructive" });
      setPendingStarId(null);
    }
  });
  
  const members = isOwner ? (ownerMembersDetails as MemberDetail[]) : (trainerMembers as any[]);
  const isLoading = isOwner ? ownerLoading : trainerLoading;

  if (user?.role === "member") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">Only gym owners and trainers can view members.</p>
      </div>
    );
  }

  const isNewMemberCheck = (m: any) => {
    const hasTrainer = !!m.trainerName;
    const subscriptionEnd = m.subscriptionEndDate ? new Date(m.subscriptionEndDate) : null;
    const hasActiveSubscription = subscriptionEnd && subscriptionEnd > new Date();
    const hasOverduePayment = m.subscriptionStatus === "overdue" || m.paymentStatus === "unpaid" || m.paymentStatus === "partial";
    
    return !hasTrainer || !hasActiveSubscription || hasOverduePayment;
  };

  const newMembers = (ownerMembersDetails as MemberDetail[]).filter(isNewMemberCheck);

  const filteredMembers = members.filter((m: any) => {
    const matchesSearch = m.username?.toLowerCase().includes(search.toLowerCase()) || 
      m.role?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "starred" && starMemberIds.has(m.id));
    
    if (isOwner && ownerTab === "new") {
      return matchesSearch && isNewMemberCheck(m);
    }
    
    return matchesSearch && matchesFilter;
  });
  
  const toggleStar = (memberId: number) => {
    setPendingStarId(memberId);
    if (starMemberIds.has(memberId)) {
      removeStarMutation.mutate(memberId);
    } else {
      addStarMutation.mutate(memberId);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">
            {isOwner ? "Member Management" : "My Assigned Members"}
          </h2>
          <p className="text-muted-foreground mt-1">
            {isOwner ? "View and manage all members in your gym." : "Members assigned to you for training."}
          </p>
        </div>
      </div>

      <Card className="dashboard-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4">
            {isOwner && (
              <Tabs value={ownerTab} onValueChange={(v) => setOwnerTab(v as "all" | "new")} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="all" data-testid="tab-all-members" className="gap-2">
                    <Users className="w-4 h-4" />
                    All Members
                  </TabsTrigger>
                  <TabsTrigger value="new" data-testid="tab-new-members" className="gap-2">
                    <UserPlus className="w-4 h-4" />
                    New Members
                    {newMembers.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{newMembers.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-members"
                />
              </div>
              {isTrainer && (
                <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "starred")} className="w-auto">
                  <TabsList>
                    <TabsTrigger value="all" data-testid="tab-all-members">All</TabsTrigger>
                    <TabsTrigger value="starred" data-testid="tab-starred-members">
                      <Star className="w-3 h-3 mr-1 fill-yellow-500 text-yellow-500" />
                      Starred
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isOwner && ownerTab === "new" && (
            <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Members Need Attention</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    These members need a trainer assigned, have no active subscription, or have overdue payments. Click on a member row to view details.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {isTrainer && <TableHead className="w-12">Star</TableHead>}
                  <TableHead>Name</TableHead>
                  {isOwner && <TableHead>Trainer</TableHead>}
                  {isOwner && <TableHead>Subscription End</TableHead>}
                  {isOwner && <TableHead>Payment</TableHead>}
                  <TableHead>Joined</TableHead>
                  {isOwner && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isOwner ? 6 : 2} className="h-24 text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isOwner ? 6 : 2} className="h-24 text-center text-muted-foreground">
                      {isTrainer 
                        ? "No members assigned to you yet." 
                        : isOwner && ownerTab === "new"
                          ? "All members have trainers assigned and payments set up."
                          : "No members found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member: any) => {
                    const isStar = starMemberIds.has(member.id);
                    const isPendingThis = pendingStarId === member.id;
                    
                    return (
                    <TableRow 
                      key={member.id} 
                      className={`hover:bg-muted/50 transition-colors cursor-pointer`}
                      onClick={() => {
                        if (isOwner) {
                          navigate(`/owner/members/${member.id}`);
                        } else if (isTrainer) {
                          setSelectedMemberId(member.id);
                          setSelectedMemberName(member.username || "Member");
                        }
                      }}
                      data-testid={`row-member-${member.id}`}
                    >
                      {isTrainer && (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); toggleStar(member.id); }}
                            disabled={isPendingThis}
                            className={isStar ? "text-yellow-500" : "text-muted-foreground"}
                            data-testid={`button-star-${member.id}`}
                          >
                            {isPendingThis ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Star className={`w-4 h-4 ${isStar ? "fill-yellow-500" : ""}`} />
                            )}
                          </Button>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isStar && isTrainer ? "bg-yellow-500/20 text-yellow-600" : "bg-primary/10 text-primary"}`}>
                            {member.username?.slice(0, 2).toUpperCase() || '??'}
                          </div>
                          <div>
                            {member.username}
                            {isStar && isTrainer && (
                              <Badge variant="secondary" className="ml-2 text-yellow-600 text-xs">
                                <Star className="w-2 h-2 mr-1 fill-current" />
                                Star
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      {isOwner && (
                        <TableCell>
                          {member.trainerName ? (
                            <span className="text-sm">{member.trainerName}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                      )}
                      {isOwner && (
                        <TableCell>
                          {member.subscriptionEndDate ? (
                            <span className="text-sm">{member.subscriptionEndDate}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">No subscription</span>
                          )}
                        </TableCell>
                      )}
                      {isOwner && (
                        <TableCell>
                          <PaymentBadge status={member.paymentStatus} />
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground text-sm">
                        {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      {isOwner && (
                        <TableCell className="text-right">
                          {member.role === 'member' && (
                            <AssignTrainerDialog memberId={member.id} memberName={member.username} currentTrainer={member.trainerName} />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {isTrainer && selectedMemberId && (
        <MemberWorkoutDialog 
          memberId={selectedMemberId} 
          memberName={selectedMemberName}
          open={!!selectedMemberId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMemberId(null);
              setSelectedMemberName("");
            }
          }}
        />
      )}
    </div>
  );
}

function MemberWorkoutDialog({ 
  memberId, 
  memberName, 
  open, 
  onOpenChange 
}: { 
  memberId: number; 
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery<{
    cycle: any;
    phases: any[];
    activePhase: any;
  }>({
    queryKey: ["/api/trainer/members", memberId, "workouts"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/members/${memberId}/workouts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open,
  });
  
  const cycle = data?.cycle;
  const phases = data?.phases || [];
  const activePhase = data?.activePhase;
  
  const cycleItemsByDay = cycle?.items?.reduce((acc: Record<number, any[]>, item: any) => {
    const dayIndex = item.dayIndex ?? 0;
    if (!acc[dayIndex]) acc[dayIndex] = [];
    acc[dayIndex].push(item);
    return acc;
  }, {}) || {};
  
  const cycleDays = cycle ? Array.from({ length: cycle.cycleLength || 1 }, (_, i) => i) : [];
  const cycleRestDays = cycle?.restDays || [];
  const cycleDayLabels = cycle?.dayLabels || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            {memberName}'s Workout Plan
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(85vh - 120px)" }}>
          {isLoading ? (
            <div className="space-y-4 p-4">
              <div className="h-20 bg-muted animate-pulse rounded" />
              <div className="h-20 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {activePhase && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">Active Phase: {activePhase.name}</span>
                    <Badge variant="secondary" className="text-xs">{activePhase.goalType}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {activePhase.startDate} - {activePhase.endDate}
                  </p>
                </div>
              )}
              
              {cycle ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">Workout Cycle: {cycle.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {cycle.cycleLength} days | {cycle.startDate} - {cycle.endDate}
                  </p>
                  
                  <Tabs defaultValue="0" className="w-full">
                    <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                      {cycleDays.map((dayIndex) => {
                        const isRestDay = cycleRestDays.includes(dayIndex);
                        const label = cycleDayLabels[dayIndex] || `Day ${dayIndex + 1}`;
                        const exerciseCount = cycleItemsByDay[dayIndex]?.length || 0;
                        return (
                          <TabsTrigger 
                            key={dayIndex} 
                            value={dayIndex.toString()}
                            className="flex-1 min-w-[50px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                          >
                            {isRestDay && <Moon className="w-3 h-3 mr-1" />}
                            <span className="text-xs truncate max-w-[80px]">{label || `D${dayIndex + 1}`}</span>
                            {!isRestDay && exerciseCount > 0 && (
                              <span className="ml-1 text-[10px] opacity-70">({exerciseCount})</span>
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                    
                    {cycleDays.map((dayIndex) => {
                      const dayItems = cycleItemsByDay[dayIndex] || [];
                      const isRestDay = cycleRestDays.includes(dayIndex);
                      const label = cycleDayLabels[dayIndex] || `Day ${dayIndex + 1}`;
                      
                      return (
                        <TabsContent key={dayIndex} value={dayIndex.toString()} className="mt-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm">{label}</h4>
                              {isRestDay && <Badge variant="secondary"><Moon className="w-3 h-3 mr-1" />Rest Day</Badge>}
                            </div>
                            
                            {isRestDay ? (
                              <div className="py-6 text-center text-muted-foreground bg-muted/30 rounded-lg">
                                <Moon className="w-6 h-6 mx-auto mb-2" />
                                <p>Rest day - No exercises</p>
                              </div>
                            ) : dayItems.length === 0 ? (
                              <div className="py-6 text-center text-muted-foreground bg-muted/30 rounded-lg">
                                <Dumbbell className="w-6 h-6 mx-auto mb-2" />
                                <p>No exercises for this day</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {dayItems.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0)).map((item: any, idx: number) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                                  >
                                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                      {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{item.exerciseName}</span>
                                        {item.muscleType && (
                                          <Badge variant="outline" className="text-xs">{item.muscleType}</Badge>
                                        )}
                                      </div>
                                      <p className="text-sm text-muted-foreground">
                                        {item.sets} sets x {item.reps} reps
                                        {item.weight && ` @ ${item.weight}`}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                  <Dumbbell className="w-8 h-8 mx-auto mb-2" />
                  <p>No workout cycle assigned yet</p>
                </div>
              )}
              
              {phases.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">Training Phases</h3>
                    <Badge variant="secondary">{phases.length}</Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {phases.map((phase) => {
                      const isActive = activePhase?.id === phase.id;
                      const phaseExercises = phase.exercises || [];
                      const phaseDayLabels = phase.dayLabels || [];
                      const phaseRestDays = phase.restDays || [];
                      
                      const exercisesByDay = phaseExercises.reduce((acc: Record<number, any[]>, ex: any) => {
                        const dayIndex = ex.dayIndex ?? 0;
                        if (!acc[dayIndex]) acc[dayIndex] = [];
                        acc[dayIndex].push(ex);
                        return acc;
                      }, {});
                      
                      const maxDay = Math.max(
                        phaseExercises.length > 0 ? Math.max(...phaseExercises.map((e: any) => e.dayIndex ?? 0)) : -1,
                        phaseDayLabels.length - 1,
                        phaseRestDays.length > 0 ? Math.max(...phaseRestDays) : -1,
                        0
                      );
                      const phaseDays = Array.from({ length: maxDay + 1 }, (_, i) => i);
                      
                      return (
                        <div 
                          key={phase.id} 
                          className={`p-4 rounded-lg border ${isActive ? "border-primary bg-primary/5" : "bg-card"}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{phase.name}</span>
                              {isActive && <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Active</Badge>}
                              <Badge variant="outline" className="text-xs">{phase.goalType}</Badge>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {phase.startDate} - {phase.endDate}
                            </span>
                          </div>
                          
                          {phase.useCustomExercises && phaseDays.length > 0 ? (
                            <div className="mt-3 space-y-3">
                              <p className="text-sm font-medium text-muted-foreground">Phase Exercises:</p>
                              <Tabs defaultValue="0" className="w-full">
                                <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                                  {phaseDays.map((dayIndex) => {
                                    const isRestDay = phaseRestDays.includes(dayIndex);
                                    const dayLabel = phaseDayLabels[dayIndex] || `Day ${dayIndex + 1}`;
                                    const exerciseCount = exercisesByDay[dayIndex]?.length || 0;
                                    return (
                                      <TabsTrigger 
                                        key={dayIndex} 
                                        value={dayIndex.toString()}
                                        className="flex-1 min-w-[40px] text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                      >
                                        {isRestDay && <Moon className="w-3 h-3 mr-1" />}
                                        <span>{dayLabel.substring(0, 6) || `D${dayIndex + 1}`}</span>
                                        {!isRestDay && exerciseCount > 0 && (
                                          <span className="ml-1 text-[10px] opacity-70">({exerciseCount})</span>
                                        )}
                                      </TabsTrigger>
                                    );
                                  })}
                                </TabsList>
                                
                                {phaseDays.map((dayIndex) => {
                                  const dayExercises = exercisesByDay[dayIndex] || [];
                                  const isRestDay = phaseRestDays.includes(dayIndex);
                                  const dayLabel = phaseDayLabels[dayIndex] || `Day ${dayIndex + 1}`;
                                  
                                  return (
                                    <TabsContent key={dayIndex} value={dayIndex.toString()} className="mt-3">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-semibold text-xs">{dayLabel}</h4>
                                          {isRestDay && <Badge variant="secondary" className="text-xs"><Moon className="w-2 h-2 mr-1" />Rest</Badge>}
                                        </div>
                                        
                                        {isRestDay ? (
                                          <div className="py-4 text-center text-muted-foreground bg-muted/30 rounded-lg text-sm">
                                            <Moon className="w-5 h-5 mx-auto mb-1" />
                                            <p>Rest day - No exercises</p>
                                          </div>
                                        ) : dayExercises.length === 0 ? (
                                          <div className="py-4 text-center text-muted-foreground bg-muted/30 rounded-lg text-sm">
                                            <Dumbbell className="w-5 h-5 mx-auto mb-1" />
                                            <p>No exercises</p>
                                          </div>
                                        ) : (
                                          <div className="space-y-1.5">
                                            {dayExercises.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0)).map((ex: any, idx: number) => (
                                              <div
                                                key={ex.id}
                                                className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm"
                                              >
                                                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                                                  {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-medium text-sm">{ex.exerciseName}</span>
                                                    {ex.muscleType && (
                                                      <Badge variant="outline" className="text-[10px]">{ex.muscleType}</Badge>
                                                    )}
                                                  </div>
                                                  <p className="text-xs text-muted-foreground">
                                                    {ex.sets} sets x {ex.reps} reps
                                                    {ex.weight && ` @ ${ex.weight}`}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </TabsContent>
                                  );
                                })}
                              </Tabs>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {phase.useCustomExercises ? "No exercises defined" : "Using cycle exercises"}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Minus className="w-3 h-3 mr-1" />
        N/A
      </Badge>
    );
  }
  
  if (status === 'paid') {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
        <Check className="w-3 h-3 mr-1" />
        Paid
      </Badge>
    );
  }
  
  if (status === 'partial') {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
        Partial
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
      <X className="w-3 h-3 mr-1" />
      Unpaid
    </Badge>
  );
}

function AssignTrainerDialog({ memberId, memberName, currentTrainer }: { memberId: number; memberName: string; currentTrainer: string | null }) {
  const [open, setOpen] = useState(false);
  const { data: trainers = [] } = useTrainers();
  const assignMutation = useAssignTrainer();
  
  const trainersList = trainers as any[];
  
  const formSchema = z.object({
    trainerId: z.coerce.number().min(1, "Please select a trainer"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    assignMutation.mutate({ memberId, trainerId: data.trainerId }, {
      onSuccess: () => setOpen(false)
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          data-testid={`button-assign-trainer-${memberId}`}
          onClick={(e) => e.stopPropagation()}
        >
          {currentTrainer ? "Reassign" : "Assign Trainer"}
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Assign Trainer to {memberName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={(e) => { e.stopPropagation(); form.handleSubmit(onSubmit)(e); }} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="trainerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Trainer</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-trainer">
                        <SelectValue placeholder="Select a trainer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {trainersList.map((t: any) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={assignMutation.isPending} data-testid="button-submit-assign">
                {assignMutation.isPending ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
