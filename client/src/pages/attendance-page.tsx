import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useAttendance, useMemberAttendance, useCheckin } from "@/hooks/use-gym";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, QrCode, CheckCircle2, XCircle, LogOut, LogIn, Search, X, Sparkles, Send, Loader2, Camera, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Html5Qrcode } from "html5-qrcode";

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
  const { toast } = useToast();
  const [date, setDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [dikaQuery, setDikaQuery] = useState("");
  const [dikaResponse, setDikaResponse] = useState<{ answer: string; results: { member: string; detail?: string }[]; filterNames?: string[] } | null>(null);
  const [dikaFilterNames, setDikaFilterNames] = useState<string[] | null>(null);
  
  const dateStr = format(date, "yyyy-MM-dd");
  
  const { data: gymAttendance = [], isLoading: gymLoading } = useAttendance();
  const { data: myAttendance = [], isLoading: myLoading } = useMemberAttendance();
  
  const { data: gymHistory = [] } = useQuery<GymHistoryRecord[]>({
    queryKey: ["/api/owner/gym-history"],
    enabled: user?.role === 'owner'
  });

  const isOwner = user?.role === 'owner';
  const isMember = user?.role === 'member';

  const dikaMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/owner/ask-dika-attendance", { question });
      return res.json();
    },
    onSuccess: (data: any) => {
      setDikaResponse(data);
      if (data.filterNames && data.filterNames.length > 0) {
        setDikaFilterNames(data.filterNames);
      } else {
        setDikaFilterNames(null);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Dika couldn't answer", description: err.message, variant: "destructive" });
    }
  });

  const handleDikaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dikaQuery.trim()) return;
    dikaMutation.mutate(dikaQuery.trim());
  };
  
  const attendanceList = (isOwner ? gymAttendance : myAttendance) as any[];
  const isLoading = isOwner ? gymLoading : myLoading;
  
  const dateFilteredList = isOwner 
    ? attendanceList.filter(a => a.date === dateStr)
    : attendanceList;
  
  const dikaFiltered = (isOwner && dikaFilterNames)
    ? dateFilteredList.filter((a: any) => 
        dikaFilterNames.some(name => a.member?.username?.toLowerCase().includes(name.toLowerCase())))
    : dateFilteredList;
  
  const filteredList = (!isOwner && searchQuery)
    ? dikaFiltered.filter((a: any) => {
        const searchLower = searchQuery.toLowerCase();
        const dateMatch = a.date?.includes(searchQuery) || 
                         format(new Date(a.date), "EEEE, MMMM d").toLowerCase().includes(searchLower);
        const statusMatch = a.status?.toLowerCase().includes(searchLower);
        const methodMatch = a.verifiedMethod?.toLowerCase().includes(searchLower);
        return dateMatch || statusMatch || methodMatch;
      })
    : dikaFiltered;
    
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
      <div className="page-header-gradient">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">Attendance</h2>
            <p className="text-sm text-muted-foreground mt-1">Track daily check-ins and history.</p>
          </div>
          {isMember && <CheckinDialog />}
        </div>
      </div>

      {isMember && myAttendance.length > 0 && (() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
        const attendanceDates = new Set(myAttendance.filter((a: any) => a.status === 'present' && a.date).map((a: any) => {
          const d = a.date?.split('T')[0];
          return d || a.date;
        }));
        const monthName = format(new Date(currentYear, currentMonth, 1), 'MMMM yyyy');
        const presentCount = Array.from({ length: daysInMonth }, (_, i) => {
          const d = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
          return attendanceDates.has(d) ? 1 : 0;
        }).reduce((a, b) => a + b, 0);

        return (
          <Card className="card-ambient" data-testid="card-attendance-heatmap">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm">
                    <CalendarIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{monthName}</p>
                    <p className="text-[10px] text-muted-foreground">{presentCount} check-ins this month</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} className="text-[9px] text-muted-foreground font-medium py-1">{d}</div>
                ))}
                {Array.from({ length: firstDayOfWeek }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const dayNum = i + 1;
                  const dateStr2 = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isPresent = attendanceDates.has(dateStr2);
                  const isToday2 = dayNum === today.getDate();
                  const isFuture = dayNum > today.getDate();
                  return (
                    <div
                      key={dayNum}
                      className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors ${
                        isPresent
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                          : isFuture
                            ? 'bg-muted/20 text-muted-foreground/40'
                            : isToday2
                              ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                              : 'bg-muted/30 text-muted-foreground/60'
                      }`}
                      data-testid={`heatmap-day-${dayNum}`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 justify-center" data-testid="heatmap-legend">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-muted/30 border border-border/50" />
                  <span className="text-[10px] text-muted-foreground">Absent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/15 ring-1 ring-primary/30" />
                  <span className="text-[10px] text-muted-foreground">Today</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {isOwner && (
        <div className="space-y-3">
          <form onSubmit={handleDikaSubmit} className="relative" data-testid="form-ask-dika-attendance">
            <div className="relative flex items-center">
              <Sparkles className="absolute left-3 h-4 w-4 text-purple-500" />
              <Input
                placeholder='Ask Dika about attendance... e.g. "Who&#39;s been absent for 5+ days?" or "Show today&#39;s check-ins"'
                value={dikaQuery}
                onChange={(e) => setDikaQuery(e.target.value)}
                className="pl-10 pr-12 h-11 bg-card border-purple-200 dark:border-purple-800 focus-visible:ring-purple-500 placeholder:text-muted-foreground/60"
                data-testid="input-ask-dika-attendance"
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                disabled={dikaMutation.isPending || !dikaQuery.trim()}
                className="absolute right-1 text-purple-500"
                data-testid="button-ask-dika-attendance-submit"
              >
                {dikaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </form>

          {dikaMutation.isPending && (
            <Card className="border-purple-200 dark:border-purple-800">
              <CardContent className="py-6 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                <span className="text-sm text-muted-foreground">Dika is analyzing attendance...</span>
              </CardContent>
            </Card>
          )}

          {dikaResponse && !dikaMutation.isPending && (
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10" data-testid="dika-attendance-results-card">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground" data-testid="text-dika-attendance-answer">{dikaResponse.answer}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => { setDikaResponse(null); setDikaQuery(""); setDikaFilterNames(null); }}
                    data-testid="button-dismiss-dika-attendance"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {dikaResponse.results && dikaResponse.results.length > 0 && (
                  <div className="mt-2 space-y-1 ml-6">
                    {dikaResponse.results.slice(0, 10).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{r.member}</span>
                        {r.detail && <span>— {r.detail}</span>}
                      </div>
                    ))}
                    {dikaResponse.results.length > 10 && (
                      <p className="text-xs text-muted-foreground">...and {dikaResponse.results.length - 10} more</p>
                    )}
                  </div>
                )}
                {dikaFilterNames && (
                  <div className="flex items-center gap-2 mt-3 ml-6">
                    <Badge variant="outline" className="text-[10px] border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                      Table filtered: {dikaFilterNames.length} member{dikaFilterNames.length !== 1 ? 's' : ''}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setDikaFilterNames(null)}
                      data-testid="button-clear-dika-attendance-filter"
                    >
                      Show all
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {isOwner && (
          <div className="lg:col-span-1">
            <Card className="dashboard-card h-full">
              <CardHeader className="pb-2">
                <CardTitle className="whitespace-nowrap text-base">Filter by Date</CardTitle>
              </CardHeader>
              <CardContent className="p-2 sm:p-4">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  className="rounded-md border mx-auto"
                />
              </CardContent>
            </Card>
          </div>
        )}

        <div className={isOwner ? "lg:col-span-3" : "lg:col-span-4"}>
          <Card className="dashboard-card min-h-[500px]">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-2">
                <CardTitle>
                  {isOwner ? `Records for ${format(date, "MMMM do, yyyy")}` : 'My Attendance History'}
                </CardTitle>
                <div className="text-sm text-muted-foreground font-medium">
                  Total: {filteredList.length}
                </div>
              </div>
              {!isOwner && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by date, status, or method..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                    data-testid="input-search-attendance"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchQuery("")}
                      data-testid="button-clear-search"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-24 flex items-center justify-center">Loading...</div>
              ) : filteredList.length === 0 ? (
                <div className="h-24 flex items-center justify-center text-muted-foreground">
                  No records found.
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {filteredList.map((record: any) => {
                      const transfer = isOwner ? getTransferStatus(record.member?.id, record.date) : null;
                      return (
                        <div
                          key={record.id}
                          className="p-4 rounded-xl border bg-card"
                          data-testid={`card-attendance-${record.id}`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              {isOwner && (
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                                  {record.member?.username?.slice(0, 2).toUpperCase() || '??'}
                                </div>
                              )}
                              <div>
                                {isOwner && <p className="font-semibold">{record.member?.username || 'Unknown'}</p>}
                                <p className="text-sm text-muted-foreground">{record.date}</p>
                              </div>
                            </div>
                            {record.status === 'present' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Present
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 shrink-0">
                                <XCircle className="w-3.5 h-3.5" /> Absent
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t">
                            <Badge variant="outline" className="text-xs">
                              {record.verifiedMethod || 'manual'}
                            </Badge>
                            {isOwner && transfer && (
                              transfer.left ? (
                                <Badge variant="outline" className="text-red-500 border-red-500/30">
                                  <LogOut className="w-3 h-3 mr-1" />
                                  Left
                                </Badge>
                              ) : transfer.joined ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                                  <LogIn className="w-3 h-3 mr-1" />
                                  Joined
                                </Badge>
                              ) : null
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-md border border-border overflow-hidden">
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
                        {filteredList.map((record: any) => (
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QrScannerTab({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannedRef = useRef(false);

  const scanCheckinMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const res = await apiRequest("POST", "/api/attendance/scan-checkin", { qr_data: qrData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      toast({ title: "Checked In!", description: "Your attendance has been recorded via QR scan" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
      scannedRef.current = false;
    },
  });

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const startScanner = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        const html5QrCode = new Html5Qrcode("checkin-qr-reader");
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (!scannedRef.current) {
              scannedRef.current = true;
              if (decodedText.startsWith("OGYM-CHECKIN:")) {
                scanCheckinMutation.mutate(decodedText);
              } else {
                toast({ title: "Invalid QR Code", description: "This QR code is not a gym check-in code", variant: "destructive" });
                scannedRef.current = false;
              }
            }
          },
          () => {}
        );
        setIsStarting(false);
      } catch (err: any) {
        setIsStarting(false);
        if (err.name === "NotAllowedError") {
          setError("Camera access denied. Please allow camera access.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError("Could not start camera. Try the Enter Code tab.");
        }
      }
    };

    startScanner();
    return () => { stopScanner(); };
  }, []);

  return (
    <div className="space-y-4 pt-4">
      {isStarting && !error && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Starting camera...</span>
        </div>
      )}
      {error && (
        <div className="text-center py-6 space-y-3">
          <Camera className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      )}
      {scanCheckinMutation.isPending && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Checking in...</span>
        </div>
      )}
      <div
        id="checkin-qr-reader"
        className={`w-full rounded-md overflow-hidden ${isStarting || error ? "hidden" : ""}`}
        data-testid="qr-scanner-view"
      />
      <p className="text-xs text-muted-foreground text-center">
        Point your camera at the gym's QR code to check in
      </p>
    </div>
  );
}

function CheckinDialog() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("scan-qr");
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

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setActiveTab("scan-qr");
      form.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20" data-testid="button-checkin">
          <QrCode className="w-4 h-4 mr-2" /> Check In
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Check In to Gym</DialogTitle>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="scan-qr" className="flex-1" data-testid="tab-scan-qr">
              <ScanLine className="w-4 h-4 mr-1.5" /> Scan QR
            </TabsTrigger>
            <TabsTrigger value="enter-code" className="flex-1" data-testid="tab-enter-code">
              Enter Code
            </TabsTrigger>
          </TabsList>
          <TabsContent value="scan-qr">
            {open && activeTab === "scan-qr" && (
              <QrScannerTab onSuccess={() => setOpen(false)} />
            )}
          </TabsContent>
          <TabsContent value="enter-code">
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
                  Enter the gym code provided by your gym.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-checkin">Cancel</Button>
                  <Button type="submit" disabled={checkinMutation.isPending} data-testid="button-submit-checkin">
                    {checkinMutation.isPending ? "Checking in..." : "Check In"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
