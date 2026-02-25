import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Wrench, Link2, X, Search } from "lucide-react";
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

const EQUIPMENT_DATABASE: { name: string; category: string }[] = [
  { name: "Treadmill", category: "Cardio" },
  { name: "Elliptical Trainer", category: "Cardio" },
  { name: "Stationary Bike", category: "Cardio" },
  { name: "Recumbent Bike", category: "Cardio" },
  { name: "Rowing Machine", category: "Cardio" },
  { name: "Stair Climber", category: "Cardio" },
  { name: "Air Bike (Assault Bike)", category: "Cardio" },
  { name: "Spin Bike", category: "Cardio" },
  { name: "Ski Erg", category: "Cardio" },
  { name: "Jacob's Ladder", category: "Cardio" },
  { name: "VersaClimber", category: "Cardio" },
  { name: "Jump Rope Station", category: "Cardio" },

  { name: "Dumbbells (Pair)", category: "Free Weights" },
  { name: "Dumbbell Set (Full Rack)", category: "Free Weights" },
  { name: "Olympic Barbell (20kg)", category: "Free Weights" },
  { name: "EZ Curl Bar", category: "Free Weights" },
  { name: "Trap Bar (Hex Bar)", category: "Free Weights" },
  { name: "Swiss Bar (Football Bar)", category: "Free Weights" },
  { name: "Safety Squat Bar", category: "Free Weights" },
  { name: "Kettlebell", category: "Free Weights" },
  { name: "Weight Plates (Olympic)", category: "Free Weights" },
  { name: "Bumper Plates", category: "Free Weights" },
  { name: "Medicine Ball", category: "Free Weights" },
  { name: "Slam Ball", category: "Free Weights" },
  { name: "Sand Bag", category: "Free Weights" },
  { name: "D-Ball", category: "Free Weights" },
  { name: "Bulgarian Bag", category: "Free Weights" },
  { name: "Steel Mace", category: "Free Weights" },
  { name: "Indian Club", category: "Free Weights" },

  { name: "Chest Press Machine", category: "Machines" },
  { name: "Incline Chest Press Machine", category: "Machines" },
  { name: "Pec Deck (Chest Fly Machine)", category: "Machines" },
  { name: "Shoulder Press Machine", category: "Machines" },
  { name: "Lateral Raise Machine", category: "Machines" },
  { name: "Rear Delt Machine", category: "Machines" },
  { name: "Lat Pulldown Machine", category: "Machines" },
  { name: "Seated Row Machine", category: "Machines" },
  { name: "T-Bar Row Machine", category: "Machines" },
  { name: "Assisted Pull-Up / Dip Machine", category: "Machines" },
  { name: "Leg Press Machine", category: "Machines" },
  { name: "Hack Squat Machine", category: "Machines" },
  { name: "V-Squat Machine", category: "Machines" },
  { name: "Leg Extension Machine", category: "Machines" },
  { name: "Leg Curl Machine (Lying)", category: "Machines" },
  { name: "Leg Curl Machine (Seated)", category: "Machines" },
  { name: "Hip Thrust Machine", category: "Machines" },
  { name: "Glute Kickback Machine", category: "Machines" },
  { name: "Hip Abductor Machine", category: "Machines" },
  { name: "Hip Adductor Machine", category: "Machines" },
  { name: "Calf Raise Machine (Standing)", category: "Machines" },
  { name: "Calf Raise Machine (Seated)", category: "Machines" },
  { name: "Smith Machine", category: "Machines" },
  { name: "Ab Crunch Machine", category: "Machines" },
  { name: "Rotary Torso Machine", category: "Machines" },
  { name: "Bicep Curl Machine", category: "Machines" },
  { name: "Tricep Extension Machine", category: "Machines" },
  { name: "Preacher Curl Machine", category: "Machines" },
  { name: "Multi-Hip Machine", category: "Machines" },
  { name: "Pendulum Squat", category: "Machines" },
  { name: "Belt Squat Machine", category: "Machines" },
  { name: "Reverse Hyper Machine", category: "Machines" },
  { name: "GHD (Glute Ham Developer)", category: "Machines" },

  { name: "Cable Crossover Machine", category: "Cable" },
  { name: "Dual Adjustable Pulley", category: "Cable" },
  { name: "Single Cable Column", category: "Cable" },
  { name: "Functional Trainer", category: "Cable" },
  { name: "Low Row Cable Machine", category: "Cable" },
  { name: "Cable Lat Pulldown Station", category: "Cable" },

  { name: "Flat Bench", category: "Benches" },
  { name: "Adjustable Bench (FID)", category: "Benches" },
  { name: "Incline Bench", category: "Benches" },
  { name: "Decline Bench", category: "Benches" },
  { name: "Olympic Flat Bench Press", category: "Benches" },
  { name: "Olympic Incline Bench Press", category: "Benches" },
  { name: "Olympic Decline Bench Press", category: "Benches" },
  { name: "Preacher Curl Bench", category: "Benches" },
  { name: "Hyperextension Bench (45°)", category: "Benches" },
  { name: "Ab Bench / Sit-Up Bench", category: "Benches" },
  { name: "Utility Bench", category: "Benches" },

  { name: "Power Rack (Full Cage)", category: "Racks" },
  { name: "Half Rack", category: "Racks" },
  { name: "Squat Rack (Squat Stand)", category: "Racks" },
  { name: "Dumbbell Rack", category: "Racks" },
  { name: "Kettlebell Rack", category: "Racks" },
  { name: "Weight Plate Tree", category: "Racks" },
  { name: "Barbell Holder Rack", category: "Racks" },
  { name: "Medicine Ball Rack", category: "Racks" },
  { name: "Olympic Lifting Platform", category: "Racks" },
  { name: "Deadlift Platform", category: "Racks" },
  { name: "Jammer Arms (Rack Attachment)", category: "Racks" },
  { name: "Monolift Attachment", category: "Racks" },

  { name: "Pull-Up Bar (Wall Mounted)", category: "Accessories" },
  { name: "Pull-Up Bar (Free Standing)", category: "Accessories" },
  { name: "Dip Station", category: "Accessories" },
  { name: "Battle Ropes", category: "Accessories" },
  { name: "TRX Suspension Trainer", category: "Accessories" },
  { name: "Resistance Bands Set", category: "Accessories" },
  { name: "Foam Roller", category: "Accessories" },
  { name: "Ab Roller", category: "Accessories" },
  { name: "Yoga Mat", category: "Accessories" },
  { name: "Stability Ball (Swiss Ball)", category: "Accessories" },
  { name: "BOSU Ball", category: "Accessories" },
  { name: "Plyo Box (Plyometric Box)", category: "Accessories" },
  { name: "Landmine Attachment", category: "Accessories" },
  { name: "Sled (Prowler)", category: "Accessories" },
  { name: "Tire (Flip Tire)", category: "Accessories" },
  { name: "Wrist Roller", category: "Accessories" },
  { name: "Fat Gripz", category: "Accessories" },
  { name: "Ankle Weights", category: "Accessories" },
  { name: "Weighted Vest", category: "Accessories" },
  { name: "Dip Belt", category: "Accessories" },
  { name: "Lifting Belt", category: "Accessories" },
  { name: "Arm Blaster", category: "Accessories" },
  { name: "Gymnastic Rings", category: "Accessories" },
  { name: "Parallettes", category: "Accessories" },
  { name: "Grip Strengthener", category: "Accessories" },
  { name: "Massage Gun Station", category: "Accessories" },
  { name: "Stretching Cage", category: "Accessories" },
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: equipment = [], isLoading } = useQuery<EquipmentItem[]>({
    queryKey: ["/api/owner/gym-equipment"],
  });

  const filteredSuggestions = newName.trim().length > 0
    ? EQUIPMENT_DATABASE.filter(e =>
        e.name.toLowerCase().includes(newName.toLowerCase()) &&
        !equipment.some(existing => existing.name.toLowerCase() === e.name.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                <Input
                  ref={inputRef}
                  placeholder="Search or type equipment name..."
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-8 text-sm"
                  data-testid="input-equipment-name"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[240px] overflow-y-auto"
                    data-testid="equipment-suggestions"
                  >
                    {filteredSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between gap-2 transition-colors"
                        onClick={() => {
                          setNewName(item.name);
                          setNewCategory(item.category);
                          setShowSuggestions(false);
                        }}
                        data-testid={`suggestion-${idx}`}
                      >
                        <span className="truncate font-medium">{item.name}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{item.category}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
            <p className="text-[10px] text-muted-foreground/60 px-1">
              Pick from {EQUIPMENT_DATABASE.length}+ built-in equipment or type your own custom name
            </p>
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