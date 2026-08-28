import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { Heart, Bell, X, UserCheck, UserX, MessageSquare, Flame } from "lucide-react";

interface Notification {
  id: number;
  type: "follow_request" | "like" | "comment";
  sender_id: number;
  receiver_id: number;
  sender_username: string;
  sender_avatar: string;
  post_id?: number;
  text?: string;
  created_at: string;
  status?: "pending" | "accepted" | "declined";
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { fetchWithAuth, socket, triggerToast, requestNotificationPermission } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load historical notifications
  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth("/api/notifications");
      if (res && res.notifications) {
        setNotifications(res.notifications);
      }
    } catch (err: any) {
      if (err.message === "Session expired. Please log in again.") {
        console.warn("Session expired. Redirecting to login.");
      } else {
        console.error("Failed to load notifications:", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  // Handle Real-time notifications via WebSockets
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev]);
      
      // Play subtle social notification chime (Web Audio API synth)
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
          osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08); // G5
          osc.frequency.setValueAtTime(987.77, ctx.currentTime + 0.16); // B5
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (err) {}

      const messageText = notif.type === "follow_request" 
        ? `New follow request from @${notif.sender_username}!`
        : notif.type === "like"
        ? `@${notif.sender_username} liked your post!`
        : `@${notif.sender_username} commented: "${notif.text}"`;
      triggerToast(messageText, "info");
    };

    socket.on("new_notification", handleNewNotification);

    return () => {
      socket.off("new_notification", handleNewNotification);
    };
  }, [socket]);

  // Accept Follow Request Action
  const handleAccept = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/notifications/${id}/accept`, {
        method: "POST"
      });
      if (res && res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: "accepted" as const } : n))
        );
        triggerToast("Follow request accepted!", "success");
        // Notify other parts of the app to reload profile/followers list
        window.dispatchEvent(new CustomEvent("refresh-data"));
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to accept follow request", "error");
    }
  };

  // Decline Follow Request Action
  const handleDecline = async (id: number) => {
    try {
      const res = await fetchWithAuth(`/api/notifications/${id}/decline`, {
        method: "POST"
      });
      if (res && res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: "declined" as const } : n))
        );
        triggerToast("Follow request declined", "info");
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to decline follow request", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transform transition-all duration-300 animate-slide-in text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-[#FF7A00] fill-[#FF7A00]" />
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">Notifications</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={requestNotificationPermission}
            title="Enable Push Notifications"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/30 text-[10px] font-extrabold uppercase transition-all cursor-pointer"
          >
            <Bell className="h-3 w-3" />
            <span>Enable Push</span>
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#FF7A00] border-t-transparent" />
            <span className="text-xs">Loading updates...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400 px-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300">No Notifications Yet</p>
            <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">Activity on your posts and follow requests will show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
              >
                {/* Avatar */}
                <img
                  src={notif.sender_avatar}
                  alt={notif.sender_username}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-100 dark:border-slate-800"
                />

                {/* Content block */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 dark:text-slate-200 leading-normal">
                    {notif.type === "like" || notif.type === "comment" ? (
                      <>
                        <span className="font-bold text-slate-950 dark:text-white mr-1">@{notif.sender_username}</span>
                        {notif.type === "like" && "liked your post"}
                        {notif.type === "comment" && (
                          <span>
                            commented: <span className="text-slate-600 dark:text-slate-400 italic">"{notif.text}"</span>
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-800 dark:text-slate-200">
                        {notif.text || `@{notif.sender_username} sent you a follow request`}
                      </span>
                    )}
                  </div>
                  
                  {/* Date */}
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>

                  {/* Actions for Follow Request */}
                  {notif.type === "follow_request" && (
                    <div className="mt-3 flex items-center gap-2">
                      {notif.status === "pending" ? (
                        <>
                          <button
                            onClick={() => handleAccept(notif.id)}
                            className="bg-[#FF7A00] hover:bg-orange-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-all shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleDecline(notif.id)}
                            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-4 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Decline
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${
                          notif.status === "accepted" 
                            ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900" 
                            : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800"
                        }`}>
                          {notif.status === "accepted" ? "Accepted" : "Declined"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
