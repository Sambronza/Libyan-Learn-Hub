import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useGetCurrentUser, type User } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  login: (token: string, userData?: User) => void;
  logout: (redirectUrl?: string) => void;
  refetchUser: () => void;
  isAuthenticated: boolean;
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCK_STATE_KEY = 'lms_is_locked';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  // Check if token is passed via URL (e.g. from mobile WebView)
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  
  const [token, setToken] = useState<string | null>(() => {
    if (urlToken) {
      localStorage.setItem('lms_token', urlToken);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return urlToken;
    }
    return localStorage.getItem('lms_token');
  });
  
  // Session is unlocked by default, unless previously locked in this session
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return sessionStorage.getItem(LOCK_STATE_KEY) === 'true';
  });

  // We removed the fetch monkey-patch because it causes a race condition on mobile where React Query 
  // executes before the patch applies. The token is now automatically injected directly inside custom-fetch.ts.

  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      queryKey: ['/api/auth/me'],
      enabled: !!token,
      retry: false,
    }
  });

  const isAuthenticated = !!user;

  // Clear token if me endpoint explicitly rejects it (invalid token)
  // We check for 401/403 to prevent wiping the token during transient network drops (like switching apps on mobile)
  useEffect(() => {
    if (error && token) {
      const status = (error as any)?.status;
      if (status === 401 || status === 403) {
        logout();
      }
    }
  }, [error]);



  const login = (newToken: string, userData?: User) => {
    localStorage.setItem('lms_token', newToken);
    setToken(newToken);
    // If we already have the user data (from login response), pre-seed the cache
    // to avoid a redundant /auth/me round-trip
    if (userData) {
      queryClient.setQueryData(['/api/auth/me'], userData);
    } else {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    }
    // Clear lock state on fresh login
    sessionStorage.removeItem(LOCK_STATE_KEY);
    setIsLocked(false);
  };

  const logout = useCallback((redirectUrl?: string | unknown) => {
    const finalUrl = typeof redirectUrl === 'string' ? redirectUrl : '/';
    localStorage.removeItem('lms_token');
    sessionStorage.removeItem(LOCK_STATE_KEY);
    setToken(null);
    setIsLocked(false);
    queryClient.setQueryData(['/api/auth/me'], null);
    queryClient.clear();
    // Force a hard reload to the home page or specified url.
    // This solves the issue of white screens from stale lazy-loaded chunks (Vercel chunk loading errors)
    window.location.href = finalUrl;
  }, [queryClient]);

  const checkTokenExpiry = useCallback(() => {
    if (!token) return;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      const exp = payload.exp * 1000;
      const timeRemaining = exp - Date.now();
      
      // If token is already expired, logout immediately
      if (timeRemaining <= 0) {
        logout('/login?reason=expired');
      } 
      // If nearing timeout (less than 2 hours left) and user has a passkey
      else if (timeRemaining < 2 * 60 * 60 * 1000) {
        const hasPasskey = !!(user as any)?.hasPasskey;
        if (hasPasskey && !isLocked && !sessionStorage.getItem(LOCK_STATE_KEY)) {
          sessionStorage.setItem(LOCK_STATE_KEY, 'true');
          setIsLocked(true);
        }
      }
    } catch (e) {
      console.error('Failed to parse token expiry', e);
    }
  }, [token, logout, isLocked, user]);

  useEffect(() => {
    if (!isAuthenticated) return;
    checkTokenExpiry();
    const interval = setInterval(checkTokenExpiry, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, [isAuthenticated, checkTokenExpiry]);

  // Sleep detection: forcefully logout if the device goes to sleep
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let lastTime = Date.now();
    const sleepInterval = setInterval(() => {
      const now = Date.now();
      // If interval delta > 3 minutes (180,000 ms), the device was suspended (went to sleep)
      if (now - lastTime > 180000) {
        logout('/login?reason=session_expired');
      }
      lastTime = now;
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(sleepInterval);
  }, [isAuthenticated, logout]);

  const lock = useCallback(() => {
    sessionStorage.setItem(LOCK_STATE_KEY, 'true');
    setIsLocked(true);
  }, []);

  const unlock = useCallback(() => {
    sessionStorage.removeItem(LOCK_STATE_KEY);
    setIsLocked(false);
  }, []);

  const refetchUser = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading: isLoading && !!token,
      login,
      logout,
      refetchUser,
      isAuthenticated,
      isLocked,
      lock,
      unlock,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
