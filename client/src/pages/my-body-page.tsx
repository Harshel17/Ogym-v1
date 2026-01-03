import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Scale, Ruler, Activity, TrendingUp, TrendingDown, Minus, Plus, Loader2, Calendar, LineChart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type BodyMeasurement = {
  id: number;
  gymId: number;
  memberId: number;
  recordedDate: string;
  weight: number | null;
  height: number | null;
  bodyFat: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  biceps: number | null;
  thighs: number | null;
  notes: string | null;
  createdAt: string;
};

export default function MyBodyPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    recordedDate: new Date().toISOString().split("T")[0],
    weight: "",
    height: "",
    bodyFat: "",
    chest: "",
    waist: "",
    hips: "",
    biceps: "",
    thighs: "",
    notes: ""
  });

  const { data: measurements = [], isLoading } = useQuery<BodyMeasurement[]>({
    queryKey: ["/api/me/body"]
  });

  const { data: latest } = useQuery<BodyMeasurement | null>({
    queryKey: ["/api/me/body/latest"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/me/body", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/body"] });
      toast({ title: "Measurements saved!" });
      setIsOpen(false);
      setFormData({
        recordedDate: new Date().toISOString().split("T")[0],
        weight: "", height: "", bodyFat: "", chest: "", waist: "", hips: "", biceps: "", thighs: "", notes: ""
      });
    },
    onError: () => {
      toast({ title: "Failed to save measurements", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { recordedDate: formData.recordedDate };
    if (formData.weight) payload.weight = parseInt(formData.weight);
    if (formData.height) payload.height = parseInt(formData.height);
    if (formData.bodyFat) payload.bodyFat = parseInt(formData.bodyFat);
    if (formData.chest) payload.chest = parseInt(formData.chest);
    if (formData.waist) payload.waist = parseInt(formData.waist);
    if (formData.hips) payload.hips = parseInt(formData.hips);
    if (formData.biceps) payload.biceps = parseInt(formData.biceps);
    if (formData.thighs) payload.thighs = parseInt(formData.thighs);
    if (formData.notes) payload.notes = formData.notes;
    createMutation.mutate(payload);
  };

  const getChange = (current: number | null, previous: number | null) => {
    if (current === null || previous === null) return null;
    return current - previous;
  };

  const getChangeIcon = (change: number | null, inverseGood = false) => {
    if (change === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (change === 0) return <Minus className="w-4 h-4 text-muted-foreground" />;
    const isPositive = change > 0;
    const isGood = inverseGood ? !isPositive : isPositive;
    if (isPositive) {
      return <TrendingUp className={`w-4 h-4 ${isGood ? "text-green-500" : "text-red-500"}`} />;
    }
    return <TrendingDown className={`w-4 h-4 ${isGood ? "text-green-500" : "text-red-500"}`} />;
  };

  const previous = measurements.length > 1 ? measurements[1] : null;

  const chartData = [...measurements].reverse().map(m => ({
    date: format(parseISO(m.recordedDate), "MMM d"),
    weight: m.weight,
    bodyFat: m.bodyFat,
    waist: m.waist
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">My Body</h2>
          <p className="text-muted-foreground mt-1">Track your body measurements and progress over time.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-measurement">
              <Plus className="w-4 h-4 mr-2" />
              Add Measurement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Measurements</DialogTitle>
              <DialogDescription>Enter your current body measurements. All fields are optional.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="recordedDate">Date</Label>
                <Input
                  id="recordedDate"
                  type="date"
                  value={formData.recordedDate}
                  onChange={e => setFormData({ ...formData, recordedDate: e.target.value })}
                  data-testid="input-recorded-date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="70"
                    value={formData.weight}
                    onChange={e => setFormData({ ...formData, weight: e.target.value })}
                    data-testid="input-weight"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="175"
                    value={formData.height}
                    onChange={e => setFormData({ ...formData, height: e.target.value })}
                    data-testid="input-height"
                  />
                </div>
                <div>
                  <Label htmlFor="bodyFat">Body Fat (%)</Label>
                  <Input
                    id="bodyFat"
                    type="number"
                    placeholder="15"
                    value={formData.bodyFat}
                    onChange={e => setFormData({ ...formData, bodyFat: e.target.value })}
                    data-testid="input-body-fat"
                  />
                </div>
                <div>
                  <Label htmlFor="chest">Chest (cm)</Label>
                  <Input
                    id="chest"
                    type="number"
                    placeholder="100"
                    value={formData.chest}
                    onChange={e => setFormData({ ...formData, chest: e.target.value })}
                    data-testid="input-chest"
                  />
                </div>
                <div>
                  <Label htmlFor="waist">Waist (cm)</Label>
                  <Input
                    id="waist"
                    type="number"
                    placeholder="80"
                    value={formData.waist}
                    onChange={e => setFormData({ ...formData, waist: e.target.value })}
                    data-testid="input-waist"
                  />
                </div>
                <div>
                  <Label htmlFor="hips">Hips (cm)</Label>
                  <Input
                    id="hips"
                    type="number"
                    placeholder="95"
                    value={formData.hips}
                    onChange={e => setFormData({ ...formData, hips: e.target.value })}
                    data-testid="input-hips"
                  />
                </div>
                <div>
                  <Label htmlFor="biceps">Biceps (cm)</Label>
                  <Input
                    id="biceps"
                    type="number"
                    placeholder="35"
                    value={formData.biceps}
                    onChange={e => setFormData({ ...formData, biceps: e.target.value })}
                    data-testid="input-biceps"
                  />
                </div>
                <div>
                  <Label htmlFor="thighs">Thighs (cm)</Label>
                  <Input
                    id="thighs"
                    type="number"
                    placeholder="55"
                    value={formData.thighs}
                    onChange={e => setFormData({ ...formData, thighs: e.target.value })}
                    data-testid="input-thighs"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any notes about your progress..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  data-testid="input-notes"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-measurement">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Measurements
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {latest && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Weight</span>
                </div>
                {getChangeIcon(getChange(latest.weight, previous?.weight ?? null), true)}
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold" data-testid="text-current-weight">
                  {latest.weight ?? "-"}
                </span>
                <span className="text-muted-foreground ml-1">kg</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Height</span>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold" data-testid="text-current-height">
                  {latest.height ?? "-"}
                </span>
                <span className="text-muted-foreground ml-1">cm</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Body Fat</span>
                </div>
                {getChangeIcon(getChange(latest.bodyFat, previous?.bodyFat ?? null), true)}
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold" data-testid="text-current-body-fat">
                  {latest.bodyFat ?? "-"}
                </span>
                <span className="text-muted-foreground ml-1">%</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Waist</span>
                </div>
                {getChangeIcon(getChange(latest.waist, previous?.waist ?? null), true)}
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold" data-testid="text-current-waist">
                  {latest.waist ?? "-"}
                </span>
                <span className="text-muted-foreground ml-1">cm</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Progress Chart
            </CardTitle>
            <CardDescription>Your body measurements over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="weight" stroke="#8b5cf6" strokeWidth={2} name="Weight (kg)" dot={{ fill: "#8b5cf6" }} />
                  <Line type="monotone" dataKey="bodyFat" stroke="#06b6d4" strokeWidth={2} name="Body Fat (%)" dot={{ fill: "#06b6d4" }} />
                  <Line type="monotone" dataKey="waist" stroke="#f59e0b" strokeWidth={2} name="Waist (cm)" dot={{ fill: "#f59e0b" }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Measurement History
          </CardTitle>
          <CardDescription>All your recorded measurements</CardDescription>
        </CardHeader>
        <CardContent>
          {measurements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No measurements recorded yet. Click "Add Measurement" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {measurements.map((m, index) => (
                <div key={m.id} className="border rounded-md p-4" data-testid={`measurement-row-${m.id}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">{format(parseISO(m.recordedDate), "MMMM d, yyyy")}</span>
                    {index === 0 && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Latest</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    {m.weight && (
                      <div>
                        <span className="text-muted-foreground">Weight:</span>{" "}
                        <span className="font-medium">{m.weight} kg</span>
                      </div>
                    )}
                    {m.height && (
                      <div>
                        <span className="text-muted-foreground">Height:</span>{" "}
                        <span className="font-medium">{m.height} cm</span>
                      </div>
                    )}
                    {m.bodyFat && (
                      <div>
                        <span className="text-muted-foreground">Body Fat:</span>{" "}
                        <span className="font-medium">{m.bodyFat}%</span>
                      </div>
                    )}
                    {m.chest && (
                      <div>
                        <span className="text-muted-foreground">Chest:</span>{" "}
                        <span className="font-medium">{m.chest} cm</span>
                      </div>
                    )}
                    {m.waist && (
                      <div>
                        <span className="text-muted-foreground">Waist:</span>{" "}
                        <span className="font-medium">{m.waist} cm</span>
                      </div>
                    )}
                    {m.hips && (
                      <div>
                        <span className="text-muted-foreground">Hips:</span>{" "}
                        <span className="font-medium">{m.hips} cm</span>
                      </div>
                    )}
                    {m.biceps && (
                      <div>
                        <span className="text-muted-foreground">Biceps:</span>{" "}
                        <span className="font-medium">{m.biceps} cm</span>
                      </div>
                    )}
                    {m.thighs && (
                      <div>
                        <span className="text-muted-foreground">Thighs:</span>{" "}
                        <span className="font-medium">{m.thighs} cm</span>
                      </div>
                    )}
                  </div>
                  {m.notes && (
                    <div className="mt-3 text-sm text-muted-foreground italic">{m.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
