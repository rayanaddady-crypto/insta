import { useEffect, useRef } from "react";
import { useAuth } from "../components/AuthContext";

export const useEmergencyDisconnect = () => {
  const { triggerEmergencyPanic } = useAuth();
  
  // Keep track of stealth clicks for double-tap gestures
  const lastTapRef = useRef<number>(0);
  
  // Keep track of VolumeUp key presses
  const lastVolumePressRef = useRef<number>(0);

  // Stealth tap/double-click handler for icons/logo
  const handleStealthTap = () => {
    const now = Date.now();
    const delay = 800; // time window in ms
    if (now - lastTapRef.current < delay) {
      console.log("[Stealth Trigger] Double stealth click registered.");
      triggerEmergencyPanic();
    }
    lastTapRef.current = now;
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Capturing "VolumeUp" key triggers. In standard browsers, they can be mapped to custom trigger actions or specific developer shortcuts like F10 or double volume keys
      if (event.key === "VolumeUp" || event.key === "F10") {
        const now = Date.now();
        const delay = 800;
        
        if (now - lastVolumePressRef.current < delay) {
          event.preventDefault();
          console.warn("[Stealth Trigger] Double Key Pattern registered.");
          triggerEmergencyPanic();
        }
        
        lastVolumePressRef.current = now;
      }
    };

    // Add keydown listener to document
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [triggerEmergencyPanic]);

  return {
    handleStealthTap
  };
};
