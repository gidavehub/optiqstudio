"use client";

import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, X } from "lucide-react";

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [hasConnectedOnce, setHasConnectedConnectedOnce] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial state setup
    const currentStatus = navigator.onLine;
    setIsOnline(currentStatus);
    
    // Only show toast initially if the user starts offline
    if (!currentStatus) {
      setShowToast(true);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setHasConnectedConnectedOnce(true);
      setShowToast(true);
      setIsTransitioning(true);

      // Auto-hide the "Back Online" toast after 3.5 seconds
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        // Delay final unmount to let slide-down animation complete
        setTimeout(() => setShowToast(false), 300);
      }, 3500);

      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowToast(true);
      setIsTransitioning(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showToast) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] max-w-sm w-full md:w-80 overflow-hidden rounded-lg border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-md transition-all duration-300 ease-in-out ${
        isTransitioning && isOnline
          ? "translate-y-0 opacity-100"
          : !isOnline
          ? "translate-y-0 opacity-100"
          : "translate-y-12 opacity-0"
      }`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Status Indicator Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/5 bg-white/5">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-white" aria-hidden="true" />
          ) : (
            <WifiOff className="h-5 w-5 text-white/60 animate-pulse" aria-hidden="true" />
          )}
        </div>

        {/* Status Content */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold tracking-wider text-white uppercase">
              {isOnline ? "System Online" : "Offline Mode"}
            </span>
            {/* Pulsing indicator dot */}
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isOnline ? "bg-white animate-ping" : "bg-white/40 animate-pulse"
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  isOnline ? "bg-white" : "bg-white/30"
                }`}
              />
            </span>
          </div>

          <p className="text-sm font-light text-white/70 leading-relaxed">
            {isOnline
              ? "Connection restored. Cloud synchronizations have resumed."
              : "Internet disconnected. Using local IndexedDB cache."}
          </p>
        </div>

        {/* Manual Dismiss Button for Offline state */}
        {!isOnline && (
          <button
            onClick={() => {
              setIsTransitioning(false);
              setTimeout(() => setShowToast(false), 300);
            }}
            className="rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
