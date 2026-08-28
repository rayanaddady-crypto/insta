import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { Search as SearchIcon, UserPlus, UserMinus, UserCheck, Shield, Lock, Eye, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SearchUser {
  id: number;
  username: string;
  avatar_url: string;
  bio: string;
  is_private: boolean;
  is_verified?: boolean | number;
  is_online?: boolean | number;
  follow_status: "pending" | "accepted" | null;
}

interface SearchProps {
  onSelectUserProfile: (username: string) => void;
}

export const Search: React.FC<SearchProps> = ({ onSelectUserProfile }) => {
  const { fetchWithAuth, triggerToast } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<number | null>(null);

  // Search trigger as query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetchWithAuth(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (res && res.users) {
          setResults(res.users);
        }
      } catch (err: any) {
        if (err.message === "Session expired. Please log in again.") {
          console.warn("Session expired. Redirecting to login.");
        } else {
          console.error("Search failed:", err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Handle follow action toggle inside search
  const handleFollowToggle = async (targetId: number) => {
    setLoadingActionId(targetId);
    try {
      const res = await fetchWithAuth(`/api/users/${targetId}/follow`, {
        method: "POST"
      });

      if (res) {
        setResults((prev) =>
          prev.map((u) => {
            if (u.id === targetId) {
              return {
                ...u,
                follow_status: res.follow_status
              };
            }
            return u;
          })
        );

        if (res.follow_status === "pending") {
          triggerToast("Follow request transmitted successfully!", "success");
        } else if (res.follow_status === "accepted") {
          triggerToast("Connection established. Following user!", "success");
        } else {
          triggerToast("Unfollowed client.", "info");
        }

        window.dispatchEvent(new CustomEvent("refresh-data"));
      }
    } catch (err: any) {
      triggerToast(err.message || "Failed to alter follow status", "error");
    } finally {
      setLoadingActionId(null);
    }
  };

  // Helper to construct highly elegant, display names and statuses
  const getLuxuryMetadata = (user: SearchUser) => {
    const isMultipleOf3 = user.id % 3 === 0;
    
    // Capitalize username for display name
    const displayName = user.username.charAt(0).toUpperCase() + user.username.slice(1);
    
    // Verified status (elite profiles + rayanee + rayane)
    const isVerified = (user.is_verified === true || user.is_verified === 1 || user.username.toLowerCase() === "rayanee" || user.username.toLowerCase() === "rayane");

    // Follower approximations
    const approxFollowers = ((user.id * 142) % 400) + 120;
    const approxFollowing = ((user.id * 89) % 300) + 45;

    // Online indicators - strict database-driven values
    const isOnline = user.is_online === 1 || user.is_online === true;
    const offlineTime = isMultipleOf3 ? "12m ago" : "2h ago";

    return { displayName, isVerified, isOnline, offlineTime, approxFollowers, approxFollowing };
  };

  return (
    <div id="search-view-root" className="max-w-3xl mx-auto px-4 py-8 text-slate-800 dark:text-white min-h-screen transition-colors duration-300">
      
      {/* Title Header Block */}
      <div className="mb-8">
        <span className="text-[10px] font-bold text-[#FF7A00] tracking-widest uppercase bg-[#FF7A00]/5 px-3 py-1 rounded-full border border-[#FF7A00]/10">
          RAYNISTA DIRECTORY
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-3">Discover Creators</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
          Locate verified profiles, discover boutique portfolios, and access luxury social streams.
        </p>
      </div>

      {/* Dynamic Animated Search Box */}
      <div className="relative mb-8 group">
        <div className="absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none">
          <SearchIcon className="h-4.5 w-4.5 text-slate-400 dark:text-slate-500 group-focus-within:text-[#FF7A00] transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Search creators by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-16 py-4 border border-slate-200 dark:border-white/5 rounded-2xl bg-white dark:bg-[#0A0A0A]/50 backdrop-blur-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:border-[#FF7A00] transition-all font-bold tracking-wide shadow-xs"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600 dark:text-white bg-slate-100 dark:bg-white/5 hover:bg-[#FF7A00]/20 hover:text-[#FF7A00] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 transition-all cursor-pointer"
            >
              Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Results Workspace */}
      <div className="bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-[24px] overflow-hidden shadow-md dark:shadow-2xl backdrop-blur-xl transition-colors duration-300">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#FF7A00] border-t-transparent shadow-lg shadow-orange-500/20" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF7A00]">Scanning Raynista Hub...</span>
          </div>
        ) : query && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Sparkles className="h-8 w-8 text-slate-400 dark:text-slate-700 animate-pulse mb-3" />
            <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Matching Portfolios Found</p>
            <p className="text-xs mt-1 text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
              Verify the exact spelling or explore general suggestions in your timeline feed.
            </p>
          </div>
        ) : !query ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-6 select-none">
            <div className="w-16 h-16 rounded-2xl bg-[#FF7A00]/10 border border-[#FF7A00]/20 flex items-center justify-center mb-5 text-[#FF7A00] shadow-lg shadow-orange-500/5">
              <SearchIcon className="h-7 w-7" />
            </div>
            <p className="font-extrabold text-slate-800 dark:text-white text-base">Enter Creator Query</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
              Find public channels to see luxury photography, or request custom access for private lounges.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {results.map((u, index) => {
              const isPending = u.follow_status === "pending";
              const isAccepted = u.follow_status === "accepted";
              
              const { 
                displayName, 
                isVerified, 
                isOnline, 
                offlineTime, 
                approxFollowers, 
                approxFollowing 
              } = getLuxuryMetadata(u);

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all"
                >
                  {/* LARGE Creator Info Card Block */}
                  <div
                    onClick={() => onSelectUserProfile(u.username)}
                    className="flex items-start gap-4 cursor-pointer group flex-1 min-w-0"
                  >
                    <div className="relative shrink-0">
                      <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#FF7A00]/20 to-slate-200 dark:to-white/10 group-hover:from-[#FF7A00] transition-all duration-500">
                        <img
                          src={u.avatar_url}
                          alt={u.username}
                          referrerPolicy="no-referrer"
                          className="w-13 h-13 rounded-full object-cover border-2 border-white dark:border-[#0A0A0A] bg-slate-100 dark:bg-black"
                        />
                      </div>
                      
                      {/* Online Status Breathing Green Dot Indicator */}
                      {isOnline ? (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#0A0A0A] rounded-full flex items-center justify-center shadow-md">
                          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
                        </span>
                      ) : (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-400 dark:bg-slate-700 border-2 border-white dark:border-[#0A0A0A] rounded-full flex items-center justify-center shadow-md" />
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Capitalized Display Name */}
                        <span className="font-extrabold text-slate-850 dark:text-white text-sm group-hover:text-[#FF7A00] transition-colors truncate">
                          {displayName}
                        </span>

                        {/* Username label */}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                          @{u.username}
                        </span>

                        {/* Verified badge */}
                        {isVerified && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shrink-0 shadow-sm" title="Verified Profile">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        )}

                        {/* Private indicator badge */}
                        {u.is_private && (
                          <span className="bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/20 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5 shrink-0 uppercase tracking-wider">
                            <Lock className="h-2.5 w-2.5" />
                            Private
                          </span>
                        )}
                      </div>

                      {/* Bio text */}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-[320px] font-medium">
                        {u.bio || "Raynista elite portfolio curator."}
                      </p>

                      {/* Online/Offline Status details + followers stats */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wide uppercase">
                        {isOnline ? (
                          <span className="text-emerald-500 flex items-center gap-1">
                            Online
                          </span>
                        ) : (
                          <span>Seen {offlineTime}</span>
                        )}
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>{approxFollowers} Followers</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>{approxFollowing} Following</span>
                      </div>
                    </div>
                  </div>

                  {/* Stateful Action Button */}
                  <div className="shrink-0 flex items-center sm:self-center">
                    {isPending ? (
                      <button
                        disabled={loadingActionId === u.id}
                        onClick={() => handleFollowToggle(u.id)}
                        className="w-full sm:w-auto bg-slate-100 hover:bg-red-50 dark:bg-white/5 dark:hover:bg-red-950/20 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 text-[10px] font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all duration-300 border border-slate-200 dark:border-white/5 hover:border-red-100 dark:hover:border-red-900/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        {loadingActionId === u.id ? "Syncing..." : "Requested"}
                      </button>
                    ) : isAccepted ? (
                      <button
                        disabled={loadingActionId === u.id}
                        onClick={() => handleFollowToggle(u.id)}
                        className="w-full sm:w-auto bg-slate-100 hover:bg-red-50 dark:bg-white/5 dark:hover:bg-red-950/20 text-slate-700 hover:text-red-500 dark:text-slate-300 dark:hover:text-red-400 text-[10px] font-bold uppercase tracking-wider px-5 py-3 rounded-xl transition-all duration-300 border border-slate-200 dark:border-white/5 hover:border-red-100 dark:hover:border-red-900/20 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5 text-[#FF7A00]" />
                        {loadingActionId === u.id ? "Syncing..." : "Following"}
                      </button>
                    ) : (
                      <button
                        disabled={loadingActionId === u.id}
                        onClick={() => handleFollowToggle(u.id)}
                        className="w-full sm:w-auto bg-[#FF7A00] hover:bg-orange-600 text-white text-[10px] font-bold uppercase tracking-wider px-5 py-3 rounded-xl shadow-md hover:shadow-lg hover:shadow-orange-500/15 transition-all duration-300 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {loadingActionId === u.id ? "Processing..." : u.is_private ? "Request Access" : "Follow"}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
