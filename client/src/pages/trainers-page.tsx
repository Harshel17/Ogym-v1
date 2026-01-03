import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, Users, ChevronDown, ChevronUp, Dumbbell, Calendar, Clock, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { User as UserType, WorkoutCycle, WorkoutItem } from "@shared/schema";

type TrainerWithMembers = {
  trainer: UserType;
  members: UserType[];
};

type MemberOverview = {
  member: UserType;
  cycle: (WorkoutCycle & { items: WorkoutItem[]; trainerName: string }) | null;
  history: { id: number; exerciseName: string; muscleType: string | null; completedDate: string; actualSets: number | null; actualReps: number | null; actualWeight: string | null }[];
};

function MemberDetailPanel({ memberId }: { memberId: number }) {
  const [showHistory, setShowHistory] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  
  const { data: overview, isLoading } = useQuery<MemberOverview>({
    queryKey: [`/api/owner/members/${memberId}/overview`],
  });

  if (isLoading) {
    return (
      <div className="p-4 border-t bg-muted/20 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-4 border-t bg-muted/20">
        <p className="text-sm text-muted-foreground">Unable to load member details.</p>
      </div>
    );
  }

  const { cycle, history } = overview;

  const historyByDate = history.reduce((acc: Record<string, typeof history>, entry) => {
    if (!acc[entry.completedDate]) {
      acc[entry.completedDate] = [];
    }
    acc[entry.completedDate].push(entry);
    return acc;
  }, {});

  return (
    <div className="p-4 border-t bg-muted/20 space-y-4">
      {cycle ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Dumbbell className="w-4 h-4 text-primary" />
            <span className="font-medium">{cycle.name}</span>
            <Badge variant="secondary" className="text-xs">{cycle.cycleLength} day cycle</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Trainer: {cycle.trainerName} | {cycle.startDate} to {cycle.endDate}
          </p>
          
          <div className="space-y-3">
            {Array.from({ length: cycle.cycleLength }, (_, idx) => {
              const dayLabel = cycle.dayLabels?.[idx] || `Day ${idx + 1}`;
              const dayItems = cycle.items.filter((w: WorkoutItem) => w.dayIndex === idx);
              const muscleTypes = Array.from(new Set(dayItems.map((w: WorkoutItem) => w.muscleType).filter(Boolean)));
              
              return (
                <div key={idx} className="bg-background/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{dayLabel}</span>
                    {muscleTypes.length > 0 && (
                      <span className="text-xs text-muted-foreground">({muscleTypes.join(" + ")})</span>
                    )}
                  </div>
                  {dayItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No exercises</p>
                  ) : (
                    <div className="space-y-1">
                      {dayItems.map((item: WorkoutItem) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{item.exerciseName}</span>
                          <span>-</span>
                          <span>{item.sets}x{item.reps}</span>
                          {item.weight && <span>@ {item.weight}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No workout cycle assigned yet.</p>
        </div>
      )}

      <div className="border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full justify-between"
          data-testid={`button-history-toggle-${memberId}`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Workout History ({Object.keys(historyByDate).length} days)</span>
          </div>
          {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        
        {showHistory && (
          <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
            {Object.keys(historyByDate).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No workout history yet.</p>
            ) : (
              Object.entries(historyByDate).map(([date, exercises]) => {
                const muscleTypes = Array.from(new Set(exercises.map(e => e.muscleType).filter(Boolean)));
                const isExpanded = expandedDate === date;
                
                return (
                  <div key={date} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedDate(isExpanded ? null : date)}
                      className="w-full flex items-center justify-between p-3 bg-background/50 hover-elevate cursor-pointer text-left"
                      data-testid={`button-history-date-${date}`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">{date}</span>
                        <span className="text-sm text-muted-foreground">
                          {muscleTypes.length > 0 ? muscleTypes.join(" + ") : "Workout"}
                        </span>
                        <Badge variant="secondary" className="text-xs">{exercises.length} exercises</Badge>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {isExpanded && (
                      <div className="p-3 border-t bg-muted/20 space-y-2">
                        {exercises.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between p-2 bg-background/50 rounded text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entry.exerciseName}</span>
                              {entry.muscleType && <Badge variant="outline" className="text-xs">{entry.muscleType}</Badge>}
                            </div>
                            <div className="text-sm">
                              {entry.actualSets && entry.actualReps ? (
                                <span className="font-medium">{entry.actualSets}x{entry.actualReps}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                              {entry.actualWeight && <span className="text-muted-foreground ml-1">@ {entry.actualWeight}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrainersPage() {
  const [expandedMember, setExpandedMember] = useState<number | null>(null);
  const [trainerSearch, setTrainerSearch] = useState("");
  const [memberSearches, setMemberSearches] = useState<Record<number, string>>({});
  
  const { data: trainersOverview = [], isLoading } = useQuery<TrainerWithMembers[]>({
    queryKey: ["/api/owner/trainers-overview"],
  });

  const filteredTrainers = trainersOverview.filter(({ trainer }) =>
    trainer.username.toLowerCase().includes(trainerSearch.toLowerCase())
  );

  const getFilteredMembers = (trainerId: number, members: UserType[]) => {
    const search = memberSearches[trainerId] || "";
    if (!search) return members;
    return members.filter(member =>
      member.username.toLowerCase().includes(search.toLowerCase())
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-trainers-title">Trainer Management</h1>
          <p className="text-muted-foreground">View trainers and their assigned members.</p>
        </div>
        {trainersOverview.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search trainers..."
              value={trainerSearch}
              onChange={(e) => setTrainerSearch(e.target.value)}
              className="pl-9 pr-9"
              data-testid="input-search-trainers"
            />
            {trainerSearch && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setTrainerSearch("")}
                data-testid="button-clear-trainer-search"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {trainersOverview.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No trainers in your gym yet.
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Trainers can join using your gym code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Trainers ({filteredTrainers.length}{trainerSearch ? ` of ${trainersOverview.length}` : ""})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTrainers.length === 0 && trainerSearch ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No trainers found matching "{trainerSearch}"</p>
              </div>
            ) : (
            <Accordion type="multiple" className="space-y-2">
              {filteredTrainers.map(({ trainer, members }) => (
                <AccordionItem
                  key={trainer.id}
                  value={`trainer-${trainer.id}`}
                  className="border rounded-lg px-4"
                  data-testid={`accordion-trainer-${trainer.id}`}
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                          {trainer.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="font-medium" data-testid={`text-trainer-name-${trainer.id}`}>
                            {trainer.username}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {trainer.createdAt ? new Date(trainer.createdAt).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-4">
                        {members.length} {members.length === 1 ? "member" : "members"}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    {members.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-4 text-center bg-muted/50 rounded-lg">
                        No members assigned to this trainer yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Assigned Members
                          </p>
                          {members.length > 3 && (
                            <div className="relative flex-1 max-w-48">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                              <Input
                                placeholder="Search members..."
                                value={memberSearches[trainer.id] || ""}
                                onChange={(e) => setMemberSearches(prev => ({ ...prev, [trainer.id]: e.target.value }))}
                                className="h-7 pl-7 pr-7 text-xs"
                                data-testid={`input-search-members-${trainer.id}`}
                              />
                              {memberSearches[trainer.id] && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute right-0 top-1/2 -translate-y-1/2 h-7 w-7"
                                  onClick={() => setMemberSearches(prev => ({ ...prev, [trainer.id]: "" }))}
                                  data-testid={`button-clear-member-search-${trainer.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        {(() => {
                          const filteredMembers = getFilteredMembers(trainer.id, members);
                          if (filteredMembers.length === 0) {
                            return (
                              <div className="text-center py-4 text-muted-foreground text-sm">
                                No members found matching "{memberSearches[trainer.id]}"
                              </div>
                            );
                          }
                          return (
                            <div className="grid gap-2">
                              {filteredMembers.map((member) => {
                                const isExpanded = expandedMember === member.id;
                                return (
                                  <div
                                    key={member.id}
                                    className="border rounded-lg overflow-hidden"
                                    data-testid={`row-member-${member.id}`}
                                  >
                                    <button
                                      onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                                      className="w-full flex items-center justify-between p-3 bg-muted/30 hover-elevate cursor-pointer text-left"
                                      data-testid={`button-member-expand-${member.id}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                                          {member.username.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm" data-testid={`text-member-name-${member.id}`}>
                                            {member.username}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Joined {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "N/A"}
                                          </p>
                                        </div>
                                      </div>
                                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    
                                    {isExpanded && <MemberDetailPanel memberId={member.id} />}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
