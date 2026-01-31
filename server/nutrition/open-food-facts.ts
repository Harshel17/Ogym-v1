interface NutrientData {
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

export interface FoodProduct {
  barcode: string;
  name: string;
  brandName: string | null;
  servingSize: string | null;
  nutrients: NutrientData;
  imageUrl: string | null;
}

export interface FoodSearchResult {
  products: FoodProduct[];
  count: number;
}

const BASE_URL = 'https://world.openfoodfacts.org';

export async function searchFoodByName(query: string, page: number = 1): Promise<FoodSearchResult> {
  try {
    const url = `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=20`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OGym/1.0 (https://app.ogym.fitness)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Open Food Facts API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    const products: FoodProduct[] = (data.products || []).map((p: any) => ({
      barcode: p.code || '',
      name: p.product_name || p.product_name_en || 'Unknown Product',
      brandName: p.brands || null,
      servingSize: p.serving_size || '100g',
      nutrients: {
        calories: Math.round(p.nutriments?.['energy-kcal_100g'] || p.nutriments?.['energy-kcal'] || 0),
        protein: p.nutriments?.proteins_100g ? Math.round(p.nutriments.proteins_100g) : null,
        carbs: p.nutriments?.carbohydrates_100g ? Math.round(p.nutriments.carbohydrates_100g) : null,
        fat: p.nutriments?.fat_100g ? Math.round(p.nutriments.fat_100g) : null,
        fiber: p.nutriments?.fiber_100g ? Math.round(p.nutriments.fiber_100g) : null,
      },
      imageUrl: p.image_front_small_url || p.image_url || null,
    })).filter((p: FoodProduct) => p.name && p.name !== 'Unknown Product' && p.nutrients.calories > 0);
    
    return {
      products,
      count: data.count || 0,
    };
  } catch (error) {
    console.error('Food search error:', error);
    return { products: [], count: 0 };
  }
}

export async function lookupByBarcode(barcode: string): Promise<FoodProduct | null> {
  try {
    const url = `${BASE_URL}/api/v0/product/${barcode}.json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OGym/1.0 (https://app.ogym.fitness)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Open Food Facts API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 1 || !data.product) {
      return null;
    }
    
    const p = data.product;
    
    return {
      barcode: p.code || barcode,
      name: p.product_name || p.product_name_en || 'Unknown Product',
      brandName: p.brands || null,
      servingSize: p.serving_size || '100g',
      nutrients: {
        calories: Math.round(p.nutriments?.['energy-kcal_100g'] || p.nutriments?.['energy-kcal'] || 0),
        protein: p.nutriments?.proteins_100g ? Math.round(p.nutriments.proteins_100g) : null,
        carbs: p.nutriments?.carbohydrates_100g ? Math.round(p.nutriments.carbohydrates_100g) : null,
        fat: p.nutriments?.fat_100g ? Math.round(p.nutriments.fat_100g) : null,
        fiber: p.nutriments?.fiber_100g ? Math.round(p.nutriments.fiber_100g) : null,
      },
      imageUrl: p.image_front_small_url || p.image_url || null,
    };
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return null;
  }
}

export function calculateDailyCalorieTarget(
  weight: number, // in kg
  height: number, // in cm
  age: number,
  gender: 'male' | 'female',
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
  goal: 'lose' | 'maintain' | 'gain'
): { calories: number; protein: number; carbs: number; fat: number } {
  let bmr: number;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };

  let tdee = bmr * activityMultipliers[activityLevel];

  if (goal === 'lose') {
    tdee -= 500;
  } else if (goal === 'gain') {
    tdee += 300;
  }

  const calories = Math.round(tdee);
  const protein = Math.round(weight * 1.8);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs, fat };
}
