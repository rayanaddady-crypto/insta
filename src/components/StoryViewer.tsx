import React, { useState, useEffect } from "react";
import { X, Send, Heart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface StoryItem {
  username: string;
  avatar: string;
  media: string;
  caption?: string;
}

interface StoryViewerProps {
  stories: StoryItem[];
  startIndex: number;
  onClose: () => void;
  triggerToast: (msg: string, type: "success" | "error") => void;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  stories,
  startIndex,
  onClose,
  triggerToast
}) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [isLiked, setIsLiked] = useState(false);

  const activeStory = stories[currentIndex];

  // Auto-progress 5-second timer
  useEffect(() => {
    setProgress(0);
    setIsLiked(false);
    
    const startTime = Date.now();
    const duration = 5000; // 5 seconds
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const computedProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(computedProgress);

      if (computedProgress >= 100) {
        clearInterval(interval);
        handleNext();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [currentIndex]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    
    triggerToast(`Story reply sent to @${activeStory.username}!`, "success");
    setReplyText("");
    
    // Auto move next on reply or stay
    setTimeout(() => {
      handleNext();
    }, 400);
  };

  if (!activeStory) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-0 md:p-4 font-sans select-none animate-fade-in">
      {/* Outer Click dismiss wrapper */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative max-w-lg w-full h-full md:h-[90vh] md:max-h-[850px] bg-slate-950 md:rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xl border border-white/5 z-10">
        
        {/* --- TOP INTERACTIVE OVERLAY HUD --- */}
        <div className="absolute top-0 inset-x-0 p-4 z-20 bg-gradient-to-b from-black/80 to-transparent flex flex-col gap-3">
          
          {/* Automatic Progress Bars */}
          <div className="flex gap-1.5 w-full">
            {stories.map((_, idx) => {
              let fillWidth = "0%";
              if (idx < currentIndex) fillWidth = "100%";
              if (idx === currentIndex) fillWidth = `${progress}%`;

              return (
                <div key={idx} className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all ease-linear"
                    style={{ width: fillWidth }}
                  />
                </div>
              );
            })}
          </div>

          {/* Header Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={activeStory.avatar} 
                alt={activeStory.username} 
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border-2 border-pink-500 shadow-md" 
              />
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm leading-tight">@{activeStory.username}</span>
                <span className="text-[10px] text-white/60 font-medium">Stories</span>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="text-white hover:bg-white/10 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-5.5 w-5.5" />
            </button>
          </div>
        </div>

        {/* --- LEFT & RIGHT TAP ARROWS (TAPPING EAST/WEST TO TOGGLE) --- */}
        <div className="absolute inset-y-24 inset-x-0 flex justify-between z-10 pointer-events-none">
          <button 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="w-1/4 h-full text-left cursor-pointer pointer-events-auto opacity-0"
          >
            Prev Story
          </button>
          <button 
            onClick={handleNext} 
            className="w-1/4 h-full text-right cursor-pointer pointer-events-auto opacity-0"
          >
            Next Story
          </button>
        </div>

        {/* --- CENTRAL HERO STREAMING STAGE --- */}
        <div className="flex-1 flex items-center justify-center bg-black relative">
          <img 
            src={activeStory.media} 
            alt={`Story from ${activeStory.username}`} 
            referrerPolicy="no-referrer"
            className="max-h-full max-w-full object-contain pointer-events-none" 
          />

          {/* Double Tap Heart / Like overlay */}
          <AnimatePresence>
            {isLiked && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 0] }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 m-auto flex items-center justify-center pointer-events-none"
              >
                <Heart className="h-20 w-20 text-rose-500 fill-rose-500 drop-shadow-lg" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- BOTTOM INTERACTIVE HUD FOOTER --- */}
        <div className="p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent absolute bottom-0 inset-x-0 flex items-center gap-3 z-20">
          <form onSubmit={handleSendReply} className="flex-1 flex items-center gap-2.5">
            <input 
              type="text" 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to @${activeStory.username}...`}
              className="flex-1 bg-white/10 hover:bg-white/15 border border-white/15 focus:border-white/30 rounded-full py-2.5 px-4 text-xs text-white placeholder-white/50 focus:outline-hidden transition-all backdrop-blur-md"
            />
            
            <button 
              type="button"
              onClick={() => setIsLiked(!isLiked)}
              className={`p-2.5 rounded-full border transition-all ${
                isLiked 
                  ? "bg-rose-500 border-rose-500 text-white" 
                  : "bg-white/10 border-white/10 text-white hover:bg-white/25"
              }`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? "fill-white" : ""}`} />
            </button>

            <button 
              type="submit"
              disabled={!replyText.trim()}
              className="bg-white hover:bg-slate-100 text-slate-950 p-2.5 rounded-full transition-all disabled:opacity-50 disabled:hover:bg-white shrink-0 shadow-lg cursor-pointer"
            >
              <Send className="h-4 w-4 -rotate-12" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
