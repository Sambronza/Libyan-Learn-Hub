import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Keyframe positions are capped at left: 55% and top: 75% to prevent
// the whitespace-nowrap text from being clipped off-screen edges.
const WATERMARK_CSS = `
@keyframes watermark-bounce {
  0%   { top: 8%;  left: 8%;  }
  15%  { top: 70%; left: 40%; }
  30%  { top: 20%; left: 55%; }
  45%  { top: 75%; left: 12%; }
  60%  { top: 40%; left: 50%; }
  75%  { top: 10%; left: 35%; }
  90%  { top: 65%; left: 55%; }
  100% { top: 8%;  left: 8%;  }
}
.watermark-animate {
  animation: watermark-bounce 50s linear infinite;
  position: absolute;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  font-family: monospace;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.55);
  mix-blend-mode: overlay;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.95), -1px -1px 2px rgba(0,0,0,0.7);
  z-index: 110;
}
`;

export function WatermarkOverlay() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  // Inject the keyframe CSS once globally to avoid duplicate <style> blocks
  useEffect(() => {
    const STYLE_ID = 'watermark-keyframes';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = WATERMARK_CSS;
      document.head.appendChild(style);
    }
  }, []);

  // Self-defense mechanism: prevent hiding or deleting the watermark via DevTools
  useEffect(() => {
    if (!containerRef.current || !spanRef.current) return;

    let isUnmounting = false;

    const handleTampering = () => {
      if (isUnmounting) return;
      console.warn('Security tampering detected. Reloading session.');
      window.location.reload();
    };

    const observer = new MutationObserver((mutations) => {
      if (isUnmounting) return;
      
      for (const mutation of mutations) {
        // If the nodes were removed from the DOM
        if (mutation.type === 'childList') {
          const removedNodes = Array.from(mutation.removedNodes);
          if (
            removedNodes.includes(containerRef.current as Node) ||
            removedNodes.includes(spanRef.current as Node)
          ) {
            handleTampering();
          }
        }

        // If someone tries to hide it via CSS (display: none, opacity: 0, etc)
        if (mutation.type === 'attributes') {
          const target = mutation.target as HTMLElement;
          const style = window.getComputedStyle(target);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            Number(style.opacity) < 0.1
          ) {
            handleTampering();
          }
        }
      }
    });

    // Observe parent for deletion of container, and container for attributes/children
    if (containerRef.current.parentNode) {
      observer.observe(containerRef.current.parentNode, { childList: true });
    }
    observer.observe(containerRef.current, { childList: true, attributes: true, subtree: true });

    // Fallback interval check in case observer is somehow bypassed
    const interval = setInterval(() => {
      if (isUnmounting) return;
      if (
        !document.body.contains(containerRef.current) ||
        !document.body.contains(spanRef.current)
      ) {
        handleTampering();
      }
    }, 2000);

    return () => {
      isUnmounting = true;
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  if (!user) return null;

  const label = `${user.fullName}  ·  ${user.email}  ·  ID:${user.id}`;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 110 }}
    >
      <span ref={spanRef} className="watermark-animate">{label}</span>
    </div>
  );
}
