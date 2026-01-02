import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useAttendance, useMemberAttendance, useCheckin } from "@/hooks/use-gym";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarIcon, QrCode, CheckCircle2, XCircle, LogOut, LogIn } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

type GymHistoryRecord = {
  id: number;
  memberId: number;
  memberName: string;
  gymId: number;
  gymName: string;
  joinedAt: string;
  leftAt: string | null;
};

export default function AttendancePage() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  
  const dateStr = format(date, "yyyy-MM-dd");
  
  const { data: gymAttendance = [], isLoading: gymLoading } = useAttendance();
  const { data: myAttendance = [], isLoading: myLoading } = useMemberAttendance();
  
  const { data: gymHistory = [] } = useQuery<GymHistoryRecord[]>({
    queryKey: ["/api/owner/gym-history"],
    enabled: user?.role === 'owner'
  });

  const isOwner = user?.role === 'owner';
  const isMember = user?.role === 'member';
  
  const attendanceList = (isOwner ? gymAttendance : myAttendance) as any[];
  const isLoading = isOwner ? gymLoading : myLoading;
  
  const filteredList = isOwner 
    ? attendanceList.filter(a => a.date === dateStr)
    : attendanceList;
    
  const getTransferStatus = (memberId: number, date: string): { left: boolean; joined: boolean } | null => {
    const record = gymHistory.find(h => {
      const leftDate = h.leftAt ? h.leftAt.split('T')[0] : null;
      const joinedDate = h.joinedAt.split('T')[0];
      return h.memberId === memberId && (leftDate === date || joinedDate === date);
    });
    if (!record) return null;
    return {
      left: record.leftAt?.split('T')[0] === date,
      joined: record.joinedAt.split('T')[0] === date
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Attendance</h2>
          <p className="text-muted-foreground mt-1">Track daily check-ins and history.</p>
        </div>
        {isMember && <CheckinDialog />}
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {isOwner && (
          <div className="lg:col-span-1">
            <Card className="dashboard-card h-full">
              <CardHeader>
                <CardTitle>Filter by Date</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  className="rounded-md border w-full"
                />
              </CardContent>
            </Card>
          </div>
        )}

        <div className={isOwner ? "lg:col-span-3" : "lg:col-span-4"}>
          <Card className="dashboard-card min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>
                {isOwner ? `Records for ${format(date, "MMMM do, yyyy")}` : 'My Attendance History'}
              </CardTitle>
              <div className="text-sm text-muted-foreground font-medium">
                Total: {filteredList.length}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      {isOwner && <TableHead>Member</TableHead>}
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Method</TableHead>
                      {isOwner && <TableHead>Transfer</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={isOwner ? 5 : 4} className="h-24 text-center">Loading...</TableCell>
                      </TableRow>
                    ) : filteredList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isOwner ? 5 : 4} className="h-24 text-center text-muted-foreground">
                          No records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredList.map((record: any) => (
                        <TableRow key={record.id} className="hover:bg-muted/50 transition-colors">
                          {isOwner && (
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                                  {record.member?.username?.slice(0, 2).toUpperCase() || '??'}
                                </div>
                                {record.member?.username || 'Unknown'}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground">
                            {record.date}
                          </TableCell>
                          <TableCell>
                            {record.status === 'present' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Present
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                <XCircle className="w-3.5 h-3.5" /> Absent
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {record.verifiedMethod || 'manual'}
                            </Badge>
                          </TableCell>
                          {isOwner && (
                            <TableCell>
                              {(() => {
                                const transfer = getTransferStatus(record.member?.id, record.date);
                                if (!transfer) return <span className="text-muted-foreground">-</span>;
                                if (transfer.left) {
                                  return (
                                    <Badge variant="outline" className="text-red-500 border-red-500/30">
                                      <LogOut className="w-3 h-3 mr-1" />
                                      Left
                                    </Badge>
                                  );
                                }
                                if (transfer.joined) {
                                  return (
                                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                                      <LogIn className="w-3 h-3 mr-1" />
                                      Joined
                                    </Badge>
                                  );
                                }
                                return <span className="text-muted-foreground">-</span>;
                              })()}
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
      </div>
    </div>
  );
}

function CheckinDialog() {
  const [open, setOpen] = useState(false);
  const checkinMutation = useCheckin();
  
  const formSchema = z.object({
    gym_code: z.string().min(1, "Gym code is required"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { gym_code: "" },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    checkinMutation.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20" data-testid="button-checkin">
          <QrCode className="w-4 h-4 mr-2" /> Check In
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Check In to Gym</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="gym_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gym Code</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter gym code (e.g., DEMO01)" 
                      {...field} 
                      className="h-11 text-center font-mono text-lg uppercase"
                      data-testid="input-gym-code"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="text-sm text-muted-foreground">
              Scan the QR code at your gym or enter the code manually.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={checkinMutation.isPending} data-testid="button-submit-checkin">
                {checkinMutation.isPending ? "Checking in..." : "Check In"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
