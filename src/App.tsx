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
import { ErrorBoundary } from "./components/ErrorBoundary";

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

  // If decoy is activated, override normal views instantly
  if (isDecoyActive) {
    return <DecoyCalculator />;
  }

  // If token is missing, redirect to Authentication page
  if (!token || !user) {
    return <Auth />;
  }

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
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
