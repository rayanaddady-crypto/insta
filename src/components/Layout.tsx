import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { CreatePostModal } from "./CreatePostModal";
import { useEmergencyDisconnect } from "../hooks/useEmergencyDisconnect";
import { RaymiLogo } from "./RaymiLogo";
import { playSound } from "../utils/sound";
import { 
  Home, 
  Search, 
  PlusSquare, 
  Send,
  User, 
  LogOut, 
  Heart,
  Sun,
  Moon,
  Plus,
  PlaySquare
} from "lucide-react";
import { motion } from "motion/react";
import { InstallAppModal } from "./InstallAppModal";

interface LayoutProps {
  currentTab: string;
  setTab: (tab: string) => void;
  children: React.ReactNode;
  isChatActive?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ currentTab, setTab, children, isChatActive }) => {
  const { user, logout, theme, toggleTheme } = useAuth();
  const { handleStealthTap } = useEmergencyDisconnect();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInstallAppOpen, setIsInstallAppOpen] = useState(false);

  const handlePostCreated = (postType: string) => {
    playSound("pop");
    if (postType === "reel" && currentTab !== "reels") {
      setTab("reels");
    } else if (postType === "standard" && currentTab !== "feed") {
      setTab("feed");
    } else {
      window.dispatchEvent(new CustomEvent("refresh-data"));
    }
  };

  const handleTabChange = (tabId: string) => {
    playSound("click");
    setTab(tabId);
  };

  // Mobile Bottom Bar items exactly matching image.png:
  // 1. Home, 2. Reels (PlaySquare), 3. Messages (Send with red dot), 4. Search, 5. Profile avatar
  const navItems = [
    { id: "feed", label: "Home", icon: Home },
    { id: "reels", label: "Reels", icon: PlaySquare },
    { id: "messages", label: "Messages", icon: Send, hasBadge: false },
    { id: "search", label: "Search", icon: Search },
    { id: "profile", label: "Profile", icon: User }
  ];

  return (
    <div id="layout-root" className="min-h-screen bg-black text-white flex flex-col md:flex-row font-sans selection:bg-[#0095F6] selection:text-white transition-colors duration-300">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside id="desktop-sidebar" className="hidden md:flex flex-col w-72 border-r border-white/10 bg-black/90 backdrop-blur-2xl h-screen sticky top-0 px-6 py-8 justify-between shrink-0 z-30 shadow-2xl transition-colors duration-300">
        <div className="flex flex-col gap-8">
          
          {/* Brand Logo & Name */}
          <div 
            id="brand-logo"
            onClick={() => {
              handleTabChange("feed");
              handleStealthTap();
            }} 
            className="flex items-center gap-3 cursor-pointer font-display font-black text-2xl tracking-tight text-white px-2 group"
          >
            <RaymiLogo size="md" />
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#0095F6] bg-clip-text text-transparent group-hover:tracking-wider transition-all">
              Raymi
            </span>
          </div>

          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Navigation Menu */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  id={`nav-item-${item.id}`}
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-[18px] transition-all duration-300 font-bold text-xs tracking-wider uppercase group relative cursor-pointer ${
                    isActive 
                      ? "bg-[#0095F6]/15 text-[#0095F6] border border-[#0095F6]/30 shadow-lg shadow-blue-500/10" 
                      : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Icon className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-[#0095F6]" : "text-slate-400 group-hover:text-white"}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <motion.div 
                      layoutId="activeIndicator" 
                      className="w-1.5 h-1.5 rounded-full bg-[#0095F6]"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}

            {/* Create Button */}
            <button
              id="nav-item-create"
              onClick={() => {
                playSound("pop");
                setIsCreateOpen(true);
              }}
              className="flex items-center justify-between px-4 py-3.5 rounded-[18px] transition-all duration-300 font-bold text-xs tracking-wider uppercase text-slate-400 hover:bg-white/5 hover:text-white group border border-transparent w-full text-left cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <PlusSquare className="h-4.5 w-4.5 text-slate-400 group-hover:text-[#0095F6] transition-transform duration-300 group-hover:scale-110" />
                <span>Create</span>
              </div>
              <span className="text-[9px] bg-[#0095F6]/15 text-[#0095F6] px-2 py-0.5 rounded-full font-bold group-hover:bg-[#0095F6] group-hover:text-white transition-colors">NEW</span>
            </button>

            {/* Theme Selector */}
            <button
              id="nav-item-theme"
              onClick={() => {
                playSound("toggle");
                toggleTheme();
              }}
              className="flex items-center justify-between px-4 py-3.5 rounded-[18px] transition-all duration-300 font-bold text-xs tracking-wider uppercase text-slate-400 hover:bg-white/5 hover:text-white group border border-transparent w-full text-left cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4.5 w-4.5 text-amber-500 group-hover:rotate-45 transition-transform" />
                    <span>Appearance: Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4.5 w-4.5 text-blue-400 group-hover:-rotate-12 transition-transform" />
                    <span>Appearance: Dark</span>
                  </>
                )}
              </div>
            </button>
          </nav>
        </div>

        {/* User Account Info */}
        <div className="flex flex-col gap-4 border-t border-white/10 pt-6">
          {user && (
            <div className="flex items-center gap-3.5 px-2 py-1">
              <div className="relative">
                <img 
                  src={user.avatar_url} 
                  alt={user.username} 
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full border-2 border-[#0095F6]/30 object-cover shadow-md" 
                />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-xs text-white truncate">@{user.username}</span>
                <span className="text-[10px] text-slate-500 font-medium truncate">Raymi Member</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              playSound("click");
              logout();
            }}
            className="flex items-center gap-4 px-4 py-3.5 rounded-[18px] text-slate-400 hover:bg-red-950/30 hover:text-red-400 border border-transparent hover:border-red-900/30 transition-all duration-300 font-bold text-xs tracking-wider uppercase cursor-pointer"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* --- MOBILE HEADER FOR RAYMI --- */}
      <header id="mobile-header" className={`md:hidden ${isChatActive ? "hidden" : "flex"} items-center justify-between px-4 py-3 bg-black/95 border-b border-white/10 backdrop-blur-md sticky top-0 z-40 transition-colors duration-300`}>
        {/* Left: Plus icon for Create */}
        <button 
          onClick={() => {
            playSound("pop");
            setIsCreateOpen(true);
          }}
          title="Create"
          className="text-white hover:text-[#0095F6] active:scale-90 transition-transform p-1 cursor-pointer"
        >
          <Plus className="h-7 w-7" />
        </button>

        {/* Center: Raymi Brand Logo & Title */}
        <div 
          onClick={() => handleTabChange("feed")} 
          className="cursor-pointer flex items-center gap-2"
        >
          <RaymiLogo size="sm" />
          <span className="font-display font-black text-xl tracking-tight text-white uppercase bg-gradient-to-r from-white via-slate-100 to-[#0095F6] bg-clip-text text-transparent">
            Raymi
          </span>
        </div>

        {/* Right: Heart shortcut */}
        <button 
          onClick={() => handleTabChange("messages")}
          title="Messages"
          className="text-white hover:text-[#0095F6] active:scale-90 transition-transform p-1 cursor-pointer relative"
        >
          <Heart className="h-6 w-6" />
        </button>
      </header>

      {/* --- MAIN WORKSPACE --- */}
      <main id="main-workspace" className={`flex-1 ${
        isChatActive 
          ? "h-[100dvh] max-h-[100dvh] overflow-hidden pb-0" 
          : currentTab === "messages" 
          ? "h-[calc(100vh-4rem)] md:h-screen overflow-hidden pb-0" 
          : "overflow-y-auto max-h-screen md:h-screen pb-20 md:pb-0"
      } bg-black text-white transition-colors duration-300`}>
        {children}
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION MATCHING image.png --- */}
      <nav id="mobile-bottom-bar" className={`md:hidden ${isChatActive ? "hidden" : "flex"} fixed bottom-0 left-0 right-0 h-14 bg-black border-t border-white/10 items-center justify-around px-2 z-40`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          
          if (item.id === "profile" && user?.avatar_url) {
            return (
              <button
                id={`mobile-nav-${item.id}`}
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex items-center justify-center p-1 rounded-full transition-all duration-200 cursor-pointer ${
                  isActive ? "ring-2 ring-[#0095F6] ring-offset-2 ring-offset-black" : "opacity-80 hover:opacity-100"
                }`}
              >
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-6.5 h-6.5 rounded-full object-cover border border-white/20"
                />
              </button>
            );
          }

          return (
            <button
              id={`mobile-nav-${item.id}`}
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 relative cursor-pointer ${
                isActive ? "text-white scale-105" : "text-white/80 hover:text-white"
              }`}
            >
              <div className="relative">
                <Icon className={`h-6 w-6 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
                {item.hasBadge && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF3040] ring-2 ring-black" />
                )}
              </div>
            </button>
          );
        })}
      </nav>

      <CreatePostModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        onSuccess={handlePostCreated} 
      />

      <InstallAppModal isOpen={isInstallAppOpen} onClose={() => setIsInstallAppOpen(false)} />
    </div>
  );
};

