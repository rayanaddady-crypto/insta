import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { FeedPost, Comment } from "../types";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Smile, X, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StoryBar } from "./StoryBar";
import { StoryViewer, StoryItem } from "./StoryViewer";

export const Feed: React.FC = () => {
  const { user, fetchWithAuth, triggerToast } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stories Modal State
  const [storyStartIndex, setStoryStartIndex] = useState<number | null>(null);

  // Comments Panel State
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Overlay heart animation trackers: maps post_id to boolean
  const [doubleTapHearts, setDoubleTapHearts] = useState<{ [key: number]: boolean }>({});

  // Share Modal State
  const [sharePostId, setSharePostId] = useState<number | null>(null);

  const [stories, setStories] = useState<StoryItem[]>([]);

  const loadFeed = async () => {
    try {
      const data = await fetchWithAuth("/api/feed");
      setPosts(data.feed);
      
      const storiesData = await fetchWithAuth("/api/stories");
      const mappedStories = storiesData.stories.map((s: any) => ({
        username: s.user.username,
        avatar: s.user.avatar_url,
        media: s.media_url,
        caption: s.caption
      }));
      setStories(mappedStories);
    } catch (err: any) {
      if (err.message === "Session expired. Please log in again.") {
        console.warn("Session expired. Redirecting to login.");
      } else {
        console.error("Failed to load feed/stories:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();

    // Listen to refresh events from layouts
    const handleRefresh = () => {
      loadFeed();
    };
    window.addEventListener("refresh-data", handleRefresh);
    return () => {
      window.removeEventListener("refresh-data", handleRefresh);
    };
  }, []);

  const handleLike = async (postId: number) => {
    try {
      // Optimistic Update
      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              is_liked: !p.is_liked,
              likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1
            };
          }
          return p;
        })
      );

      const response = await fetchWithAuth(`/api/posts/${postId}/like`, {
        method: "POST"
      });

      // Synchronize exact server value
      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              is_liked: response.is_liked,
              likes_count: response.likes_count
            };
          }
          return p;
        })
      );
    } catch (err: any) {
      triggerToast(err.message || "Failed to toggle like", "error");
    }
  };

  const handleBookmark = async (postId: number) => {
    try {
      // Optimistic update
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, is_bookmarked: !p.is_bookmarked };
        }
        return p;
      }));

      const response = await fetchWithAuth(`/api/posts/${postId}/bookmark`, { method: "POST" });
      
      // Sync
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return { ...p, is_bookmarked: response.is_bookmarked };
        }
        return p;
      }));
      
      triggerToast(response.is_bookmarked ? "Archived to Saved" : "Removed from Saved", "success");
    } catch (err: any) {
      triggerToast(err.message || "Failed to toggle save", "error");
    }
  };

  // Support Instagram Double-Tap to Like with central Pop-Up Heart Animation
  const lastTapRef = useRef<{ [key: number]: number }>({});
  
  const handleImageDoubleTap = (postId: number) => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    const lastTap = lastTapRef.current[postId] || 0;

    if (now - lastTap < DOUBLE_PRESS_DELAY) {
      // Find the post
      const targetPost = posts.find((p) => p.id === postId);
      if (targetPost && !targetPost.is_liked) {
        handleLike(postId);
      }

      // Pop heart animation
      setDoubleTapHearts((prev) => ({ ...prev, [postId]: true }));
      setTimeout(() => {
        setDoubleTapHearts((prev) => ({ ...prev, [postId]: false }));
      }, 800);
    }
    lastTapRef.current[postId] = now;
  };

  const handleAddComment = async (e: React.FormEvent, postId: number) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const response = await fetchWithAuth(`/api/posts/${postId}/comment`, {
        method: "POST",
        body: JSON.stringify({ text: commentText })
      });

      // Update local state
      setPosts((prevPosts) =>
        prevPosts.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              comments: [...p.comments, response.comment]
            };
          }
          return p;
        })
      );

      setCommentText("");
      triggerToast("Comment authenticated", "success");
    } catch (err: any) {
      triggerToast(err.message || "Failed to post comment", "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatTime = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6 text-white">
      
      {/* Subtle Branding Banner */}
      <div className="flex justify-between items-center select-none pt-1 px-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 bg-[#0095F6]/10 px-3 py-1 rounded-full border border-[#0095F6]/20">
          <Sparkles className="h-3.5 w-3.5 text-[#0095F6]" />
          Instagram Feed
        </span>
      </div>

      {/* STORIES TRAY */}
      <StoryBar 
        stories={stories}
        onStoryClick={(index) => setStoryStartIndex(index)}
        currentUser={user}
      />

      {/* TIMELINE FEED POSTS */}
      {loading ? (
        <div className="flex flex-col gap-6 mt-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-[#0A0A0A]/50 border border-white/5 rounded-[24px] p-6 flex flex-col gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/5 rounded w-1/4" />
                </div>
              </div>
              <div className="h-80 bg-white/5 rounded-[18px] w-full" />
              <div className="h-4 bg-white/5 rounded w-full" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 bg-[#0A0A0A]/60 border border-white/5 rounded-[24px] flex flex-col items-center justify-center p-6 gap-3 shadow-2xl backdrop-blur-md">
          <p className="text-slate-400 font-bold">Your feed is currently empty.</p>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Upload premium photos from the navigation bar or invite colleagues to start sharing the Raynista lifestyle!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {posts.map((post) => (
            <article 
              key={post.id} 
              id={`post-${post.id}`}
              className="bg-[#0A0A0A]/40 backdrop-blur-xl border border-white/5 rounded-[24px] overflow-hidden shadow-2xl hover:border-white/10 transition-all duration-300"
            >
              {/* Post Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3.5">
                  <div className="relative p-[1.5px] rounded-full bg-gradient-to-tr from-[#0095F6] via-[#00D2FF] to-[#0066FF]">
                    <img 
                      src={post.user.avatar_url} 
                      alt={post.user.username} 
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover border border-black bg-black" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-100 text-xs hover:text-[#0095F6] cursor-pointer transition-colors">
                        @{post.user.username}
                      </span>
                      {(post.user.is_verified || post.user.username.toLowerCase() === "rayanee" || post.user.username.toLowerCase() === "rayane") && (
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500 text-white shrink-0 shadow-xs" title="Verified Profile">
                          <Check className="h-2 w-2 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                      {formatTime(post.created_at)}
                    </span>
                  </div>
                </div>
                <button className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              {/* Post Media Wrapper */}
              <div 
                onClick={() => handleImageDoubleTap(post.id)}
                className="relative aspect-square w-full bg-black overflow-hidden cursor-pointer select-none"
              >
                <img 
                  src={post.media_url} 
                  alt="Post content" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover" 
                  loading="lazy"
                />

                {/* Heart Overlay Animation */}
                <AnimatePresence>
                  {doubleTapHearts[post.id] && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [0, 1.3, 0.95, 1.1, 1], opacity: [0, 1, 1, 0] }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none drop-shadow-[0_0_35px_rgba(255,48,64,0.6)]"
                    >
                      <Heart className="h-28 w-28 text-[#FF3040] fill-[#FF3040]" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Engagement Controls */}
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <button 
                      onClick={() => handleLike(post.id)}
                      title="Like"
                      className={`transition-all hover:scale-115 active:scale-90 p-1.5 rounded-full hover:bg-white/5 ${
                        post.is_liked ? "text-[#FF3040]" : "text-slate-300 hover:text-[#FF3040]"
                      }`}
                    >
                      <Heart className={`h-5.5 w-5.5 ${post.is_liked ? "fill-[#FF3040] text-[#FF3040]" : ""}`} />
                    </button>
                    
                    <button 
                      onClick={() => setActiveCommentsPostId(post.id)}
                      title="Comment"
                      className="text-slate-300 hover:text-[#0095F6] hover:scale-115 active:scale-95 transition-all p-1.5 rounded-full hover:bg-white/5"
                    >
                      <MessageCircle className="h-5.5 w-5.5" />
                    </button>

                    <button 
                      onClick={() => setSharePostId(post.id)}
                      title="Share"
                      className="text-slate-300 hover:text-[#0095F6] hover:scale-115 active:scale-95 transition-all p-1.5 rounded-full hover:bg-white/5"
                    >
                      <Send className="h-5 w-5 -rotate-12" />
                    </button>
                  </div>

                  <button 
                    onClick={() => handleBookmark(post.id)}
                    title="Save"
                    className={`transition-all hover:scale-115 active:scale-90 p-1.5 rounded-full hover:bg-white/5 ${
                      post.is_bookmarked ? "text-white" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    <Bookmark className={`h-5.5 w-5.5 ${post.is_bookmarked ? "fill-white text-white" : ""}`} />
                  </button>
                </div>

                {/* Likes Counter */}
                <span className="font-bold text-xs text-slate-200 tracking-wide">
                  {post.likes_count.toLocaleString()} {post.likes_count === 1 ? "like" : "likes"}
                </span>

                {/* Caption / Description Details */}
                <div className="text-xs leading-relaxed text-slate-300">
                  <span className="font-extrabold mr-2 text-white hover:text-[#0095F6] cursor-pointer">@{post.user.username}</span>
                  <span className="font-medium text-slate-300">{post.caption}</span>
                </div>

                {/* Comments Summary Preview */}
                {post.comments.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button 
                      onClick={() => setActiveCommentsPostId(post.id)}
                      className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hover:text-slate-300 text-left transition-colors"
                    >
                      View all comments ({post.comments.length})
                    </button>

                    {/* Show last 2 comments */}
                    <div className="flex flex-col gap-2">
                      {post.comments.slice(-2).map((comment) => (
                        <div key={comment.id} className="text-xs text-slate-400">
                          <span className="font-extrabold mr-2 text-slate-200">@{comment.user.username}</span>
                          <span className="font-medium">{comment.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Inline Add Comment Form */}
                <form 
                  onSubmit={(e) => handleAddComment(e, post.id)} 
                  className="flex items-center gap-3 border-t border-white/5 pt-3.5 mt-1"
                >
                  <Smile className="h-5 w-5 text-slate-500 cursor-pointer hover:text-white transition-colors" />
                  <input
                    type="text"
                    placeholder="Add an elite remark..."
                    value={activeCommentsPostId === post.id ? commentText : ""}
                    onChange={(e) => {
                      setActiveCommentsPostId(post.id);
                      setCommentText(e.target.value);
                    }}
                    className="flex-1 border-0 bg-transparent py-1 px-0 text-xs text-white placeholder-slate-600 focus:ring-0 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={activeCommentsPostId !== post.id || !commentText.trim()}
                    className="text-[#0095F6] hover:text-blue-400 disabled:text-slate-600 font-bold text-xs transition-colors px-1 cursor-pointer"
                  >
                    Post
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* FULL SCREEN STORY-VIEWER MODAL */}
      {storyStartIndex !== null && (
        <StoryViewer 
          stories={stories}
          startIndex={storyStartIndex}
          onClose={() => setStoryStartIndex(null)}
          triggerToast={triggerToast}
        />
      )}

      {/* EXPANDABLE COMMENTS PANEL */}
      <AnimatePresence>
        {activeCommentsPostId && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="bg-[#0D0D0D]/95 backdrop-blur-2xl rounded-t-[24px] md:rounded-[24px] max-w-lg w-full h-[80vh] md:h-[650px] shadow-2xl border border-white/10 flex flex-col justify-between overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4.5 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-extrabold text-sm text-white tracking-wider uppercase">Comments</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Dialogue thread</p>
                </div>
                <button 
                  onClick={() => {
                    setActiveCommentsPostId(null);
                    setCommentText("");
                  }}
                  className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Comments List Grid */}
              <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                {(() => {
                  const post = posts.find((p) => p.id === activeCommentsPostId);
                  if (!post) return null;

                  // Main post caption as the root item
                  return (
                    <>
                      <div className="flex gap-3.5 items-start pb-5 border-b border-white/5">
                        <img 
                          src={post.user.avatar_url} 
                          alt={post.user.username} 
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10" 
                        />
                        <div className="flex flex-col gap-1">
                          <div className="text-xs text-slate-200 leading-relaxed">
                            <span className="font-extrabold mr-1.5 text-white">@{post.user.username}</span>
                            <span className="font-medium">{post.caption}</span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{formatTime(post.created_at)}</span>
                        </div>
                      </div>

                      {post.comments.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 gap-3">
                          <MessageCircle className="h-10 w-10 text-slate-700 animate-pulse" />
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aesthetic Quietude</span>
                          <span className="text-[11px] text-slate-500 max-w-xs leading-relaxed">No dialogue has been established yet. Add your secure comment now!</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {post.comments.map((comment) => (
                            <div key={comment.id} className="flex gap-3.5 items-start animate-fade-in">
                              <img 
                                src={comment.user.avatar_url} 
                                alt={comment.user.username} 
                                className="w-8 h-8 rounded-full object-cover border border-white/5" 
                              />
                              <div className="flex flex-col gap-1">
                                <div className="text-xs text-slate-300 leading-relaxed">
                                  <span className="font-extrabold mr-1.5 text-white">@{comment.user.username}</span>
                                  <span className="font-medium">{comment.text}</span>
                                </div>
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{formatTime(comment.created_at)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Add comment Form Input */}
              <form 
                onSubmit={(e) => handleAddComment(e, activeCommentsPostId!)}
                className="p-5 border-t border-white/5 flex items-center gap-3 bg-black/60"
              >
                <input
                  type="text"
                  placeholder="Share your perspective..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-[#121212] border border-white/10 rounded-full px-5 py-3 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00]/25 transition-all"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="bg-[#FF7A00] hover:bg-orange-600 disabled:bg-[#121212] disabled:text-slate-600 text-white font-bold text-xs py-3 px-5 rounded-full transition-all duration-300 shrink-0 shadow-lg shadow-orange-500/10 cursor-pointer"
                >
                  {submittingComment ? "Posting..." : "Comment"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHARE SHEET MODAL */}
      <AnimatePresence>
        {sharePostId && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0D0D0D] rounded-t-[24px] md:rounded-[24px] max-w-sm w-full shadow-2xl overflow-hidden flex flex-col border border-white/10"
            >
              <div className="px-6 py-4.5 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-display font-extrabold text-xs text-white tracking-wider uppercase">Share</h3>
                <button 
                  onClick={() => setSharePostId(null)}
                  className="text-slate-500 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/post/${sharePostId}`);
                    triggerToast("Elite link archived to clipboard!", "success");
                    setSharePostId(null);
                  }}
                  className="flex flex-col items-center gap-3 group py-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 bg-[#FF7A00]/10 rounded-full flex items-center justify-center transition-colors border border-[#FF7A00]/20">
                    <Bookmark className="h-5 w-5 text-[#FF7A00]" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-white transition-colors">Copy Link</span>
                </button>
                
                <button 
                  onClick={() => {
                    triggerToast("Direct Lounge message dispatched", "success");
                    setSharePostId(null);
                  }}
                  className="flex flex-col items-center gap-3 group py-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 bg-[#FF7A00]/10 rounded-full flex items-center justify-center transition-colors border border-[#FF7A00]/20">
                    <MessageCircle className="h-5 w-5 text-[#FF7A00]" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-white transition-colors">Send via DM</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
