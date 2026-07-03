import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { getDeviceInfo } from "@/utils/deviceFingerprint";

/** Thrown when login is interrupted by device security (new device / re-verify / blocked). */
export class DeviceSecurityError extends Error {
  code: "NEW_DEVICE" | "REVERIFY_REQUIRED" | "ACCOUNT_BLOCKED" | "FACE_MISMATCH";
  messageAr: string;
  constructor(code: DeviceSecurityError["code"], message: string, messageAr: string) {
    super(message);
    this.code = code;
    this.messageAr = messageAr;
  }
}

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
  login: (email: string, password: string) => Promise<{ faceEnrollmentRequired?: boolean }>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Face-verified device switch after a NEW_DEVICE login rejection. */
  deviceSwitchVerify: (email: string, password: string, faceImageBase64: string) => Promise<void>;
  /** Periodic face re-verification during the post-switch window. */
  reverifyFace: (email: string, password: string, faceImageBase64: string) => Promise<void>;
  /** Enroll the student's 5-pose face profile (signup / grandfathered users). */
  enrollFace: (faceImages: Record<string, string>, facePhotoUrl?: string) => Promise<void>;
  apiBase: string;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  fullNameAr?: string;
  role: "student" | "teacher";
  referralCode?: string;
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

  async function storeSession(data: any) {
    setUser(data.user);
    setToken(data.token);
    await AsyncStorage.setItem("auth_token", data.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(data.user));
  }

  async function login(email: string, password: string) {
    const deviceInfo = await getDeviceInfo();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, ...deviceInfo }),
    });
    if (!res.ok) {
      const err = await res.json();
      // Device security flows carry a code + bilingual messages
      if (err.code === "NEW_DEVICE" || err.code === "REVERIFY_REQUIRED" || err.code === "ACCOUNT_BLOCKED") {
        throw new DeviceSecurityError(err.code, err.message || err.error, err.messageAr || "");
      }
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    await storeSession(data);
    return { faceEnrollmentRequired: data.faceEnrollmentRequired === true };
  }

  async function register(regData: RegisterData) {
    const deviceInfo = await getDeviceInfo();
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...regData, language: "ar", ...deviceInfo }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Registration failed");
    }
    const data = await res.json();
    await storeSession(data);
  }

  async function deviceSwitchVerify(email: string, password: string, faceImageBase64: string) {
    const deviceInfo = await getDeviceInfo();
    const res = await fetch(`${API_BASE}/auth/device-switch/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...deviceInfo,
        faceImage: faceImageBase64,
        snapshot: faceImageBase64,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code) throw new DeviceSecurityError(data.code, data.message || data.error, data.messageAr || "");
      throw new Error(data.error || "Verification failed");
    }
    setToken(data.token);
    await AsyncStorage.setItem("auth_token", data.token);
    await refreshUserWithToken(data.token);
  }

  async function reverifyFace(email: string, password: string, faceImageBase64: string) {
    const deviceInfo = await getDeviceInfo();
    const res = await fetch(`${API_BASE}/auth/reverify-face`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        faceImage: faceImageBase64,
        snapshot: faceImageBase64,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code) throw new DeviceSecurityError(data.code, data.message || data.error, data.messageAr || "");
      throw new Error(data.error || "Verification failed");
    }
    setToken(data.token);
    await AsyncStorage.setItem("auth_token", data.token);
    await refreshUserWithToken(data.token);
  }

  async function enrollFace(faceImages: Record<string, string>, facePhotoUrl?: string) {
    const currentToken = token || (await AsyncStorage.getItem("auth_token"));
    const res = await fetch(`${API_BASE}/auth/enroll-face`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
      body: JSON.stringify({ faceImages, facePhotoUrl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Face enrollment failed");
    }
  }

  async function refreshUserWithToken(tk: string) {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${tk}` } });
    if (res.ok) {
      const data = await res.json();
      const u = data.user ?? data;
      setUser(u);
      await AsyncStorage.setItem("auth_user", JSON.stringify(u));
    }
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
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser, deviceSwitchVerify, reverifyFace, enrollFace, apiBase: API_BASE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
