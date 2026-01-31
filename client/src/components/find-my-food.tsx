import { useState, useCallback } from "react";
import { MapPin, Utensils, Navigation, ChevronRight, Check, X, Loader2, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RestaurantResult {
  name: string;
  distance: number;
  distanceText: string;
  suggestion: {
    item: string;
    reason: string;
    approxCalories: string;
    dikaMessage: string;
  } | null;
  category: string;
  lat: number;
  lon: number;
}

interface FindMyFoodProps {
  remainingCalories: number;
  goalType: 'lose' | 'maintain' | 'gain';
  onLogFood?: (foodName: string, calories: number) => void;
}

const FEATURE_FLAG_ENABLED = true;

export function FindMyFood({ remainingCalories, goalType, onLogFood }: FindMyFoodProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'radius' | 'loading' | 'results' | 'log_prompt'>('radius');
  const [selectedRadius, setSelectedRadius] = useState<string>("3");
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantResult | null>(null);
  const [restaurants, setRestaurants] = useState<RestaurantResult[]>([]);
  const [dikaGeneralMessage, setDikaGeneralMessage] = useState<string>("");
  const [locationError, setLocationError] = useState<string | null>(null);

  if (!FEATURE_FLAG_ENABLED) return null;

  const trackEvent = (eventName: string, data?: Record<string, unknown>) => {
    console.log(`[FindMyFood] ${eventName}`, data);
  };

  const requestLocation = useCallback(() => {
    return new Promise<{ lat: number; lon: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error("Location permission denied. Please enable location access in your browser settings."));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error("Location information is unavailable."));
              break;
            case error.TIMEOUT:
              reject(new Error("Location request timed out."));
              break;
            default:
              reject(new Error("An unknown error occurred."));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const fetchNearbyRestaurants = useMutation({
    mutationFn: async ({ lat, lon, radiusMiles }: { lat: number; lon: number; radiusMiles: number }) => {
      const res = await apiRequest("POST", "/api/nutrition/find-nearby-restaurants", {
        lat,
        lon,
        radiusMiles,
        goalType,
        remainingCalories
      });
      return res.json();
    },
    onSuccess: (data) => {
      setRestaurants(data.restaurants || []);
      setDikaGeneralMessage(data.dikaMessage || "");
      setStep('results');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch nearby restaurants",
        variant: "destructive"
      });
      setStep('radius');
    }
  });

  const handleOpen = () => {
    trackEvent('find_my_food_opened');
    setIsOpen(true);
    setStep('radius');
    setLocationError(null);
    setSelectedRestaurant(null);
  };

  const handleSearch = async () => {
    trackEvent('find_my_food_radius_selected', { radius: selectedRadius });
    setStep('loading');
    setLocationError(null);

    try {
      const coords = await requestLocation();
      setLocation(coords);
      
      fetchNearbyRestaurants.mutate({
        lat: coords.lat,
        lon: coords.lon,
        radiusMiles: parseFloat(selectedRadius)
      });
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : "Failed to get location");
      setStep('radius');
    }
  };

  const handleRestaurantClick = (restaurant: RestaurantResult) => {
    trackEvent('find_my_food_restaurant_clicked', { restaurant: restaurant.name });
    setSelectedRestaurant(restaurant);
    setStep('log_prompt');
  };

  const handleLogFood = () => {
    if (selectedRestaurant?.suggestion) {
      trackEvent('find_my_food_log_initiated', { 
        restaurant: selectedRestaurant.name,
        item: selectedRestaurant.suggestion.item 
      });
      
      const calories = parseInt(selectedRestaurant.suggestion.approxCalories.replace(/[^0-9]/g, '')) || 0;
      
      if (onLogFood) {
        onLogFood(selectedRestaurant.suggestion.item, calories);
      }
      
      setIsOpen(false);
      toast({
        title: "Ready to log",
        description: `Add "${selectedRestaurant.suggestion.item}" to your food log`
      });
    }
  };

  const handleNotNow = () => {
    setSelectedRestaurant(null);
    setStep('results');
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fast_food': return '🍔';
      case 'pizza': return '🍕';
      case 'mexican': return '🌮';
      case 'asian': return '🍜';
      case 'indian': return '🍛';
      case 'coffee': return '☕';
      case 'healthy': return '🥗';
      case 'casual': return '🍽️';
      default: return '🍴';
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full mt-4 gap-2"
        onClick={handleOpen}
        data-testid="button-find-my-food"
      >
        <MapPin className="w-4 h-4" />
        <span>Find My Food Nearby</span>
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-1">
        Based on your calories & workout goals
      </p>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {step === 'radius' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  Find Food Near You
                </DialogTitle>
                <DialogDescription>
                  We'll find restaurants nearby and suggest the best options based on your {goalType === 'lose' ? 'cutting' : goalType === 'maintain' ? 'maintenance' : 'bulking'} goals.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="bg-muted/50 p-3 rounded-lg flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    We'll ask for your location to find nearby restaurants. Your location is only used for this search.
                  </p>
                </div>

                {locationError && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
                    {locationError}
                  </div>
                )}

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Search Radius</Label>
                  <RadioGroup 
                    value={selectedRadius} 
                    onValueChange={setSelectedRadius}
                    className="flex gap-3"
                  >
                    {[
                      { value: "1", label: "1 mile" },
                      { value: "3", label: "3 miles" },
                      { value: "5", label: "5 miles" }
                    ].map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`radius-${option.value}`} />
                        <Label htmlFor={`radius-${option.value}`} className="cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleSearch}
                  data-testid="button-show-food-options"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Show Food Options
                </Button>
              </div>
            </>
          )}

          {step === 'loading' && (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Finding restaurants near you...</p>
            </div>
          )}

          {step === 'results' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-primary" />
                  Food Options Near You
                </DialogTitle>
              </DialogHeader>

              {dikaGeneralMessage && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Dika says...</p>
                      <p className="text-sm mt-0.5">{dikaGeneralMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 mt-4 max-h-[50vh] overflow-y-auto">
                {restaurants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Utensils className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No restaurants found with suggestions in this area.</p>
                    <p className="text-sm mt-1">Try increasing the search radius.</p>
                  </div>
                ) : (
                  restaurants.map((restaurant, index) => (
                    <Card 
                      key={index} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => handleRestaurantClick(restaurant)}
                      data-testid={`card-restaurant-${index}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getCategoryIcon(restaurant.category)}</span>
                              <h4 className="font-medium truncate">{restaurant.name}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {restaurant.distanceText}
                            </p>
                            {restaurant.suggestion && (
                              <div className="mt-2 space-y-1">
                                <Badge variant="secondary" className="text-xs">
                                  Safest: {restaurant.suggestion.item}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {restaurant.suggestion.approxCalories} • {restaurant.suggestion.reason}
                                </p>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => setStep('radius')}
              >
                Search Again
              </Button>
            </>
          )}

          {step === 'log_prompt' && selectedRestaurant && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRestaurant.name}</DialogTitle>
                <DialogDescription>
                  {selectedRestaurant.distanceText}
                </DialogDescription>
              </DialogHeader>

              {selectedRestaurant.suggestion && (
                <div className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Safest Option for Your Goals
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="font-medium">{selectedRestaurant.suggestion.item}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRestaurant.suggestion.approxCalories}
                      </p>
                      <p className="text-sm">{selectedRestaurant.suggestion.reason}</p>
                    </CardContent>
                  </Card>

                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Did you eat something from here?</p>
                    <p className="text-xs text-muted-foreground">
                      Log it to track your calories
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1" 
                      onClick={handleLogFood}
                      data-testid="button-log-food-yes"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Yes, log food
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleNotNow}
                      data-testid="button-log-food-not-now"
                    >
                      Not now
                    </Button>
                  </div>
                </div>
              )}

              {!selectedRestaurant.suggestion && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No specific suggestions available for this restaurant.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={handleNotNow}
                  >
                    Go Back
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
