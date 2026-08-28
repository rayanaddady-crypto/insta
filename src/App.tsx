import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./components/AuthContext";
import { Auth } from "./components/Auth";
import { Layout } from "./components/Layout";
import { Feed } from "./components/Feed";
import { Search } from "./components/Search";
import { Reels } from "./components/Reels";
import { Messages } from "./components/Messages";
import { Profile } from "./components/Profile";
import { ChatUser } from "./types";
import { Sparkles, MessageCircle, Heart, Bell, User, Edit3, Lock, Shield, Check, Globe } from "lucide-react";
import { DecoyCalculator } from "./components/DecoyCalculator";

const MainAppContent: React.FC = () => {
  const { user, token, toast, isDecoyActive, fetchWithAuth, updateUser, triggerToast } = useAuth();
  
  // Tab Routing State: Default to "feed"
  const [currentTab, setCurrentTab] = useState<string>("feed");
  
  // Custom Username to explore (null means current user profile)
  const [exploreProfileUsername, setExploreProfileUsername] = useState<string | null>(null);

  // Cross-component transition state: pre-select user chat thread on DM tab load
  const [activeChatPreset, setActiveChatPreset] = useState<ChatUser | null>(null);

  // Keep track of active chat conversation for Instagram mobile style full screen view
  const [isChatConversationActive, setIsChatConversationActive] = useState<boolean>(false);

  // Onboarding profile completion flow state
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (!user) return false;
    const alreadyOnboarded = localStorage.getItem(`onboarded_${user.id}`);
    return !user.bio && !alreadyOnboarded;
  });

  const [onboardName, setOnboardName] = useState("");
  const [onboardBio, setOnboardBio] = useState("");
  const [onboardAvatar, setOnboardAvatar] = useState("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80");
  const [onboardIsPrivate, setOnboardIsPrivate] = useState(false);
  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);

  const handleNavigateToProfile = (username: string) => {
    setExploreProfileUsername(username);
    setCurrentTab("profile");
  };

  const handleNavigateToMessage = (targetUser: { id: number; username: string; avatar_url: string; bio: string }) => {
    // Inject the target as an active direct chat preset
    const chatUserPreset: ChatUser = {
      id: targetUser.id,
      username: targetUser.username,
      avatar_url: targetUser.avatar_url,
      bio: targetUser.bio,
      last_message: null
    };

    // Store in global memory and switch tabs
    setActiveChatPreset(chatUserPreset);
    setCurrentTab("messages");
  };

  const handleClearExploreProfile = () => {
    setExploreProfileUsername(null);
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsOnboardingSaving(true);
    try {
      const response = await fetchWithAuth("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: onboardName || user.username,
          bio: onboardBio || "New Raynista explorer",
          avatar_url: onboardAvatar,
          is_private: onboardIsPrivate
        })
      });

      updateUser(response.user);
      localStorage.setItem(`onboarded_${user.id}`, "true");
      setShowOnboarding(false);
      triggerToast("Welcome! Profile set up successfully.", "success");
    } catch (err: any) {
      triggerToast(err.message || "Failed to set up profile", "error");
    } finally {
      setIsOnboardingSaving(false);
    }
  };

  // If decoy is activated, override normal views instantly
  if (isDecoyActive) {
    return <DecoyCalculator />;
  }

  // If token is missing, redirect to Authentication page
  if (!token || !user) {
    return <Auth />;
  }

  // Pre-configured elegant custom photography presets
  const AVATAR_PRESETS = [
    { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80", label: "Golden Minimalist" },
    { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=150&h=150&q=80", label: "Sunset Silhouette" },
    { url: "https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?auto=format&fit=crop&w=150&h=150&q=80", label: "Neon Street Vibe" },
    { url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=150&h=150&q=80", label: "Emerald Fog" },
    { url: "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=150&h=150&q=80", label: "Dream Nebula" }
  ];

  return (
    <div className="relative min-h-screen">
      <Layout 
        currentTab={currentTab} 
        setTab={(tab) => {
          if (tab !== "profile" || (tab === "profile" && currentTab === "profile")) {
            setExploreProfileUsername(null);
          }
          setCurrentTab(tab);
        }}
        isChatActive={currentTab === "messages" && isChatConversationActive}
      >
        
        {/* ====================================================================
            TAB SUB-VIEW DISPATCHER
            ==================================================================== */}
        {currentTab === "feed" && (
          <div>
            <Feed />
          </div>
        )}

        {currentTab === "search" && (
          <div>
            <Search onSelectUserProfile={handleNavigateToProfile} />
          </div>
        )}

        {currentTab === "reels" && (
          <div className="animate-fade-in">
            <Reels onSelectUserProfile={handleNavigateToProfile} />
          </div>
        )}

        {currentTab === "messages" && (
          <div className="animate-fade-in">
            <Messages 
              onSelectUserProfile={handleNavigateToProfile} 
              onConversationActiveChange={setIsChatConversationActive}
            />
          </div>
        )}

        {currentTab === "profile" && (
          <div className="animate-fade-in pb-16">
            <Profile 
              targetUsername={exploreProfileUsername}
              onNavigateToMessage={handleNavigateToMessage}
              onClearTargetUsername={handleClearExploreProfile}
            />
          </div>
        )}

        {/* ====================================================================
            FLOATING CUSTOM BANNER TOASTS
            ==================================================================== */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right pointer-events-none select-none">
            <div className={`px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border text-xs font-medium backdrop-blur-md ${
              toast.type === "success"
                ? "bg-emerald-500/95 border-emerald-400 text-white shadow-emerald-500/10"
                : toast.type === "error"
                ? "bg-rose-500/95 border-rose-400 text-white shadow-rose-500/10"
                : "bg-slate-900/95 border-slate-800 text-white shadow-slate-900/10"
            }`}>
              {toast.type === "success" && <Heart className="h-4 w-4 fill-white animate-pulse" />}
              {toast.type === "error" && <Bell className="h-4 w-4 text-white" />}
              {toast.type === "info" && <MessageCircle className="h-4 w-4" />}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </Layout>

      {/* ====================================================================
          FORCED INTERACTIVE PROFILE ONBOARDING OVERLAY
          ==================================================================== */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-[#050505]/95 backdrop-blur-2xl z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0A0A0A]/90 border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative animate-in zoom-in-95 duration-250 select-none text-white">
            {/* Background lights */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#FF7A00]/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="text-center mb-6">
              <span className="text-[9px] font-extrabold text-[#FF7A00] tracking-widest uppercase bg-[#FF7A00]/10 border border-[#FF7A00]/25 px-3 py-1 rounded-full inline-block">
                Onboarding Portal
              </span>
              <h2 className="font-display font-black text-2xl uppercase tracking-tight mt-3 text-white">
                Customize Your Identity
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Welcome to Raynista! To unlock your account features, please personalize your public profile first.
              </p>
            </div>

            <form onSubmit={handleOnboardSubmit} className="flex flex-col gap-5">
              {/* 1. Preset Avatar Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Choose Premium Avatar Preset
                </label>
                <div className="flex items-center justify-center gap-3 py-2 flex-wrap">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = onboardAvatar === preset.url;
                    return (
                      <button
                        type="button"
                        key={preset.url}
                        onClick={() => setOnboardAvatar(preset.url)}
                        title={preset.label}
                        className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all active:scale-95 cursor-pointer ${
                          isSelected ? "border-[#FF7A00] scale-110 shadow-lg shadow-orange-500/20" : "border-white/10 hover:border-white/35"
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Check className="h-4.5 w-4.5 text-[#FF7A00] stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Display Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your visual display name..."
                    value={onboardName}
                    onChange={(e) => setOnboardName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#FF7A00] transition-all hover:border-white/20"
                  />
                </div>
              </div>

              {/* 3. Bio */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Bio
                </label>
                <div className="relative">
                  <Edit3 className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <textarea
                    required
                    placeholder="Tell other members about yourself..."
                    rows={2.5}
                    value={onboardBio}
                    onChange={(e) => setOnboardBio(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#FF7A00] transition-all hover:border-white/20 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 4. Privacy */}
              <div className="flex flex-col gap-2 bg-[#050505]/60 border border-white/5 p-4 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-slate-200">
                      Private Account
                    </span>
                    <p className="text-[9px] text-slate-500 max-w-[280px] leading-relaxed">
                      If enabled, only mutual followers who you accept can interact or message you.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnboardIsPrivate(!onboardIsPrivate)}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      onboardIsPrivate ? "bg-[#FF7A00]" : "bg-white/10"
                    }`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-white absolute top-0.75 transition-all ${
                      onboardIsPrivate ? "left-5.75" : "left-0.75"
                    }`} />
                  </button>
                </div>
              </div>

              {/* Submit Setup */}
              <button
                type="submit"
                disabled={isOnboardingSaving}
                className="w-full bg-[#FF7A00] hover:bg-orange-600 active:scale-98 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10 cursor-pointer mt-2"
              >
                <span>{isOnboardingSaving ? "Synchronizing Profile..." : "Launch My Raynista Journey!"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
