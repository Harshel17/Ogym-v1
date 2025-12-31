import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, Users, ChevronDown } from "lucide-react";
import type { User as UserType } from "@shared/schema";

type TrainerWithMembers = {
  trainer: UserType;
  members: UserType[];
};

export default function TrainersPage() {
  const { data: trainersOverview = [], isLoading } = useQuery<TrainerWithMembers[]>({
    queryKey: ["/api/owner/trainers-overview"],
  });

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
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-trainers-title">Trainer Management</h1>
        <p className="text-muted-foreground">View trainers and their assigned members.</p>
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
              Trainers ({trainersOverview.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="space-y-2">
              {trainersOverview.map(({ trainer, members }) => (
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
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                          Assigned Members
                        </p>
                        <div className="grid gap-2">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                              data-testid={`row-member-${member.id}`}
                            >
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
                          ))}
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
