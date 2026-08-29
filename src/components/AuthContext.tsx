import React, { createContext, useContext, useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  socket: Socket | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<any>;
  triggerToast: (message: string, type?: "success" | "error" | "info") => void;
  toast: { message: string; type: "success" | "error" | "info" } | null;
  theme: "dark" | "light";
  toggleTheme: () => void;
  isDecoyActive: boolean;
  triggerEmergencyPanic: () => void;
  deactivateDecoy: () => void;
  requestNotificationPermission: () => Promise<void>;
}

const getApiBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const isCapacitor = (window as any).Capacitor || origin.startsWith("capacitor://") || (hostname === "localhost" && window.location.port !== "3000" && window.location.port !== "5173") || hostname === "10.0.2.2";
    if (isCapacitor) {
      return "https://ais-dev-r7zut5ciiaw5coduyhz472-92671597870.europe-west2.run.app";
    }
  }
  return "";
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("instaclone_theme") as "dark" | "light") || "light"
  );

  // Decoy state persistence
  const [isDecoyActive, setIsDecoyActive] = useState<boolean>(() => {
    return localStorage.getItem("raynista_decoy") === "true";
  });

  // Sync theme class to document root element on change and persist to database
  useEffect(() => {
    localStorage.setItem("instaclone_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    if (token && user) {
      const baseUrl = getApiBaseUrl();
      fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ theme })
      }).catch((err) => console.error("Theme sync error:", err));
    }
  }, [theme, token, user]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Load initial session on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("instaclone_token");
    const savedUser = localStorage.getItem("instaclone_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Request notification permissions
  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        triggerToast("Message notifications are active!", "success");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        triggerToast("Message notifications enabled successfully!", "success");
      } else {
        triggerToast("Notification permission denied by browser.", "info");
      }
    } else {
      triggerToast("Browser notifications not supported.", "info");
    }
  };

  // Establish and manage Socket.io connection based on user authentication status
  useEffect(() => {
    if (token && user) {
      // Connect socket to current origin
      const baseUrl = getApiBaseUrl();
      const newSocket = io(baseUrl || window.location.origin, {
        transports: ["websocket", "polling"]
      });

      newSocket.on("connect", () => {
        console.log("[Socket] Connected on client:", newSocket.id);
        // Join user's personal private message channel
        newSocket.emit("join", user.id);
      });

      newSocket.on("new_message_notification", (data: any) => {
        // Silently update any internal notification counters or state without disruptive popups or sound chimes
        console.log("💬 Message received silently in background:", data?.id);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
        console.log("[Socket] Disconnected client socket");
      };
    } else {
      setSocket(null);
    }
  }, [token, user]);

  const triggerToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("instaclone_token", newToken);
    localStorage.setItem("instaclone_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (newUser.theme === "dark" || newUser.theme === "light") {
      setTheme(newUser.theme);
    }
    triggerToast(`Welcome back, @${newUser.username}!`, "success");
  };

  const logout = () => {
    localStorage.removeItem("instaclone_token");
    localStorage.removeItem("instaclone_user");
    setToken(null);
    setUser(null);
    triggerToast("Logged out successfully.", "info");
  };

  const updateUser = (updatedUser: User) => {
    localStorage.setItem("instaclone_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  // Panic / Emergency Disconnect Action
  const triggerEmergencyPanic = () => {
    console.warn("🚨 EMERGENCY PANIC TRIGGERED! PURGING SESSIONS...");

    // Disconnect sockets immediately
    if (socket) {
      socket.disconnect();
    }

    // Clear session and auth tokens immediately
    localStorage.removeItem("instaclone_token");
    localStorage.removeItem("instaclone_user");
    sessionStorage.clear();

    // Flag decoy persistence
    localStorage.setItem("raynista_decoy", "true");

    // Purge local state
    setToken(null);
    setUser(null);
    setSocket(null);
    setIsDecoyActive(true);

    triggerToast("Decoy safety screen activated.", "error");
  };

  const deactivateDecoy = () => {
    localStorage.removeItem("raynista_decoy");
    setIsDecoyActive(false);
    triggerToast("System restored successfully.", "success");
  };

  // Safe wrapper for authorized API requests with auto-logout on unauthorized (401/403) and auto-retry for transient network hiccups
  const fetchWithAuth = async (url: string, options: RequestInit = {}, retries = 1): Promise<any> => {
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const mergedOptions: RequestInit = {
      ...options,
      headers
    };

    const baseUrl = getApiBaseUrl();
    const resolvedUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

    try {
      const response = await fetch(resolvedUrl, mergedOptions);
      
      const rawText = await response.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        // Raw text response
      }

      if (!response.ok) {
        if (response.status === 401) {
          logout();
          throw new Error("Session expired. Please log in again.");
        }
        const errorMsg = data?.error || (rawText && rawText.length < 150 ? rawText : `Server error (${response.status})`);
        throw new Error(errorMsg);
      }

      if (data === null) {
        throw new Error(`Unexpected server response (${response.status})`);
      }

      return data;
    } catch (err: any) {
      if (err.message === "Session expired. Please log in again.") {
        console.warn(`[API Session] Session expired during request to ${url}`);
        throw err;
      }

      // Retry once on transient network failure
      if (retries > 0 && (err.name === "TypeError" || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError"))) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return fetchWithAuth(url, options, retries - 1);
      }

      console.error(`[API Error] Fetching ${url}:`, err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        socket,
        login,
        logout,
        updateUser,
        fetchWithAuth,
        triggerToast,
        toast,
        theme,
        toggleTheme,
        isDecoyActive,
        triggerEmergencyPanic,
        deactivateDecoy,
        requestNotificationPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
