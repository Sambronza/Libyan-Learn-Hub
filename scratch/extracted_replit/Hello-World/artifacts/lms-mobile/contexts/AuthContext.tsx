import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "https://api.eduonline.net.ly/api";

export interface User {
  id: number;
  email: string;
  fullName: string;
  fullNameAr?: string;
  role: "student" | "teacher" | "admin";
  avatarUrl?: string | null;
  bio?: string | null;
  tier?: string | null;
  proExpiry?: string | null;
  language: "ar" | "en";
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiBase: string;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  fullNameAr?: string;
  role: "student" | "teacher";
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      const storedUser = await AsyncStorage.getItem("auth_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {}
    setIsLoading(false);
  }

  async function login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    await AsyncStorage.setItem("auth_token", data.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(data.user));
  }

  async function register(regData: RegisterData) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...regData, language: "ar" }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
    const data = await res.json();
    setUser(data.user);
    setToken(data.token);
    await AsyncStorage.setItem("auth_token", data.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(data.user));
  }

  async function logout() {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
  }

  async function refreshUser() {
    if (!token) return;
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      await AsyncStorage.setItem("auth_user", JSON.stringify(data.user));
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser, apiBase: API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
