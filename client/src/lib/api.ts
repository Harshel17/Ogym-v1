const API_BASE = "";

interface ApiOptions {
  method?: string;
  body?: any;
  token?: string | null;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || error.message || "Request failed");
  }
  
  if (res.status === 204) {
    return {} as T;
  }
  
  return res.json();
}

export const authApi = {
  registerOwner: (data: { username: string; password: string; gym_name: string }) =>
    api<{ access_token: string; user: any }>("/api/auth/register-owner", { method: "POST", body: data }),
  
  registerJoin: (data: { username: string; password: string; gym_code: string; role: string }) =>
    api<{ access_token: string; user: any }>("/api/auth/register-join", { method: "POST", body: data }),
  
  login: (data: { username: string; password: string }) =>
    api<{ access_token: string; user: any }>("/api/auth/login", { method: "POST", body: data }),
  
  me: (token: string) =>
    api<any>("/api/auth/me", { token }),
};

export const ownerApi = {
  getMembers: (token: string) => api<any[]>("/api/owner/members", { token }),
  getTrainers: (token: string) => api<any[]>("/api/owner/trainers", { token }),
  getAssignments: (token: string) => api<any[]>("/api/owner/assignments", { token }),
  assignTrainer: (token: string, data: { trainer_id: number; member_id: number }) =>
    api<any>("/api/owner/assign-trainer", { method: "POST", body: data, token }),
  getQrData: (token: string) => api<{ type: string; gym_code: string }>("/api/owner/qr-data", { token }),
};

export const attendanceApi = {
  checkin: (token: string, data: { gym_code: string }) =>
    api<any>("/api/attendance/checkin", { method: "POST", body: data, token }),
  getMy: (token: string) => api<any[]>("/api/attendance/my", { token }),
  getGym: (token: string) => api<any[]>("/api/attendance/gym", { token }),
};

export const paymentsApi = {
  getMy: (token: string) => api<any[]>("/api/payments/my", { token }),
  getGym: (token: string) => api<any[]>("/api/payments/gym", { token }),
  mark: (token: string, data: any) =>
    api<any>("/api/payments/mark", { method: "POST", body: data, token }),
};

export const trainerApi = {
  getMembers: (token: string) => api<any[]>("/api/trainer/members", { token }),
  getCycles: (token: string) => api<any[]>("/api/trainer/cycles", { token }),
  createCycle: (token: string, data: any) =>
    api<any>("/api/trainer/cycles", { method: "POST", body: data, token }),
  addItem: (token: string, cycleId: number, data: any) =>
    api<any>(`/api/trainer/cycles/${cycleId}/items`, { method: "POST", body: data, token }),
  getActivity: (token: string) => api<any[]>("/api/trainer/activity", { token }),
};

export const workoutsApi = {
  getMyCycle: (token: string) => api<any>("/api/workouts/cycles/my", { token }),
  getToday: (token: string) => api<any>("/api/workouts/today", { token }),
  complete: (token: string, data: { workout_item_id: number }) =>
    api<any>("/api/workouts/complete", { method: "POST", body: data, token }),
  getHistory: (token: string) => api<any[]>("/api/workouts/history/my", { token }),
  getStats: (token: string) => api<any>("/api/workouts/stats/my", { token }),
};
