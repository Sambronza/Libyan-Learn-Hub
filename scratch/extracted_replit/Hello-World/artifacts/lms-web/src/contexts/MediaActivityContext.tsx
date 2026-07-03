import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface MediaActivityContextType {
  isMediaActive: boolean;
  setMediaActive: (active: boolean) => void;
  /** Call this periodically (e.g. on every video progress tick) to signal ongoing activity */
  pingMediaActivity: () => void;
}

const MediaActivityContext = createContext<MediaActivityContextType | undefined>(undefined);

export function MediaActivityProvider({ children }: { children: React.ReactNode }) {
  const [isMediaActive, setIsMediaActive] = useState(false);
  const pingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMediaActive = useCallback((active: boolean) => {
    setIsMediaActive(active);
    if (!active && pingTimerRef.current) {
      clearTimeout(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  /**
   * Called on each video progress tick or similar.
   * Marks media as active and auto-clears after 5 seconds of silence
   * (so if the video pauses, activity naturally expires).
   */
  const pingMediaActivity = useCallback(() => {
    setIsMediaActive(true);
    if (pingTimerRef.current) clearTimeout(pingTimerRef.current);
    pingTimerRef.current = setTimeout(() => {
      setIsMediaActive(false);
    }, 5000);
  }, []);

  return (
    <MediaActivityContext.Provider value={{ isMediaActive, setMediaActive, pingMediaActivity }}>
      {children}
    </MediaActivityContext.Provider>
  );
}

export function useMediaActivity() {
  const ctx = useContext(MediaActivityContext);
  if (!ctx) throw new Error('useMediaActivity must be used within MediaActivityProvider');
  return ctx;
}
