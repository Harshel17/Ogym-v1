import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useTrainers, useAssignTrainer, useMembersDetails } from "@/hooks/use-gym";
import { useTrainerMembers } from "@/hooks/use-workouts";
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
import { Search, Shield, Check, X, Minus } from "lucide-react";
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
};

export default function MembersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  
  const isOwner = user?.role === "owner";
  const isTrainer = user?.role === "trainer";
  
  const { data: ownerMembersDetails = [], isLoading: ownerLoading } = useMembersDetails();
  const { data: trainerMembers = [], isLoading: trainerLoading } = useTrainerMembers();
  
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

  const filteredMembers = members.filter((m: any) => 
    m.username?.toLowerCase().includes(search.toLowerCase()) || 
    m.role?.toLowerCase().includes(search.toLowerCase())
  );

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
          <div className="flex items-center gap-2">
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
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
                      {isTrainer ? "No members assigned to you yet." : "No members found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member: any) => (
                    <TableRow key={member.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-member-${member.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {member.username?.slice(0, 2).toUpperCase() || '??'}
                          </div>
                          {member.username}
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
                          {member.cycleEndDate ? (
                            <span className="text-sm">{member.cycleEndDate}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">No cycle</span>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
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
        <Button variant="outline" size="sm" data-testid={`button-assign-trainer-${memberId}`}>
          {currentTrainer ? "Reassign" : "Assign Trainer"}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Assign Trainer to {memberName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
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
