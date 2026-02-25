import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Wrench, Link2, X } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type EquipmentExercise = {
  id: number;
  equipmentId: number;
  exerciseName: string;
  priority: string;
};

type EquipmentItem = {
  id: number;
  gymId: number;
  name: string;
  category: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  exercises: EquipmentExercise[];
};

const CATEGORIES = [
  "Cardio",
  "Free Weights",
  "Machines",
  "Cable",
  "Benches",
  "Racks",
  "Accessories",
  "Other",
];

export default function OwnerEquipmentSetupPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newExercise, setNewExercise] = useState("");
  const [newPriority, setNewPriority] = useState("primary");

  const { data: equipment = [], isLoading } = useQuery<EquipmentItem[]>({
    queryKey: ["/api/owner/gym-equipment"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; quantity: number }) => {
      const res = await apiRequest("POST", "/api/owner/gym-equipment", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-intelligence/equipment-stress"] });
      setNewName("");
      setNewCategory("");
      setNewQuantity("1");
      toast({ title: "Equipment added" });
    },
    onError: () => toast({ title: "Failed to add equipment", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/owner/gym-equipment/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-intelligence/equipment-stress"] });
      toast({ title: "Equipment removed" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const addExerciseMutation = useMutation({
    mutationFn: async (data: { equipmentId: number; exerciseName: string; priority: string }) => {
      const res = await apiRequest("POST", `/api/owner/gym-equipment/${data.equipmentId}/exercises`, {
        exerciseName: data.exerciseName,
        priority: data.priority,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-intelligence/equipment-stress"] });
      setNewExercise("");
      setNewPriority("primary");
      toast({ title: "Exercise mapped" });
    },
    onError: () => toast({ title: "Failed to map exercise", variant: "destructive" }),
  });

  const removeExerciseMutation = useMutation({
    mutationFn: async (mappingId: number) => {
      await apiRequest("DELETE", `/api/owner/gym-equipment/exercises/${mappingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/gym-intelligence/equipment-stress"] });
      toast({ title: "Exercise mapping removed" });
    },
    onError: () => toast({ title: "Failed to remove mapping", variant: "destructive" }),
  });

  const handleAddEquipment = () => {
    if (!newName.trim() || !newCategory) return;
    addMutation.mutate({ name: newName, category: newCategory, quantity: parseInt(newQuantity) || 1 });
  };

  const grouped = CATEGORIES.reduce<Record<string, EquipmentItem[]>>((acc, cat) => {
    const items = equipment.filter(e => e.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-5 lg:max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/owner/gym-intelligence")} data-testid="button-back-intelligence">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="heading-equipment-setup">Equipment Setup</h1>
          <p className="text-xs text-muted-foreground">Register your gym's machines and map exercises to them</p>
        </div>
      </div>

      <Card className="card-elevated" data-testid="card-add-equipment">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Add Equipment
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Equipment name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 text-sm"
              data-testid="input-equipment-name"
            />
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-full sm:w-[140px] text-sm" data-testid="select-equipment-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Qty"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              className="w-full sm:w-[70px] text-sm"
              min="1"
              data-testid="input-equipment-quantity"
            />
            <Button
              size="sm"
              onClick={handleAddEquipment}
              disabled={!newName.trim() || !newCategory || addMutation.isPending}
              data-testid="button-add-equipment"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-12 text-center">
          <div className="animate-pulse text-sm text-muted-foreground">Loading equipment...</div>
        </div>
      ) : equipment.length === 0 ? (
        <div className="py-12 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">No equipment registered yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Add your gym's machines above to start tracking equipment stress</p>
          <p className="text-xs text-muted-foreground/60 mt-3 max-w-sm mx-auto">
            Even without custom exercise mappings, OGym uses a built-in generic mapping to estimate usage for common equipment types.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1" data-testid={`category-${category}`}>{category}</h3>
              <div className="space-y-2">
                {items.map(equip => (
                  <Card key={equip.id} className={`card-elevated transition-all ${expandedId === equip.id ? 'ring-1 ring-primary/30' : ''}`} data-testid={`equipment-item-${equip.id}`}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate" data-testid={`equipment-name-${equip.id}`}>{equip.name}</span>
                          {equip.quantity > 1 && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">{equip.quantity}x</Badge>
                          )}
                          {equip.exercises.length > 0 && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              <Link2 className="w-2.5 h-2.5 mr-0.5" />
                              {equip.exercises.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground shrink-0"
                        onClick={() => setExpandedId(expandedId === equip.id ? null : equip.id)}
                        data-testid={`button-toggle-exercises-${equip.id}`}
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1" />
                        Map
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground shrink-0"
                        onClick={() => deleteMutation.mutate(equip.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-equipment-${equip.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {expandedId === equip.id && (
                      <div className="px-4 pb-3 border-t border-border/50 pt-3 space-y-2">
                        <p className="text-[10px] text-muted-foreground/60">
                          Map exercises to this equipment for precise stress tracking. Without custom mappings, OGym uses generic estimates.
                        </p>
                        {equip.exercises.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {equip.exercises.map(ex => (
                              <Badge key={ex.id} variant={ex.priority === 'primary' ? 'default' : 'secondary'} className="text-[11px] gap-1 pr-1" data-testid={`exercise-mapping-${ex.id}`}>
                                {ex.exerciseName}
                                <button
                                  className="ml-0.5 rounded-full p-0.5 hover:bg-background/20"
                                  onClick={() => removeExerciseMutation.mutate(ex.id)}
                                  data-testid={`button-remove-exercise-${ex.id}`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Exercise name (e.g., Bench Press)"
                            value={expandedId === equip.id ? newExercise : ""}
                            onChange={(e) => setNewExercise(e.target.value)}
                            className="flex-1 text-xs"
                            data-testid={`input-exercise-name-${equip.id}`}
                          />
                          <Select value={newPriority} onValueChange={setNewPriority}>
                            <SelectTrigger className="w-[100px] text-xs" data-testid={`select-priority-${equip.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">Primary</SelectItem>
                              <SelectItem value="secondary">Secondary</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!newExercise.trim()) return;
                              addExerciseMutation.mutate({ equipmentId: equip.id, exerciseName: newExercise, priority: newPriority });
                            }}
                            disabled={!newExercise.trim() || addExerciseMutation.isPending}
                            data-testid={`button-add-exercise-${equip.id}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}