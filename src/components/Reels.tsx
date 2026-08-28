import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { ReelPost } from "../types";
import { Heart, MessageCircle, Send, Bookmark, Volume2, VolumeX, Plus, Check, MessageSquare, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ====================================================================
// INDIVIDUAL REEL VIDEO PLAYER SUB-COMPONENT (Handles auto-play & observer)
// ====================================================================
interface ReelItemProps {
  reel: ReelPost;
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  onLike: (id: number) => void;
  onBookmark: (id: number) => void;
  onShare: (id: number) => void;
  onFollowToggle: (userId: number) => void;
  onOpenComments: (reel: ReelPost) => void;
  triggerToast: (msg: string, type: "success" | "error") => void;
  onSelectUserProfile?: (username: string) => void;
}

const ReelItem: React.FC<ReelItemProps> = ({
  reel,
  isActive,
  isMuted,
  toggleMute,
  onLike,
  onBookmark,
  onShare,
  onFollowToggle,
  onOpenComments,
  triggerToast,
  onSelectUserProfile
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Auto-play/pause based on visible viewport status
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      video.play().catch((err) => {
        console.log("Autoplay blocked or video error:", err);
      });
    } else {
      video.pause();
    }
  }, [isActive]);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      if (!reel.is_liked) {
        onLike(reel.id);
      }
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 850);
    }
    lastTapRef.current = now;
  };

  const isVerified = reel.user.id % 2 === 0;

  return (
    <div 
      className="relative w-full h-full snap-start bg-[#050505] flex items-center justify-center overflow-hidden"
      onClick={handleDoubleTap}
    >
      {/* Video Loop Element (Split Screen for Co-Reels) */}
      {reel.co_creator ? (
        <div className="w-full h-full grid grid-cols-2 bg-black select-none">
          {/* Main Creator Panel */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              src={reel.media_url}
              loop
              playsInline
              webkit-playsinline="true"
              muted={isMuted}
              className="w-full h-full object-cover"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
            />
          </div>

          {/* Co-Creator Panel */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden border-l border-white/5">
            <video
              src={reel.media_url}
              loop
              playsInline
              webkit-playsinline="true"
              muted={isMuted}
              className="w-full h-full object-cover brightness-85 contrast-[105%] saturate-[110%] hue-rotate-15"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
            />
            <div className="absolute inset-0 bg-[#FF7A00]/5 pointer-events-none" />
            <span className="absolute top-4 right-4 bg-[#FF7A00]/90 text-white text-[8px] font-bold tracking-widest px-2 py-1 rounded-md uppercase border border-orange-400/20 shadow-lg shadow-orange-500/10">
              React
            </span>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={reel.media_url}
          loop
          playsInline
          webkit-playsinline="true"
          muted={isMuted}
          className="w-full h-full object-cover"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
        />
      )}

      {/* Click-to-Mute Icon Indicator (Brief Flash Animation) */}
      <div className="absolute top-6 left-6 z-20 bg-black/50 backdrop-blur-md p-2.5 rounded-full border border-white/10 pointer-events-none shadow-md">
        {isMuted ? (
          <VolumeX className="h-4 w-4 text-white" />
        ) : (
          <Volume2 className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Central Popping Double-Tap Heart Overlay */}
      <AnimatePresence>
        {doubleTapHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4, 0.95, 1], opacity: [0, 1, 1, 0] }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none z-10"
          >
            <Heart className="h-24 w-24 text-white fill-[#FF7A00] drop-shadow-[0_0_15px_rgba(255,122,0,0.5)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Gradient overlay */}
      <div className="absolute bottom-0 inset-x-0 h-56 bg-gradient-to-t from-black via-black/45 to-transparent pointer-events-none z-10" />

      {/* ====================================================================
          REEL BOTTOM INFORMATION DETAILS
          ==================================================================== */}
      <div className="absolute bottom-6 left-6 right-16 z-20 flex flex-col gap-3.5 text-white pointer-events-auto">
        {/* Creator Identity & Follow Status */}
        <div className="flex items-center gap-3">
          {reel.co_creator ? (
            <div className="flex items-center">
              <div className="relative w-14 h-10 select-none shrink-0 cursor-pointer" onClick={() => onSelectUserProfile?.(reel.user.username)}>
                <img
                  src={reel.user.avatar_url}
                  alt={reel.user.username}
                  referrerPolicy="no-referrer"
                  className="absolute left-0 top-0 w-8 h-8 rounded-full border-2 border-[#0A0A0A] object-cover shadow-md z-10"
                />
                <img
                  src={reel.co_creator.avatar_url}
                  alt={reel.co_creator.username}
                  referrerPolicy="no-referrer"
                  className="absolute left-4 top-2 w-8 h-8 rounded-full border-2 border-[#FF7A00] object-cover shadow-md z-20"
                />
              </div>
              <div className="flex flex-col ml-1">
                <span className="font-bold text-xs flex items-center gap-1.5 leading-none">
                  <button onClick={() => onSelectUserProfile?.(reel.user.username)} className="hover:underline cursor-pointer">@{reel.user.username}</button>
                  <span className="text-[#FF7A00] font-extrabold">&</span>
                  <button onClick={() => onSelectUserProfile?.(reel.co_creator.username)} className="hover:underline cursor-pointer">@{reel.co_creator.username}</button>
                </span>
                <span className="text-[9px] text-[#FF7A00] font-bold uppercase tracking-wider mt-1">Co-Stream Collaboration</span>
              </div>
            </div>
          ) : (
            <>
              <img
                src={reel.user.avatar_url}
                alt={reel.user.username}
                referrerPolicy="no-referrer"
                onClick={() => onSelectUserProfile?.(reel.user.username)}
                className="w-10 h-10 rounded-full border-2 border-[#FF7A00] object-cover shadow-md shrink-0 bg-black cursor-pointer hover:opacity-90 transition-opacity"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span onClick={() => onSelectUserProfile?.(reel.user.username)} className="font-bold text-xs cursor-pointer hover:underline">@{reel.user.username}</span>
                  {isVerified && (
                    <span className="w-3.5 h-3.5 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] flex items-center justify-center p-[2px]">
                      <Check className="h-2 w-2 stroke-[4]" />
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Original Audio</span>
              </div>
            </>
          )}

          {/* Follow Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFollowToggle(reel.user.id);
            }}
            className={`ml-2 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all duration-300 active:scale-95 cursor-pointer ${
              reel.user.is_following
                ? "bg-white/10 border border-white/10 text-white"
                : "bg-[#FF7A00] hover:bg-orange-600 text-white shadow-lg shadow-orange-500/10"
            }`}
          >
            {reel.user.is_following ? (
              <>
                <Check className="h-2.5 w-2.5" />
                <span>Following</span>
              </>
            ) : (
              <>
                <Plus className="h-2.5 w-2.5" />
                <span>Follow</span>
              </>
            )}
          </button>
        </div>

        {/* Caption */}
        <p className="text-xs text-slate-300 max-w-sm font-semibold leading-relaxed line-clamp-3">
          {reel.caption}
        </p>
      </div>

      {/* ====================================================================
          RIGHT SIDEBAR ENGAGEMENT RAIL
          ==================================================================== */}
      <div className="absolute right-4 bottom-12 z-20 flex flex-col items-center gap-5 pointer-events-auto">
        {/* Like Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike(reel.id);
            }}
            className={`p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/5 transition-all duration-300 active:scale-90 shadow-lg ${
              reel.is_liked
                ? "bg-[#FF7A00] text-white border-orange-500 shadow-orange-500/20"
                : "text-white hover:bg-white/10"
            }`}
          >
            <Heart className={`h-5 w-5 ${reel.is_liked ? "fill-white" : ""}`} />
          </button>
          <span className="text-white text-[10px] font-bold drop-shadow-md">
            {reel.likes_count.toLocaleString()}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(reel);
            }}
            className="p-3 rounded-xl bg-black/50 hover:bg-white/10 backdrop-blur-md border border-white/5 text-white transition-all active:scale-90 shadow-lg"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          <span className="text-white text-[10px] font-bold drop-shadow-md">
            {reel.comments_count.toLocaleString()}
          </span>
        </div>

        {/* Share Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(reel.id);
            }}
            className="p-3 rounded-xl bg-black/50 hover:bg-white/10 backdrop-blur-md border border-white/5 text-white transition-all active:scale-90 shadow-lg"
          >
            <Send className="h-4.5 w-4.5 -rotate-12 text-[#FF7A00]" />
          </button>
          <span className="text-white text-[9px] font-bold uppercase tracking-wider">Share</span>
        </div>

        {/* Bookmark Button */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(reel.id);
            }}
            className={`p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/5 transition-all duration-300 active:scale-90 shadow-lg ${
              reel.is_bookmarked
                ? "bg-white text-black hover:bg-white"
                : "text-white hover:bg-white/10"
            }`}
          >
            <Bookmark className={`h-5 w-5 ${reel.is_bookmarked ? "fill-black" : ""}`} />
          </button>
          <span className="text-white text-[9px] font-bold uppercase tracking-wider">Save</span>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// MAIN REELS PAGE MODULE
// ====================================================================
export const Reels: React.FC = () => {
  const { fetchWithAuth, triggerToast } = useAuth();
  const [reels, setReels] = useState<ReelPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  // Comments sidebar / sheet state
  const [activeCommentReel, setActiveCommentReel] = useState<ReelPost | null>(null);
  const [comments, setComments] = useState<Array<{ id: number; text: string; username: string; avatar_url: string }>>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const loadReels = async () => {
    try {
      const data = await fetchWithAuth("/api/reels");
      setReels(data.reels);
    } catch (err: any) {
      if (err.message === "Session expired. Please log in again.") {
        console.warn("Session expired. Redirecting to login.");
      } else {
        console.error("Failed to load reels:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReels();

    // Listen to refresh events from Layouts
    const handleRefresh = () => {
      loadReels();
    };
    window.addEventListener("refresh-data", handleRefresh);
    return () => {
      window.removeEventListener("refresh-data", handleRefresh);
    };
  }, []);

  // Monitor vertical scrolling to determine which Reel is active in view
  useEffect(() => {
    const container = containerRef.current;
    if (!container || reels.length === 0) return;

    const options = {
      root: container,
      rootMargin: "0px",
      threshold: 0.6 // Reel must be at least 60% visible to count
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute("data-index") || "0");
          setActiveIndex(index);
        }
      });
    }, options);

    // Observe each reel container child
    const children = container.querySelectorAll("[data-index]");
    children.forEach((child) => observer.observe(child));

    return () => {
      children.forEach((child) => observer.unobserve(child));
    };
  }, [reels]);

  const handleLike = async (id: number) => {
    try {
      // Optimistic like update
      setReels((prev) =>
        prev.map((r) => {
          if (r.id === id) {
            return {
              ...r,
              is_liked: !r.is_liked,
              likes_count: r.is_liked ? r.likes_count - 1 : r.likes_count + 1
            };
          }
          return r;
        })
      );

      const response = await fetchWithAuth(`/api/posts/${id}/like`, {
        method: "POST"
      });

      // Synchronize exact server values
      setReels((prev) =>
        prev.map((r) => {
          if (r.id === id) {
            return {
              ...r,
              is_liked: response.is_liked,
              likes_count: response.likes_count
            };
          }
          return r;
        })
      );
    } catch (err: any) {
      triggerToast(err.message || "Failed to toggle like", "error");
    }
  };

  const handleFollowToggle = async (userId: number) => {
    try {
      const response = await fetchWithAuth(`/api/users/${userId}/follow`, {
        method: "POST"
      });

      // Update following state for all reels by this user ID
      setReels((prev) =>
        prev.map((r) => {
          if (r.user.id === userId) {
            return {
              ...r,
              user: {
                ...r.user,
                is_following: response.is_following
              }
            };
          }
          return r;
        })
      );

      triggerToast(
        response.is_following ? "Following creator!" : "Unfollowed creator.",
        "success"
      );
    } catch (err: any) {
      triggerToast(err.message || "Failed to connect", "error");
    }
  };

  const handleBookmark = async (id: number) => {
    try {
      setReels(prev => prev.map(r => r.id === id ? { ...r, is_bookmarked: !r.is_bookmarked } : r));
      const response = await fetchWithAuth(`/api/posts/${id}/bookmark`, { method: "POST" });
      setReels(prev => prev.map(r => r.id === id ? { ...r, is_bookmarked: response.is_bookmarked } : r));
      triggerToast(response.is_bookmarked ? "Saved to Bookmarks Portfolio" : "Removed from Portfolio", "success");
    } catch (err: any) {
      triggerToast(err.message || "Failed to archive", "error");
    }
  };

  const [shareReelId, setShareReelId] = useState<number | null>(null);

  const handleShare = (id: number) => {
    setShareReelId(id);
  };

  const handleOpenComments = (reel: ReelPost) => {
    setActiveCommentReel(reel);
    setComments(reel.comments);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activeCommentReel) return;

    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth(`/api/posts/${activeCommentReel.id}/comment`, {
        method: "POST",
        body: JSON.stringify({ text: newComment })
      });

      const freshComment = {
        id: response.comment.id,
        text: response.comment.text,
        username: response.comment.user.username,
        avatar_url: response.comment.user.avatar_url
      };

      // Add to local overlay list
      setComments((prev) => [...prev, freshComment]);
      setNewComment("");

      // Update comments counter inside reels list state
      setReels((prev) =>
        prev.map((r) => {
          if (r.id === activeCommentReel.id) {
            return {
              ...r,
              comments_count: r.comments_count + 1,
              comments: [...r.comments, freshComment]
            };
          }
          return r;
        })
      );

      triggerToast("Broadcast comment saved!", "success");
    } catch (err: any) {
      triggerToast(err.message || "Failed to post reaction", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-4rem)] md:h-screen bg-[#050505] flex justify-center items-center relative">
      
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 text-white">
          <div className="w-10 h-10 rounded-full border-4 border-[#FF7A00] border-t-transparent animate-spin shadow-lg" />
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest animate-pulse">Syncing luxury streams...</span>
        </div>
      ) : reels.length === 0 ? (
        <div className="text-center p-8 text-white max-w-sm flex flex-col items-center gap-3 select-none">
          <MessageSquare className="h-10 w-10 text-slate-700 animate-pulse" />
          <h4 className="font-bold text-sm uppercase tracking-wider text-slate-300">Quiet Channels</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
            Create a pristine luxury Reel by choosing the vertical format tab in the publication header.
          </p>
        </div>
      ) : (
        /* Snapping vertical video canvas container */
        <div
          ref={containerRef}
          className="w-full max-w-md h-full bg-[#050505] md:rounded-[24px] overflow-y-scroll snap-y snap-mandatory scrollbar-none relative border border-white/5"
        >
          {reels.map((reel, index) => (
            <div
              key={reel.id}
              data-index={index}
              className="w-full h-full snap-start shrink-0"
            >
              <ReelItem
                reel={reel}
                isActive={index === activeIndex && !activeCommentReel}
                isMuted={isMuted}
                toggleMute={() => setIsMuted(!isMuted)}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onShare={handleShare}
                onFollowToggle={handleFollowToggle}
                onOpenComments={handleOpenComments}
                triggerToast={triggerToast}
              />
            </div>
          ))}
        </div>
      )}

      {/* ====================================================================
          REELS COMMMENTS OVERLAY SHEET
          ==================================================================== */}
      <AnimatePresence>
        {activeCommentReel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 z-30 flex items-end justify-center pointer-events-auto"
            onClick={() => setActiveCommentReel(null)}
          >
            {/* Sheet contents wrapper */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#0A0A0A] rounded-t-[24px] max-w-md w-full h-[60vh] flex flex-col justify-between overflow-hidden relative z-40 text-white border-t border-white/10"
              onClick={(e) => e.stopPropagation()} // halt bubbling click close
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-[#0A0A0A]">
                <div>
                  <span className="font-display font-extrabold text-xs uppercase tracking-wider text-[#FF7A00]">Comments</span>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Dialogue Thread</p>
                </div>
                <button
                  onClick={() => setActiveCommentReel(null)}
                  className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrolling List */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 scrollbar-none">
                {comments.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-slate-500 select-none">
                    <MessageCircle className="h-8 w-8 text-slate-700 mb-2 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pristine silence</span>
                    <span className="text-[10px] text-slate-500 max-w-xs mt-1 leading-relaxed">Be the very first collector to leave feedback and spark conversation in this thread.</span>
                  </div>
                ) : (
                  comments.map((comment, i) => {
                    const isCommentVerified = comment.username.length % 2 === 0;
                    return (
                      <div key={i} className="flex gap-3 items-start animate-fade-in bg-white/3 border border-white/3 p-3.5 rounded-xl">
                        <img
                          src={comment.avatar_url}
                          alt={comment.username}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/10"
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="font-extrabold text-xs text-white">@{comment.username}</span>
                            {isCommentVerified && (
                              <span className="w-3.5 h-3.5 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] flex items-center justify-center p-[2.5px]">
                                <Check className="h-2 w-2 stroke-[4]" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed mt-1 font-medium">{comment.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* New Comment Submission bar */}
              <form
                onSubmit={handleAddComment}
                className="p-4 border-t border-white/5 flex items-center gap-3 bg-[#0A0A0A]"
              >
                <input
                  type="text"
                  placeholder="Express your luxury review..."
                  required
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 bg-[#121212] border border-white/5 rounded-full px-5 py-3 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00]/25 transition-all font-semibold"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="bg-[#FF7A00] hover:bg-orange-600 disabled:bg-white/5 disabled:text-slate-600 text-white font-bold text-xs uppercase tracking-wider py-3 px-5 rounded-full transition-all shrink-0 cursor-pointer"
                >
                  {isSubmitting ? "Transmitting..." : "Send"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          SHARE SHEET MODAL
          ==================================================================== */}
      <AnimatePresence>
        {shareReelId && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-[#0D0D0D] rounded-t-[24px] md:rounded-[24px] max-w-sm w-full shadow-2xl overflow-hidden flex flex-col border border-white/10"
            >
              <div className="px-6 py-4.5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">Share</h3>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Share premium asset with contacts</p>
                </div>
                <button 
                  onClick={() => setShareReelId(null)}
                  className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 select-none">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/reel/${shareReelId}`);
                    triggerToast("Asset link recorded to clipboard!", "success");
                    setShareReelId(null);
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-white/3 hover:bg-white/5 rounded-2xl border border-white/5 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 bg-[#FF7A00]/10 border border-[#FF7A00]/20 rounded-xl flex items-center justify-center transition-colors">
                    <Bookmark className="h-5 w-5 text-[#FF7A00]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mt-1">Copy link</span>
                </button>
                
                <button 
                  onClick={() => {
                    triggerToast("Transmitted via concierge chat logs", "success");
                    setShareReelId(null);
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-white/3 hover:bg-white/5 rounded-2xl border border-white/5 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center transition-colors">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mt-1">Send via DM</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
