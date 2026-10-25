export interface User {
  id: number;
  shop_name: string;
  full_name: string;
  email: string;
  phone: string;
}

export interface Customer {
  id: string;
  name: string;
  contact: string;
  date: string;
  charge: number;
  unit: 'in' | 'cm';
  m: Record<string, string>;
  material: string;
  notes: string;
}

export interface Design {
  id: number;
  title: string;
  category: string;
  description: string;
  price_estimate: number | null;
  image_url: string;
  created_at: string;
}

// In production, /api.php is on the same domain (adepam.codecasticgh.com/api.php)
// In local development, if on localhost, it can target the remote server or local
const API_BASE = window.location.hostname === 'localhost' 
  ? 'https://adepam.codecasticgh.com/api.php' 
  : './api.php';

const TOKEN_KEY = 'adepam_token';
const USER_KEY = 'adepam_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): User | null {
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

export function setStoredUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(action: string, options: RequestInit = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Network request failed');
  }
  return data;
}

export const api = {
  async signup(data: { shop_name: string; full_name: string; email: string; phone: string; password: string }) {
    const res = await request('signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async login(data: { email: string; password: string }) {
    const res = await request('login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async getMe() {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await request('me');
      if (res.user) {
        setStoredUser(res.user);
        return res.user;
      }
    } catch {
      clearAuth();
    }
    return null;
  },

  logout() {
    clearAuth();
  },

  async updateProfile(data: { shop_name: string; full_name: string; phone: string }) {
    const res = await request('update_profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.user) setStoredUser(res.user);
    return res.user;
  },

  async updatePassword(password: string) {
    return await request('update_password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  async getCustomers(): Promise<Customer[]> {
    const res = await request('customers');
    return res.customers || [];
  },

  async saveCustomer(customer: Customer) {
    return await request('save_customer', {
      method: 'POST',
      body: JSON.stringify({ customer }),
    });
  },

  async deleteCustomer(id: string) {
    return await request('delete_customer', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  async getDesigns(): Promise<Design[]> {
    const res = await request('designs');
    return res.designs || [];
  },

  async saveDesign(formData: FormData) {
    return await request('save_design', {
      method: 'POST',
      body: formData,
    });
  },

  async deleteDesign(id: number) {
    return await request('delete_design', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },
};
