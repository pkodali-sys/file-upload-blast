// Session timer hook for auto-logout functionality
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseSessionTimerProps {
  expiresAt: number | undefined;
  onSessionExpired: () => void;
  isLoggedIn: boolean;
}

interface SessionTimerState {
  remainingMs: number;
  remainingText: string;
  isExpired: boolean;
}

export function useSessionTimer({ expiresAt, onSessionExpired, isLoggedIn }: UseSessionTimerProps): SessionTimerState {
  const [remainingMs, setRemainingMs] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const { toast } = useToast();
  
  // Track warnings to avoid duplicate notifications
  const warningsShown = useRef({
    fiveMinutes: false,
    oneMinute: false,
    expired: false
  });

  // Reset warnings when user logs in or expiresAt changes
  useEffect(() => {
    warningsShown.current = {
      fiveMinutes: false,
      oneMinute: false,
      expired: false
    };
    setIsExpired(false);
  }, [expiresAt, isLoggedIn]);

  useEffect(() => {
    if (!expiresAt || !isLoggedIn) {
      setRemainingMs(0);
      setIsExpired(false);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, expiresAt - now);
      setRemainingMs(remaining);

      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        if (!warningsShown.current.expired) {
          warningsShown.current.expired = true;
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
          onSessionExpired();
        }
        return;
      }

      // Show warning at 5 minutes (300,000ms)
      if (remaining <= 300000 && remaining > 295000 && !warningsShown.current.fiveMinutes) {
        warningsShown.current.fiveMinutes = true;
        toast({
          title: "Session Warning",
          description: "Your session will expire in 5 minutes. Please save your work.",
          variant: "default",
        });
      }

      // Show warning at 1 minute (60,000ms)
      if (remaining <= 60000 && remaining > 55000 && !warningsShown.current.oneMinute) {
        warningsShown.current.oneMinute = true;
        toast({
          title: "Session Expiring Soon",
          description: "Your session will expire in 1 minute. Please save your work.",
          variant: "destructive",
        });
      }
    };

    // Update immediately
    updateTimer();

    // Set up interval to update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isLoggedIn, isExpired, onSessionExpired, toast]);

  // Format remaining time as MM:SS
  const formatTime = (ms: number): string => {
    if (ms <= 0) return "00:00";
    
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const remainingText = formatTime(remainingMs);

  return {
    remainingMs,
    remainingText,
    isExpired,
  };
}