import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { ChatUser, Message } from "../types";
import { InstagramNotesBar } from "./InstagramNotesBar";
import { 
  Send, 
  Smile, 
  User, 
  CheckCheck, 
  MessageSquarePlus, 
  ArrowLeft,
  X,
  Sparkles,
  Search,
  Check,
  Play,
  Pause,
  Mic,
  Trash2,
  Volume2,
  Bell,
  Gamepad2,
  Users,
  MessageCircle,
  Reply,
  Pencil,
  Maximize2,
  Minimize2,
  Palette,
  CheckCircle2,
  CornerDownRight,
  Phone,
  PhoneOff,
  PhoneCall,
  Video,
  VideoOff,
  Info,
  VolumeX,
  Flame,
  ShieldAlert,
  Share2,
  ExternalLink,
  Camera,
  FlipHorizontal,
  Radio,
  Dices,
  Image,
  Tv,
  Heart,
  SlidersHorizontal,
  Paintbrush,
  Layers,
  RotateCcw,
  Zap,
  Crown,
  Eye,
  Skull,
  Upload,
  UploadCloud,
  Loader2,
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playSound } from "../utils/sound";

// Web Audio API synthesizer for realistic Instagram-style call audio chimes
function playCallTone(type: "ring" | "connect" | "hangup") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "ring") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === "connect") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === "hangup") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (err) {
    // Audio context may be restricted before user interaction
  }
}

// ====================================================================
// SUB-COMPONENT: CUSTOM PREMIUM VOICE MESSAGE PLAYER
// ====================================================================
const VoiceMessagePlayer: React.FC<{ 
  audioSrc: string; 
  isSelf: boolean;
  accentColor?: string;
}> = ({ audioSrc, isSelf, accentColor = "#FF7A00" }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  return (
    <div 
      className={`flex items-center gap-3 p-3.5 rounded-2xl min-w-[240px] max-w-sm select-none ${
        isSelf 
          ? "text-white shadow-md" 
          : "bg-[#181818] border border-white/10 text-slate-100"
      }`}
      style={isSelf ? { backgroundColor: accentColor } : {}}
    >
      <audio ref={audioRef} src={audioSrc} preload="metadata" className="hidden" />
      
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
          isSelf 
            ? "bg-white hover:scale-105 active:scale-95 shadow-sm" 
            : "text-white hover:opacity-90 active:scale-95 shadow-sm"
        }`}
        style={!isSelf ? { backgroundColor: accentColor } : { color: accentColor }}
      >
        {isPlaying ? (
          <Pause className="h-4.5 w-4.5 fill-current" />
        ) : (
          <Play className="h-4.5 w-4.5 fill-current translate-x-[1px]" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1 h-5">
          {/* Simulated Waveform bars */}
          {[...Array(14)].map((_, idx) => {
            const heights = [10, 16, 8, 14, 22, 16, 8, 20, 12, 22, 10, 16, 8, 12];
            const height = heights[idx % heights.length];
            const isPlayed = duration > 0 && (currentTime / duration) > (idx / 14);
            return (
              <div
                key={idx}
                style={{ height: `${height}px` }}
                className={`w-[2px] rounded-full transition-all duration-150 ${
                  isSelf
                    ? isPlayed ? "bg-white opacity-100" : "bg-white/40"
                    : isPlayed ? "bg-white opacity-100" : "bg-slate-700"
                }`}
              />
            );
          })}
        </div>

        {/* Scrub Bar & Times */}
        <div className="flex items-center justify-between gap-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleScrub}
            onClick={(e) => e.stopPropagation()}
            className={`w-full h-1 rounded-lg appearance-none cursor-pointer accent-current ${isSelf ? "bg-white/35" : "bg-white/10"}`}
          />
          <span className="text-[10px] font-bold tracking-wider opacity-90 select-none tabular-nums shrink-0">
            {formatTime(currentTime)} / {formatTime(duration || 0)}
          </span>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// CHAT THEME & 10 DISTINCT TIKTOK CHAT BUBBLE TYPES
// ====================================================================
export type BubbleStyleType =
  | "tiktok-pill"      // 1. Signature TikTok capsule
  | "tiktok-neon"      // 2. Energetic neon glow border
  | "cyber-hud"        // 3. Cyberpunk cut-corner tech
  | "bubble-glass"     // 4. Frosted glassmorphism sheen
  | "ios-classic"      // 5. iOS curved speech bubble
  | "comic-pop"        // 6. Manga bold 3D shadow outline
  | "velvet-cloud"     // 7. Soft organic cloud pillow
  | "minimal-sharp"    // 8. Clean modern 8px crisp
  | "retro-arcade"     // 9. Retro 8-bit arcade terminal
  | "gradient-aura"    // 10. Radiant luxury aura glow
  // Backward compatibility keys
  | "rounded-3xl"
  | "rounded-2xl"
  | "rounded-xl"
  | "rounded-full";

export const BUBBLE_STYLES_LIST: { id: BubbleStyleType; name: string; desc: string; iconTag: string; badge?: string }[] = [
  { id: "tiktok-pill", name: "TikTok Pill", desc: "Signature 24px capsule curve", iconTag: "💊", badge: "Default" },
  { id: "tiktok-neon", name: "Neon Glow", desc: "Luminous energetic neon outline", iconTag: "⚡", badge: "Glow" },
  { id: "cyber-hud", name: "Cyber HUD", desc: "Futuristic cut-corner matrix", iconTag: "🦾", badge: "Sci-Fi" },
  { id: "bubble-glass", name: "Frosted Glass", desc: "Translucent backdrop blur sheen", iconTag: "🧊", badge: "Glass" },
  { id: "ios-classic", name: "iOS Classic", desc: "Signature curved speech tail", iconTag: "💬" },
  { id: "comic-pop", name: "Comic Pop", desc: "Manga 3D shadow bold outline", iconTag: "💥", badge: "Bold" },
  { id: "velvet-cloud", name: "Velvet Cloud", desc: "Organic cloud rounded pillow", iconTag: "☁️" },
  { id: "minimal-sharp", name: "Minimal Crisp", desc: "Clean modern 8px corner", iconTag: "📐" },
  { id: "retro-arcade", name: "Retro 8-Bit", desc: "Nostalgic arcade terminal box", iconTag: "👾", badge: "Pixel" },
  { id: "gradient-aura", name: "Aura Luxury", desc: "Radiant ambient aura glow", iconTag: "✨", badge: "Aura" },
];

export const getBubbleClasses = (style: string, isSender: boolean, isAi: boolean = false) => {
  let normalized = style;
  if (style === "rounded-3xl" || style === "rounded-full") normalized = "tiktok-pill";
  if (style === "rounded-2xl") normalized = "ios-classic";
  if (style === "rounded-xl") normalized = "minimal-sharp";

  switch (normalized) {
    case "tiktok-neon":
      return isSender
        ? "rounded-2xl border-2 border-white/60 shadow-[0_0_18px_rgba(254,44,85,0.45)] text-white"
        : isAi
        ? "rounded-2xl border-2 border-cyan-400/50 bg-[#0d1424] text-white shadow-[0_0_15px_rgba(37,244,238,0.3)]"
        : "rounded-2xl border border-white/30 bg-[#18181F] text-slate-100 shadow-md";

    case "cyber-hud":
      return isSender
        ? "rounded-tr-2xl rounded-bl-2xl rounded-tl-xs rounded-br-xs border-r-2 border-t-2 border-white/60 text-white tracking-wide font-mono shadow-lg"
        : isAi
        ? "rounded-tl-2xl rounded-br-2xl rounded-tr-xs rounded-bl-xs border-l-2 border-b-2 border-cyan-400/60 bg-[#090e1a] text-cyan-100 tracking-wide font-mono"
        : "rounded-tl-2xl rounded-br-2xl rounded-tr-xs rounded-bl-xs border-l-2 border-b-2 border-white/25 bg-[#0d111a] text-slate-100 tracking-wide font-mono";

    case "bubble-glass":
      return isSender
        ? "backdrop-blur-xl bg-white/20 border border-white/40 rounded-3xl text-white shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
        : isAi
        ? "backdrop-blur-xl bg-[#141b2d]/80 border border-cyan-400/35 rounded-3xl text-white shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
        : "backdrop-blur-xl bg-[#1f1f26]/80 border border-white/20 rounded-3xl text-slate-100 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]";

    case "ios-classic":
      return isSender
        ? "rounded-[20px] rounded-br-[3px] text-white shadow-md"
        : isAi
        ? "rounded-[20px] rounded-bl-[3px] bg-[#141824] text-white border border-white/15 shadow-md"
        : "rounded-[20px] rounded-bl-[3px] bg-[#26262B] text-slate-100 border border-white/10 shadow-md";

    case "comic-pop":
      return isSender
        ? "rounded-2xl border-2 border-white shadow-[3px_3px_0px_0px_rgba(255,255,255,0.95)] text-white font-semibold"
        : isAi
        ? "rounded-2xl border-2 border-cyan-400 shadow-[3px_3px_0px_0px_rgba(37,244,238,0.7)] bg-[#0f172a] text-white font-semibold"
        : "rounded-2xl border-2 border-white/60 shadow-[3px_3px_0px_0px_rgba(255,255,255,0.4)] bg-[#1e2029] text-slate-100 font-semibold";

    case "velvet-cloud":
      return isSender
        ? "rounded-[28px] rounded-tl-[10px] rounded-br-[8px] text-white shadow-lg"
        : isAi
        ? "rounded-[28px] rounded-tr-[10px] rounded-bl-[8px] bg-[#171b29] text-white border border-white/15 shadow-lg"
        : "rounded-[28px] rounded-tr-[10px] rounded-bl-[8px] bg-[#1d1e26] text-slate-100 border border-white/10 shadow-lg";

    case "minimal-sharp":
      return isSender
        ? "rounded-lg text-white shadow-sm border border-white/15"
        : isAi
        ? "rounded-lg bg-[#111624] text-white border border-cyan-400/25 shadow-sm"
        : "rounded-lg bg-[#18181B] text-slate-100 border border-white/10 shadow-sm";

    case "retro-arcade":
      return isSender
        ? "rounded-none border-2 border-white text-white font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,0.9)]"
        : isAi
        ? "rounded-none border-2 border-cyan-400 bg-[#080d1a] text-cyan-200 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,0.9)]"
        : "rounded-none border-2 border-white/40 bg-[#121216] text-slate-100 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,0.9)]";

    case "gradient-aura":
      return isSender
        ? "rounded-[24px] rounded-br-[6px] text-white border border-white/30 shadow-[0_0_24px_rgba(254,44,85,0.4)]"
        : isAi
        ? "rounded-[24px] rounded-bl-[6px] bg-gradient-to-r from-cyan-950/90 to-blue-950/90 text-white border border-cyan-400/30 shadow-[0_0_18px_rgba(37,244,238,0.25)]"
        : "rounded-[24px] rounded-bl-[6px] bg-gradient-to-r from-zinc-900/95 to-slate-900/95 text-slate-100 border border-white/15 shadow-md";

    case "tiktok-pill":
    default:
      return isSender
        ? "rounded-[24px] rounded-br-[4px] text-white shadow-md"
        : isAi
        ? "rounded-[24px] rounded-bl-[4px] bg-[#141824] text-white border border-white/20 shadow-md"
        : "rounded-[24px] rounded-bl-[4px] bg-[#18181B] text-slate-100 border border-white/10";
  }
};

interface ChatThemeConfig {
  accentColor: string;
  accentName: string;
  accentGradient: string;
  bgTheme: "pitch" | "aurora" | "cyber" | "emerald" | "rose" | "midnight" | "slate" | "espresso" | "mesh" | "wallpaper";
  wallpaperUrl?: string;
  wallpaperDim: number; // 0 to 90
  wallpaperBlur: number; // 0 to 20
  bubbleStyle: BubbleStyleType;
  bubbleGradient: boolean;
  fontSize: "text-xs" | "text-sm" | "text-base";
  nickname?: string;
  doubleTapReaction: string;
}

const DEFAULT_THEME: ChatThemeConfig = {
  accentColor: "#FE2C55",
  accentName: "TikTok Crimson",
  accentGradient: "linear-gradient(135deg, #FE2C55 0%, #FF007A 100%)",
  bgTheme: "pitch",
  wallpaperUrl: "",
  wallpaperDim: 45,
  wallpaperBlur: 0,
  bubbleStyle: "tiktok-pill",
  bubbleGradient: true,
  fontSize: "text-sm",
  nickname: "",
  doubleTapReaction: "❤️"
};

const THEME_ACCENTS = [
  { name: "TikTok Red", color: "#FE2C55", gradient: "linear-gradient(135deg, #FE2C55 0%, #FF2A85 100%)" },
  { name: "Cyber Cyan", color: "#25F4EE", gradient: "linear-gradient(135deg, #25F4EE 0%, #00C8FF 100%)" },
  { name: "Solar Amber", color: "#FF7A00", gradient: "linear-gradient(135deg, #FF7A00 0%, #FF4500 100%)" },
  { name: "Emerald Luxe", color: "#10B981", gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)" },
  { name: "Cyber Violet", color: "#8B5CF6", gradient: "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)" },
  { name: "Bubble Pink", color: "#EC4899", gradient: "linear-gradient(135deg, #EC4899 0%, #DB2777 100%)" },
  { name: "Electric Blue", color: "#3B82F6", gradient: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)" },
  { name: "Sunset Gold", color: "#F59E0B", gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)" },
  { name: "Matrix Green", color: "#22C55E", gradient: "linear-gradient(135deg, #22C55E 0%, #15803D 100%)" },
  { name: "Platinum Frost", color: "#94A3B8", gradient: "linear-gradient(135deg, #94A3B8 0%, #64748B 100%)" }
];

const THEME_BACKGROUNDS = [
  { id: "pitch", name: "TikTok AMOLED", desc: "Pure deep #000 black", bgClass: "bg-black" },
  { id: "aurora", name: "Sunset Aurora", desc: "TikTok twilight ambient glow", bgClass: "bg-[#040206] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/25 via-purple-950/20 to-black" },
  { id: "cyber", name: "Cyber Neon", desc: "Cyan & violet cosmic space", bgClass: "bg-[#04050A] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-purple-950/20 to-[#040408]" },
  { id: "emerald", name: "Emerald Noir", desc: "Deep jade & luxury obsidian", bgClass: "bg-[#020704] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/25 via-slate-950 to-black" },
  { id: "rose", name: "Cherry Noir", desc: "Velvet crimson & rose tone", bgClass: "bg-[#090204] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-900/25 via-slate-950 to-black" },
  { id: "midnight", name: "Midnight Navy", desc: "Deep matte slate night", bgClass: "bg-[#070A12]" },
  { id: "espresso", name: "Espresso Roast", desc: "Warm rich cocoa vibe", bgClass: "bg-[#110D0A]" },
  { id: "mesh", name: "Matrix Grid", desc: "Minimal high-tech dot pattern", bgClass: "bg-[#090909] bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px]" },
  { id: "wallpaper", name: "Photo Wallpaper", desc: "Custom image & curated gallery", bgClass: "bg-black" }
];

const WALLPAPER_PRESETS = [
  { name: "Tokyo Neon Nights", url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1080&q=80" },
  { name: "Cosmic Aurora Galaxy", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1080&q=80" },
  { name: "Abstract Fluid 3D", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1080&q=80" },
  { name: "Deep Ocean Waves", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&q=80" },
  { name: "Moroccan Mosaic", url: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?auto=format&fit=crop&w=1080&q=80" },
  { name: "Cyber Rain City", url: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1080&q=80" }
];

interface MessagesProps {
  onSelectUserProfile?: (username: string) => void;
  onConversationActiveChange?: (active: boolean) => void;
}

export const Messages: React.FC<MessagesProps> = ({ onSelectUserProfile, onConversationActiveChange }) => {
  const { user, socket, fetchWithAuth, triggerToast, requestNotificationPermission } = useAuth();
  
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);

  const getThreadNickname = (contactId: number, username: string) => {
    if (!user) return null;
    try {
      const saved = localStorage.getItem(`raynista_chat_customization_${user.id}_${contactId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nickname && parsed.nickname.trim() !== "") {
          return parsed.nickname.trim();
        }
      }
    } catch (e) {}
    return null;
  };

  // Sync active chat state with parent layout
  useEffect(() => {
    if (onConversationActiveChange) {
      onConversationActiveChange(selectedUser !== null);
    }
  }, [selectedUser, onConversationActiveChange]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "info" | "game">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  // Replying & Editing States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editInputText, setEditInputText] = useState("");

  // Full-screen Mode State
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Watch Together States & Refs
  const [showWatchTogether, setShowWatchTogether] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState("5yx6yLUn698"); // Default cozy lofi beat
  const [inputVideoUrl, setInputVideoUrl] = useState("");
  const [watchActionLog, setWatchActionLog] = useState<string[]>([]);
  const [watchers, setWatchers] = useState<{ [userId: number]: { username: string; timestamp: number } }>({});

  const playerRef = useRef<any>(null);
  const isRemoteActionRef = useRef<boolean>(false);
  const lastTimeRef = useRef<number>(0);
  const playTimerRef = useRef<any>(null);

  // Watch Together Sync Emission Helper
  const emitWatchSync = (action: string, videoId: string = currentVideoId, time?: number) => {
    if (socket && socket.connected && conversationId && user) {
      socket.emit("watch:sync", {
        conversation_id: conversationId,
        video_id: videoId,
        action,
        time,
        sender_id: user.id,
        sender_username: user.username
      });
    }
  };

  // Watch Together Remote Playback Event Synchronizer
  useEffect(() => {
    if (!socket || !user || !conversationId) return;

    const handleWatchSync = (data: { conversation_id: number; video_id: string; action: string; time?: number; sender_id: number; sender_username: string }) => {
      if (data.conversation_id !== conversationId) return;
      if (data.sender_id === user.id) return; // Prevent echoing own actions

      if (data.action === "change") {
        isRemoteActionRef.current = true;
        setCurrentVideoId(data.video_id);
        setShowWatchTogether(true);
        if (playerRef.current && playerRef.current.loadVideoById) {
          try {
            playerRef.current.loadVideoById(data.video_id);
          } catch (e) {}
        }
        setWatchActionLog(prev => [
          `🎬 @${data.sender_username} changed video`,
          ...prev.slice(0, 9)
        ]);
        triggerToast(`🎬 Video changed by @${data.sender_username}`, "success");
      } else if (data.action === "sync_play") {
        isRemoteActionRef.current = true;
        if (playerRef.current) {
          try {
            if (data.time !== undefined && playerRef.current.seekTo) {
              playerRef.current.seekTo(data.time, true);
            }
            if (playerRef.current.playVideo) {
              playerRef.current.playVideo();
            }
          } catch (e) {}
        }
        setWatchActionLog(prev => [
          `▶️ @${data.sender_username} played/synced video`,
          ...prev.slice(0, 9)
        ]);
        triggerToast(`▶️ Play synced by @${data.sender_username}`, "info");
      } else if (data.action === "sync_pause") {
        isRemoteActionRef.current = true;
        if (playerRef.current) {
          try {
            if (data.time !== undefined && playerRef.current.seekTo) {
              playerRef.current.seekTo(data.time, true);
            }
            if (playerRef.current.pauseVideo) {
              playerRef.current.pauseVideo();
            }
          } catch (e) {}
        }
        setWatchActionLog(prev => [
          `⏸️ @${data.sender_username} paused video`,
          ...prev.slice(0, 9)
        ]);
        triggerToast(`⏸️ Pause synced by @${data.sender_username}`, "info");
      } else if (data.action === "seek") {
        isRemoteActionRef.current = true;
        if (playerRef.current && playerRef.current.seekTo && data.time !== undefined) {
          try {
            playerRef.current.seekTo(data.time, true);
          } catch (e) {}
        }
        setWatchActionLog(prev => [
          `⏩ @${data.sender_username} skipped to ${Math.floor(data.time || 0)}s`,
          ...prev.slice(0, 9)
        ]);
        triggerToast(`⏩ Skipped to time by @${data.sender_username}`, "info");
      }
    };

    socket.on("watch:sync_client", handleWatchSync);
    return () => {
      socket.off("watch:sync_client", handleWatchSync);
    };
  }, [socket, conversationId, user]);

  // Watch Status Handshake / "Who is watching" list tracking
  useEffect(() => {
    if (!socket || !user || !conversationId) return;

    const handleWatchStatus = (data: { conversation_id: number; user_id: number; username: string; is_watching: boolean }) => {
      if (data.conversation_id !== conversationId) return;

      setWatchers(prev => {
        const updated = { ...prev };
        if (data.is_watching) {
          updated[data.user_id] = { username: data.username, timestamp: Date.now() };
        } else {
          delete updated[data.user_id];
        }
        return updated;
      });

      // Decentralized Handshake: If someone else announced they are watching,
      // and we are also watching, announce ourselves back so they add us!
      if (data.is_watching && data.user_id !== user.id && showWatchTogether) {
        socket.emit("watch:status", {
          conversation_id: conversationId,
          user_id: user.id,
          username: user.username,
          is_watching: true
        });
      }
    };

    socket.on("watch:status_client", handleWatchStatus);
    return () => {
      socket.off("watch:status_client", handleWatchStatus);
    };
  }, [socket, conversationId, user, showWatchTogether]);

  // Announce active Watch Together state to partner on open/close/unmount
  useEffect(() => {
    if (!socket || !user || !conversationId) return;

    if (showWatchTogether) {
      socket.emit("watch:status", {
        conversation_id: conversationId,
        user_id: user.id,
        username: user.username,
        is_watching: true
      });
    } else {
      socket.emit("watch:status", {
        conversation_id: conversationId,
        user_id: user.id,
        username: user.username,
        is_watching: false
      });
      setWatchers({});
    }

    return () => {
      socket.emit("watch:status", {
        conversation_id: conversationId,
        user_id: user.id,
        username: user.username,
        is_watching: false
      });
    };
  }, [showWatchTogether, socket, conversationId, user]);

  // Initialize YouTube Iframe Player API & listen for automatic events
  useEffect(() => {
    if (!showWatchTogether) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
      return;
    }

    // Load YouTube API script if not present
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (playerRef.current) return;
      try {
        playerRef.current = new (window as any).YT.Player("watch-together-iframe", {
          events: {
            onStateChange: (event: any) => {
              const state = event.data;
              // If state change is triggered programmatically by receiving a sync action, skip emitting
              if (isRemoteActionRef.current) {
                isRemoteActionRef.current = false;
                return;
              }

              if (playerRef.current && playerRef.current.getCurrentTime) {
                const currTime = playerRef.current.getCurrentTime();
                if (state === (window as any).YT.PlayerState.PLAYING) {
                  emitWatchSync("sync_play", currentVideoId, currTime);
                } else if (state === (window as any).YT.PlayerState.PAUSED) {
                  emitWatchSync("sync_pause", currentVideoId, currTime);
                }
              }
            }
          }
        });
      } catch (e) {
        console.error("Failed to initialize YT Player:", e);
      }
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initPlayer();
    } else {
      const previousOnReady = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (previousOnReady) previousOnReady();
        initPlayer();
      };
    }

    // Poll time to detect manual seeking (forward or backward skipping)
    playTimerRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime && playerRef.current.getPlayerState) {
        try {
          const currTime = playerRef.current.getCurrentTime();
          if (Math.abs(currTime - lastTimeRef.current) > 2.5) {
            if (!isRemoteActionRef.current) {
              emitWatchSync("seek", currentVideoId, currTime);
            } else {
              isRemoteActionRef.current = false;
            }
          }
          lastTimeRef.current = currTime;
        } catch (e) {}
      }
    }, 1000);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch (e) {}
        playerRef.current = null;
      }
    };
  }, [showWatchTogether, currentVideoId]);

  const extractYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleLoadVideo = (urlOrId: string) => {
    if (!urlOrId.trim()) return;
    let videoId = extractYoutubeId(urlOrId);
    if (!videoId) {
      if (urlOrId.trim().length === 11) {
        videoId = urlOrId.trim();
      }
    }
    
    if (videoId) {
      setCurrentVideoId(videoId);
      emitWatchSync("change", videoId);
      setInputVideoUrl("");
      triggerToast("🎥 Loading shared video...", "success");
    } else {
      triggerToast("❌ Invalid YouTube URL or ID", "error");
    }
  };

  // Customization State
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [themeConfig, setThemeConfig] = useState<ChatThemeConfig>(DEFAULT_THEME);

  useEffect(() => {
    if (selectedUser && user) {
      try {
        const saved = localStorage.getItem(`raynista_chat_customization_${user.id}_${selectedUser.id}`);
        if (saved) {
          setThemeConfig({ ...DEFAULT_THEME, ...JSON.parse(saved) });
        } else {
          setThemeConfig(DEFAULT_THEME);
        }
      } catch (e) {
        setThemeConfig(DEFAULT_THEME);
      }
    } else {
      setThemeConfig(DEFAULT_THEME);
    }
  }, [selectedUser, user?.id]);

  const updateTheme = (updates: Partial<ChatThemeConfig>) => {
    if (!selectedUser || !user) return;
    setThemeConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(`raynista_chat_customization_${user.id}_${selectedUser.id}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Background Wallpaper File Upload State & Handler
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [isBgDragging, setIsBgDragging] = useState(false);

  const handleBgUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      triggerToast("Please select a valid image (PNG, JPG, WebP, GIF)", "error");
      return;
    }

    // 1. Instant zero-latency local preview via FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        updateTheme({ bgTheme: "wallpaper", wallpaperUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);

    // 2. Upload to server storage if authenticated
    setIsUploadingBg(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetchWithAuth("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (res && res.url) {
        updateTheme({ bgTheme: "wallpaper", wallpaperUrl: res.url });
      }
      playSound("click");
      triggerToast("Custom chat background uploaded & applied! ✨", "success");
    } catch (err) {
      console.warn("Background upload fallback to local data URL:", err);
      triggerToast("Custom wallpaper set! ✨", "success");
    } finally {
      setIsUploadingBg(false);
    }
  };

  // Double-tap reaction & Quick reaction states
  const lastTapRef = useRef<{ id: number; time: number } | null>(null);
  const [doubleTapPop, setDoubleTapPop] = useState<{ msgId: number; emoji: string } | null>(null);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<number | null>(null);

  const triggerMessageReaction = async (msgId: number, reactionEmoji: string | null) => {
    if (!user) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reaction: reactionEmoji || undefined } : m))
    );
    try {
      await fetchWithAuth(`/api/messages/${msgId}/react`, {
        method: "POST",
        body: JSON.stringify({ reaction: reactionEmoji }),
      });
    } catch (e) {
      console.error("Failed to react to message:", e);
    }
  };

  const handleMessageTap = (msg: Message) => {
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === msg.id && now - lastTapRef.current.time < 350) {
      const emojiToReact = themeConfig.doubleTapReaction || "❤️";
      const newReaction = msg.reaction === emojiToReact ? null : emojiToReact;
      triggerMessageReaction(msg.id, newReaction);
      if (newReaction) {
        setDoubleTapPop({ msgId: msg.id, emoji: emojiToReact });
        playSound("click");
        setTimeout(() => setDoubleTapPop(null), 850);
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { id: msg.id, time: now };
    }
  };

  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Instagram Voice Call State
  const [activeVoiceCall, setActiveVoiceCall] = useState<{
    isCalling: boolean;
    isConnected: boolean;
    duration: number;
    isMuted: boolean;
    isSpeaker: boolean;
  } | null>(null);

  // Instagram Video Call State
  const [activeVideoCall, setActiveVideoCall] = useState<{
    isCalling: boolean;
    isConnected: boolean;
    duration: number;
    isMuted: boolean;
    isVideoOff: boolean;
    isFlipped: boolean;
  } | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Call Handlers
  const startVoiceCall = () => {
    if (!selectedUser) return;
    setShowProfileModal(false);
    setActiveVoiceCall({
      isCalling: true,
      isConnected: false,
      duration: 0,
      isMuted: false,
      isSpeaker: false
    });
    playCallTone("ring");

    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    ringIntervalRef.current = setInterval(() => {
      playCallTone("ring");
    }, 2800);

    setTimeout(() => {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      playCallTone("connect");
      setActiveVoiceCall((prev) => prev ? { ...prev, isCalling: false, isConnected: true } : null);

      if (callDurationIntervalRef.current) clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = setInterval(() => {
        setActiveVoiceCall((prev) => prev ? { ...prev, duration: prev.duration + 1 } : null);
      }, 1000);
    }, 3200);
  };

  const endVoiceCall = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    playCallTone("hangup");
    setActiveVoiceCall(null);
    triggerToast("Voice Call Ended", "info");
  };

  // Video Call Handlers
  const startVideoCall = async () => {
    if (!selectedUser) return;
    setShowProfileModal(false);
    setActiveVideoCall({
      isCalling: true,
      isConnected: false,
      duration: 0,
      isMuted: false,
      isVideoOff: false,
      isFlipped: false
    });
    playCallTone("ring");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.error);
      }
    } catch (err) {
      console.log("Local camera stream access:", err);
    }

    if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
    ringIntervalRef.current = setInterval(() => {
      playCallTone("ring");
    }, 2800);

    setTimeout(() => {
      if (ringIntervalRef.current) {
        clearInterval(ringIntervalRef.current);
        ringIntervalRef.current = null;
      }
      playCallTone("connect");
      setActiveVideoCall((prev) => prev ? { ...prev, isCalling: false, isConnected: true } : null);

      if (callDurationIntervalRef.current) clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = setInterval(() => {
        setActiveVideoCall((prev) => prev ? { ...prev, duration: prev.duration + 1 } : null);
      }, 1000);
    }, 3200);
  };

  const endVideoCall = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      localVideoRef.current.srcObject = null;
    }
    playCallTone("hangup");
    setActiveVideoCall(null);
    triggerToast("Video Call Ended", "info");
  };

  const formatCallDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
  };

  // Quick Send Message Handler (For True or Dare and quick interaction buttons)
  const handleQuickSendMessage = async (text: string) => {
    if (!text.trim() || !selectedUser || !user) return;
    const textToSend = text.trim();
    const tempId = Date.now();
    const nowIso = new Date().toISOString();

    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: conversationId || undefined,
      sender_id: user.id,
      receiver_id: selectedUser.id,
      message_text: textToSend,
      is_read: false,
      reaction: null,
      created_at: nowIso,
      sender_username: user.username,
      sender_avatar: user.avatar_url,
      client_temp_id: tempId
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    // Update conversation item in sidebar instantly
    setChatUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              last_message: {
                id: tempId,
                text: textToSend,
                created_at: nowIso,
                is_sender: true,
                is_read: false
              }
            }
          : u
      )
    );

    const messagePayload = {
      sender_id: user.id,
      receiver_id: selectedUser.id,
      message_text: textToSend,
      client_temp_id: tempId
    };

    if (socket && socket.connected) {
      socket.emit("send_message", messagePayload);
    } else {
      try {
        const response = await fetchWithAuth("/api/messages", {
          method: "POST",
          body: JSON.stringify(messagePayload)
        });
        if (response?.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? response.message : m)));
        }
      } catch (err: any) {
        console.error("Failed to send quick message:", err);
      }
    }
  };

  // Trigger Truth or Dare game action
  const triggerTruthOrDare = (choice?: "truth" | "dare") => {
    if (!selectedUser || !user) return;
    if (choice === "truth") {
      handleQuickSendMessage("صراحة (saraha)");
      triggerToast("🔥 Chose Truth (الصراحة)!", "success");
    } else if (choice === "dare") {
      handleQuickSendMessage("تحدي (tahadi)");
      triggerToast("⚡ Chose Dare (التحدي)!", "success");
    } else {
      handleQuickSendMessage("🎲 True or Dare");
      triggerToast("🎲 Truth or Dare game started!", "success");
    }
  };

  // Real-time user search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up recording interval on unmount
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  // Keyboard shortcut listener (ESC to cancel edit/reply/fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCustomizeModal) {
          setShowCustomizeModal(false);
        } else if (editingMessage) {
          setEditingMessage(null);
          setEditInputText("");
        } else if (replyingTo) {
          setReplyingTo(null);
        } else if (isFullScreen) {
          setIsFullScreen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingMessage, replyingTo, isFullScreen, showCustomizeModal]);

  // Start voice message recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 100) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            await sendAudioMessage(base64data);
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      triggerToast("Microphone access denied or unavailable", "error");
    }
  };

  // Stop recording and send voice message
  const stopRecordingAndSend = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  };

  // Cancel/discard recording
  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.onstop = () => {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.stop();
      setIsRecording(false);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      triggerToast("Voice recording discarded", "success");
    }
  };

  const sendAudioMessage = async (base64Audio: string) => {
    if (!selectedUser || !user) return;

    const audioText = `[AUDIO_MESSAGE]:${base64Audio}`;
    const tempId = Date.now();
    const nowIso = new Date().toISOString();

    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: conversationId || undefined,
      sender_id: user.id,
      receiver_id: selectedUser.id,
      message_text: audioText,
      is_read: false,
      reaction: null,
      created_at: nowIso,
      sender_username: user.username,
      sender_avatar: user.avatar_url,
      client_temp_id: tempId
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    if (socket && socket.connected) {
      socket.emit("send_message", {
        sender_id: user.id,
        receiver_id: selectedUser.id,
        message_text: audioText,
        client_temp_id: tempId
      });
    } else {
      try {
        const response = await fetchWithAuth("/api/messages", {
          method: "POST",
          body: JSON.stringify({
            receiver_id: selectedUser.id,
            message_text: audioText,
            client_temp_id: tempId
          })
        });
        if (response?.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? response.message : m)));
        }
      } catch (err: any) {
        triggerToast("Failed to send voice message", "error");
      }
    }
  };

  // Debounced search query hook
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchWithAuth(`/api/users/search?q=${encodeURIComponent(searchQuery)}&chat_only=true`);
        setSearchResults(data.users || []);
      } catch (err: any) {
        console.error("Failed to search users:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSearchedUser = (selectedSearchUser: any) => {
    const existing = chatUsers.find((u) => u.id === selectedSearchUser.id);
    
    if (existing) {
      setSelectedUser(existing);
    } else {
      const tempUser: ChatUser = {
        id: selectedSearchUser.id,
        username: selectedSearchUser.username,
        avatar_url: selectedSearchUser.avatar_url,
        bio: selectedSearchUser.bio || "",
        is_online: selectedSearchUser.is_online === 1 || selectedSearchUser.is_online === true,
        is_mutual: true,
        unread_count: 0,
        last_message: null
      };
      setChatUsers((prev) => [tempUser, ...prev]);
      setSelectedUser(tempUser);
    }
    
    setSearchQuery("");
    setSearchResults([]);
  };

  // Load conversational contacts list
  const loadChatUsers = async (quiet = false) => {
    if (!quiet) setLoadingUsers(true);
    try {
      const data = await fetchWithAuth("/api/chat/users");
      if (Array.isArray(data.chatUsers)) {
        setChatUsers(data.chatUsers);
      }
    } catch (err: any) {
      if (err.message !== "Session expired. Please log in again.") {
        console.error("Failed to load chat users:", err);
      }
    } finally {
      if (!quiet) setLoadingUsers(false);
    }
  };

  // Load complete message logs between user & selected contact
  const loadChatHistory = async (receiverId: number) => {
    setLoadingChat(true);
    setReplyingTo(null);
    setEditingMessage(null);
    try {
      const data = await fetchWithAuth(`/api/messages?with=${receiverId}`);
      setMessages(data.messages || []);
      setConversationId(data.conversation_id || null);
      
      // Clear unread count for this user in chatUsers list immediately
      setChatUsers((prev) =>
        prev.map((u) => (u.id === receiverId ? { ...u, unread_count: 0 } : u))
      );

      if (socket && socket.connected && data.conversation_id) {
        socket.emit("game:get_active", { conversationId: data.conversation_id });
      }
      scrollToBottom();
    } catch (err: any) {
      if (err.message !== "Session expired. Please log in again.") {
        console.error("Failed to load chat logs:", err);
      }
    } finally {
      setLoadingChat(false);
    }
  };

  // Keep selectedUser synced with updated chatUsers list
  useEffect(() => {
    if (selectedUser && chatUsers.length > 0) {
      const updated = chatUsers.find((u) => u.id === selectedUser.id);
      if (updated) {
        if (updated.is_online !== selectedUser.is_online || updated.avatar_url !== selectedUser.avatar_url || updated.is_mutual !== selectedUser.is_mutual) {
          setSelectedUser(updated);
        }
      }
    }
  }, [chatUsers, selectedUser]);

  // Polling fallback to keep chat state updated without duplicate flicker
  useEffect(() => {
    loadChatUsers();

    const interval = setInterval(() => {
      loadChatUsers(true);
      if (selectedUser) {
        fetchWithAuth(`/api/messages?with=${selectedUser.id}`)
          .then((data) => {
            if (data?.messages && Array.isArray(data.messages)) {
              setMessages((prev) => {
                // Keep pending optimistic messages (temp id > 1000000000000 and not yet persisted)
                const pendingOptimistic = prev.filter(
                  (m) =>
                    m.id > 1000000000000 &&
                    !data.messages.some(
                      (sm: Message) =>
                        sm.id === m.id ||
                        (sm.sender_id === m.sender_id && sm.message_text === m.message_text)
                    )
                );

                const currentPersisted = prev.filter((m) => m.id <= 1000000000000);
                const hasDifferences =
                  currentPersisted.length !== data.messages.length ||
                  data.messages.some((sm: Message, idx: number) => {
                    const cm = currentPersisted[idx];
                    return (
                      !cm ||
                      cm.id !== sm.id ||
                      cm.message_text !== sm.message_text ||
                      cm.is_edited !== sm.is_edited ||
                      cm.is_read !== sm.is_read
                    );
                  });

                if (hasDifferences) {
                  return [...data.messages, ...pendingOptimistic];
                }
                return prev;
              });
            }
            if (data?.conversation_id && !conversationId) {
              setConversationId(data.conversation_id);
            }
          })
          .catch(console.error);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [selectedUser, conversationId]);

  useEffect(() => {
    setConversationId(null);
    if (selectedUser) {
      loadChatHistory(selectedUser.id);
    } else {
      setMessages([]);
    }
  }, [selectedUser]);

  // Handle incoming live messages, edits, deletes, and read receipts via Socket.io
  useEffect(() => {
    if (!socket || !user) return;

    const handleReceiveMessage = (msg: Message) => {
      const isFromActive = selectedUser && (
        (msg.sender_id === selectedUser.id && msg.receiver_id === user.id) ||
        (msg.sender_id === user.id && msg.receiver_id === selectedUser.id)
      );

      if (isFromActive) {
        setMessages((prev) => {
          // 1. If message already exists by real ID, update it
          const existingById = prev.findIndex((m) => m.id === msg.id);
          if (existingById !== -1) {
            const updated = [...prev];
            updated[existingById] = { ...updated[existingById], ...msg };
            return updated;
          }

          // 2. If it's my message, reconcile with optimistic temporary message
          if (msg.sender_id === user.id) {
            const optIdx = prev.findIndex(
              (m) =>
                (msg.client_temp_id && (m.id === msg.client_temp_id || m.client_temp_id === msg.client_temp_id)) ||
                (m.id > 1000000000000 && m.sender_id === user.id && m.message_text === msg.message_text)
            );
            if (optIdx !== -1) {
              const updated = [...prev];
              updated[optIdx] = msg;
              return updated;
            }
          }

          return [...prev, msg];
        });
        scrollToBottom();
      }

      // Update sidebar state immediately
      setChatUsers((prev) => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        const exists = prev.find((u) => u.id === otherId);
        const isCurrentOpen = selectedUser && selectedUser.id === otherId;
        const isMe = msg.sender_id === user.id;

        if (exists) {
          return prev.map((u) => {
            if (u.id === otherId) {
              return {
                ...u,
                unread_count: isCurrentOpen || isMe ? 0 : (u.unread_count || 0) + 1,
                last_message: {
                  id: msg.id,
                  text: msg.message_text,
                  created_at: msg.created_at,
                  is_sender: isMe,
                  is_read: Boolean(isCurrentOpen || Number(msg.is_read || 0) === 1)
                }
              };
            }
            return u;
          }).sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
            if (!a.last_message) return 1;
            if (!b.last_message) return -1;
            return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
          });
        } else {
          loadChatUsers(true);
          return prev;
        }
      });
    };

    const handleMessageEdited = (data: { message_id: number; new_text: string; is_edited: number }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id ? { ...m, message_text: data.new_text, is_edited: 1 } : m
        )
      );
      setChatUsers((prev) =>
        prev.map((u) => {
          if (u.last_message?.id === data.message_id) {
            return {
              ...u,
              last_message: { ...u.last_message, text: data.new_text }
            };
          }
          return u;
        })
      );
    };

    const handleMessageDeleted = (data: { message_id: number }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
      setChatUsers((prev) =>
        prev.map((u) => {
          if (u.last_message?.id === data.message_id) {
            return {
              ...u,
              last_message: { ...u.last_message, text: "Message removed" }
            };
          }
          return u;
        })
      );
    };

    const handleMessagesRead = (data: { conversation_id: number; reader_id: number }) => {
      if (selectedUser && selectedUser.id === data.reader_id) {
        setMessages((prev) =>
          prev.map((m) => (m.sender_id === user.id ? { ...m, is_read: true } : m))
        );
      }
    };

    const handleStatusChanged = (data: { userId: number; isOnline: boolean }) => {
      setChatUsers((prev) =>
        prev.map((u) => (u.id === data.userId ? { ...u, is_online: data.isOnline } : u))
      );
      if (selectedUser && selectedUser.id === data.userId) {
        setSelectedUser((prev) => (prev ? { ...prev, is_online: data.isOnline } : null));
      }
    };

    const handleReactionUpdated = (data: { id: number; reaction: string | null }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.id ? { ...m, reaction: data.reaction || undefined } : m))
      );
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("messages_read", handleMessagesRead);
    socket.on("user_status_changed", handleStatusChanged);
    socket.on("message_reaction_updated", handleReactionUpdated);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("messages_read", handleMessagesRead);
      socket.off("user_status_changed", handleStatusChanged);
      socket.off("message_reaction_updated", handleReactionUpdated);
    };
  }, [socket, selectedUser, user, conversationId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const renderMessageTextWithMentions = (text: string, isCurrentUserSender: boolean) => {
    if (!text) return "";
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span 
            key={index} 
            className={`font-black px-1.5 py-0.5 rounded-md shadow-xs mx-0.5 inline-block ${
              isCurrentUserSender 
                ? "bg-white/20 text-white border border-white/30" 
                : "bg-[#0095F6]/15 text-[#0095F6] border border-[#0095F6]/30 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
            }`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // INSTANT OPTIMISTIC MESSAGE SEND
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !selectedUser || !user) return;

    const currentReply = replyingTo;
    setInputText("");
    setReplyingTo(null);

    const tempId = Date.now();
    const nowIso = new Date().toISOString();

    const optimisticMsg: Message = {
      id: tempId,
      conversation_id: conversationId || undefined,
      sender_id: user.id,
      receiver_id: selectedUser.id,
      message_text: textToSend,
      is_read: false,
      reaction: null,
      created_at: nowIso,
      sender_username: user.username,
      sender_avatar: user.avatar_url,
      reply_to_id: currentReply?.id || null,
      reply_to_text: currentReply?.message_text || null,
      reply_to_username: currentReply?.sender_username || (currentReply?.sender_id === user.id ? user.username : selectedUser.username),
      client_temp_id: tempId
    };

    // Instant local state push (Zero lag!)
    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    // Update conversation item in sidebar instantly
    setChatUsers((prev) =>
      prev.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              last_message: {
                id: tempId,
                text: textToSend,
                created_at: nowIso,
                is_sender: true,
                is_read: false
              }
            }
          : u
      ).sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.id === selectedUser.id) return -1;
        if (b.id === selectedUser.id) return 1;
        return 0;
      })
    );

    const messagePayload = {
      sender_id: user.id,
      receiver_id: selectedUser.id,
      message_text: textToSend,
      reply_to_id: currentReply?.id || null,
      reply_to_text: currentReply?.message_text || null,
      reply_to_username: currentReply?.sender_username || (currentReply?.sender_id === user.id ? user.username : selectedUser.username),
      client_temp_id: tempId
    };

    if (socket && socket.connected) {
      socket.emit("send_message", messagePayload);
    } else {
      try {
        const response = await fetchWithAuth("/api/messages", {
          method: "POST",
          body: JSON.stringify(messagePayload)
        });
        if (response?.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? response.message : m)));
        }
      } catch (err: any) {
        triggerToast("Failed to transmit message", "error");
      }
    }
  };

  // EDIT MESSAGE HANDLERS
  const handleStartEdit = (msg: Message) => {
    setReplyingTo(null);
    setEditingMessage(msg);
    setEditInputText(msg.message_text);
    setTimeout(() => {
      const editInput = document.getElementById("edit-message-input");
      editInput?.focus();
    }, 50);
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingMessage || !editInputText.trim() || !user) return;
    const newText = editInputText.trim();
    const msgId = editingMessage.id;

    // Optimistically update message text
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, message_text: newText, is_edited: 1 } : m))
    );
    setEditingMessage(null);
    setEditInputText("");

    if (socket && socket.connected) {
      socket.emit("edit_message", { message_id: msgId, user_id: user.id, new_text: newText });
    }

    try {
      await fetchWithAuth(`/api/messages/${msgId}`, {
        method: "PUT",
        body: JSON.stringify({ message_text: newText })
      });
      triggerToast("Message updated", "success");
    } catch (err) {
      console.error("Failed to edit message:", err);
      triggerToast("Failed to update message", "error");
    }
  };

  // DELETE MESSAGE HANDLER
  const handleDeleteMessage = async (msgId: number) => {
    if (!user) return;
    
    // Optimistically remove from state
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    if (editingMessage?.id === msgId) {
      setEditingMessage(null);
      setEditInputText("");
    }
    if (replyingTo?.id === msgId) {
      setReplyingTo(null);
    }

    if (socket && socket.connected) {
      socket.emit("delete_message", { message_id: msgId, user_id: user.id });
    }

    try {
      await fetchWithAuth(`/api/messages/${msgId}`, { method: "DELETE" });
      triggerToast("Message deleted", "success");
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  // Scroll to quoted message
  const handleScrollToMessage = (targetMsgId: number) => {
    const el = document.getElementById(`msg-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-orange-400", "duration-500");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-orange-400");
      }, 1800);
    }
  };

  // Format timestamp for chats (e.g., 3:33 am)
  const formatMessageTime = (isoString: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    let hrs = d.getHours();
    const mins = d.getMinutes().toString().padStart(2, "0");
    const ampm = hrs >= 12 ? "pm" : "am";
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12;
    return `${hrs}:${mins} ${ampm}`;
  };

  // Mutual friends list (users who follow each other or active contacts)
  const mutualFriends = chatUsers.filter((u) => u.is_mutual || u.username === "raynai" || !u.last_message);

  // Background Theme Styles (TikTok Mobile Atmosphere)
  const getBgThemeClass = () => {
    switch (themeConfig.bgTheme) {
      case "aurora":
        return "bg-[#040206] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/25 via-purple-950/20 to-black";
      case "cyber":
        return "bg-[#04050A] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-purple-950/20 to-[#040408]";
      case "emerald":
        return "bg-[#020704] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/25 via-slate-950 to-black";
      case "rose":
        return "bg-[#090204] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-900/25 via-slate-950 to-black";
      case "midnight":
        return "bg-[#070A12]";
      case "mesh":
        return "bg-[#090909] bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px]";
      case "slate":
        return "bg-[#0A0E1A]";
      case "espresso":
        return "bg-[#110D0A]";
      case "wallpaper":
        return "bg-black";
      case "pitch":
      default:
        return "bg-[#000000]";
    }
  };

  return (
    <div 
      className={`flex h-[100dvh] max-h-[100dvh] w-full bg-[#050505] text-white select-none overflow-hidden font-sans ${
        isFullScreen ? "fixed inset-0 z-50 h-screen w-screen" : ""
      }`}
    >
      
      {/* ====================================================================
          SIDEBAR: EXPANDED CHAT THREADS & MUTUAL FRIENDS
          ==================================================================== */}
      <div className={`w-full md:w-80 lg:w-[380px] border-r border-white/5 flex flex-col bg-[#0A0A0A]/95 backdrop-blur-2xl shrink-0 ${
        selectedUser ? "hidden md:flex" : "flex"
      } h-full`}>
        
        {/* Sidebar Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {user?.avatar_url && (
              <div className="relative">
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border-2 shadow-md shrink-0"
                  style={{ borderColor: themeConfig.accentColor }}
                  title="Your Profile Picture"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0A0A0A] rounded-full" />
              </div>
            )}
            <div>
              <span 
                className="text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1.5"
                style={{ color: themeConfig.accentColor }}
              >
                <MessageCircle className="h-3 w-3" />
                Direct Messages
              </span>
              <h2 className="font-display font-black text-base text-white mt-0.5 uppercase tracking-tight">Chats</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={() => setShowCustomizeModal(true)}
              title="Customize Chat Theme & Accents"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Palette className="h-4.5 w-4.5" style={{ color: themeConfig.accentColor }} />
            </button>

            <button 
              type="button"
              onClick={() => {
                const searchInput = document.getElementById("dm-search-input");
                searchInput?.focus();
              }}
              title="Start new conversation"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              style={{ color: themeConfig.accentColor }}
            >
              <MessageSquarePlus className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Dynamic User Search Input */}
        <div className="px-4 py-3 border-b border-white/5 shrink-0 relative group">
          <div className="relative">
            <input
              id="dm-search-input"
              type="text"
              placeholder="Search or start new chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141414] border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-xs focus:outline-hidden transition-all text-white placeholder-slate-500 font-semibold"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            {isSearching && (
              <span 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider animate-pulse"
                style={{ color: themeConfig.accentColor }}
              >
                Syncing
              </span>
            )}
          </div>

          {/* Search Dropdown Panel */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-14 left-4 right-4 bg-[#111111] border border-white/15 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-white/5"
              >
                {searchResults.map((su) => {
                  return (
                    <div
                      key={su.id}
                      onClick={() => handleSelectSearchedUser(su)}
                      className="flex items-center gap-3 p-3.5 hover:bg-white/5 cursor-pointer transition-all"
                    >
                      <img
                        src={su.avatar_url}
                        alt={su.username}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">@{su.username}</span>
                          {su.is_online ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          ) : null}
                        </div>
                        <span className="text-[10px] text-slate-400 truncate max-w-[190px] font-medium">{su.bio || "Member on Raynista"}</span>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {searchQuery.trim() !== "" && searchResults.length === 0 && !isSearching && (
            <div className="absolute top-14 left-4 right-4 bg-[#111111] border border-white/10 rounded-2xl p-4 text-center text-xs text-slate-400 font-semibold uppercase tracking-wider z-50">
              No profiles found
            </div>
          )}
        </div>

        {/* INSTAGRAM NOTES (THOUGHT BUBBLES CAROUSEL) */}
        <div className="border-b border-white/5 bg-black/40">
          <InstagramNotesBar 
            onSelectUserForChat={(target) => {
              setSelectedUser(target as any);
            }} 
            accentColor={themeConfig.accentColor} 
          />
        </div>

        {/* MUTUAL FRIENDS QUICK CONNECT HORIZONTAL RAIL */}
        {mutualFriends.length > 0 && (
          <div className="px-4 py-3 border-b border-white/5 shrink-0 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="h-3 w-3" style={{ color: themeConfig.accentColor }} />
                Friends & Mutual
              </span>
              <span 
                className="text-[9px] font-extrabold uppercase"
                style={{ color: themeConfig.accentColor }}
              >
                Tap to chat
              </span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
              {mutualFriends.map((f) => {
                const isSelected = selectedUser?.id === f.id;
                return (
                  <button
                    key={`mutual-${f.id}`}
                    type="button"
                    onClick={() => setSelectedUser(f)}
                    className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
                  >
                    <div 
                      className={`relative p-0.5 rounded-full transition-all duration-200 ${
                        isSelected ? "scale-105 ring-2 ring-blue-500" : "ring-1 ring-white/15 hover:ring-white/40 group-hover:scale-105"
                      }`}
                    >
                      <img
                        src={f.avatar_url}
                        alt={f.username}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-full object-cover"
                      />
                      {f.is_online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#0A0A0A] rounded-full" />
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[56px] text-center">
                      @{f.username}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Contacts Inbox List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1 scrollbar-none">
          {loadingUsers ? (
            <div className="flex flex-col gap-2.5 p-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-white/5 shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-3.5 bg-white/5 rounded w-1/3" />
                    <div className="h-3 bg-white/5 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : chatUsers.length === 0 ? (
            <div className="text-center py-20 text-slate-500 flex flex-col items-center p-6 gap-3 select-none">
              <Volume2 className="h-8 w-8 text-slate-700" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">No Conversations Yet</span>
              <span className="text-[11px] text-slate-500 max-w-xs leading-relaxed">Follow creators or search profiles above to begin messaging.</span>
            </div>
          ) : (
            chatUsers.map((item) => {
              const isSelected = selectedUser?.id === item.id;
              const hasUnread = Boolean(item.unread_count && item.unread_count > 0);

              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedUser(item)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all duration-200 text-left group relative cursor-pointer ${
                    isSelected 
                      ? "bg-white/10 border border-white/20 shadow-lg" 
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Avatar & Online status */}
                    <div className="relative shrink-0">
                      <img
                        src={item.avatar_url}
                        alt={item.username}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border-2 transition-transform"
                        style={{ borderColor: isSelected ? themeConfig.accentColor : "rgba(255,255,255,0.1)" }}
                      />
                      {item.is_online ? (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0A0A0A] rounded-full" />
                      ) : (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-600 border-2 border-[#0A0A0A] rounded-full" />
                      )}
                    </div>

                    {/* Username & Last Message Snippet */}
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span 
                          className={`font-bold text-xs md:text-sm truncate ${
                            hasUnread ? "text-white font-extrabold" : "text-slate-200 group-hover:text-white"
                          }`}
                          style={isSelected ? { color: themeConfig.accentColor } : {}}
                        >
                          {getThreadNickname(item.id, item.username) ? (
                            <span className="flex items-center gap-1">
                              <span className="text-slate-100">{getThreadNickname(item.id, item.username)}</span>
                              <span className="text-slate-500 text-[10px] font-normal">@{item.username}</span>
                            </span>
                          ) : (
                            `@${item.username}`
                          )}
                        </span>

                        {item.is_mutual && (
                          <span 
                            className="text-[8px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider shrink-0 bg-white/5 border border-white/10"
                            style={{ color: themeConfig.accentColor }}
                          >
                            Mutual
                          </span>
                        )}

                        {(item.username.toLowerCase() === "rayane" || item.username.toLowerCase() === "rayan" || item.username.toLowerCase() === "rayanee") && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shrink-0 shadow-sm" title="Verified Creator">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        )}

                        {item.username === "raynai" && (
                          <span className="text-[8px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-md uppercase tracking-wider shrink-0">
                            AI Bot
                          </span>
                        )}
                      </div>

                      <p className={`text-[11px] truncate font-medium ${
                        hasUnread ? "text-slate-100 font-bold" : "text-slate-400 group-hover:text-slate-300"
                      }`}>
                        {item.last_message ? (
                          <span className="flex items-center gap-1">
                            {item.last_message.is_sender && (
                              <span className="text-slate-500 shrink-0">
                                {item.last_message.is_read ? (
                                  <CheckCheck className="h-3 w-3 inline text-emerald-400" />
                                ) : (
                                  <Check className="h-3 w-3 inline text-slate-500" />
                                )}
                              </span>
                            )}
                            {item.last_message.text.startsWith("[AUDIO_MESSAGE]:") ? "🎤 Voice message" : item.last_message.text}
                          </span>
                        ) : (
                          <span className="italic text-slate-500 text-[10px]">Tap to start conversation</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* UNREAD CIRCLE BADGE & TIME */}
                  <div className="flex flex-col items-end justify-center shrink-0 ml-2.5 py-0.5 gap-1.5 self-center">
                    {item.last_message?.created_at ? (
                      <span className={`text-[11px] font-semibold tracking-tight select-none ${
                        hasUnread ? "text-[#22c55e] font-bold" : "text-slate-500 text-[10px]"
                      }`}>
                        {formatMessageTime(item.last_message.created_at)}
                      </span>
                    ) : null}

                    {hasUnread ? (
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-5 h-5 min-w-[20px] rounded-full bg-[#22c55e] text-slate-950 font-black text-[11px] flex items-center justify-center shadow-md shadow-emerald-500/40 select-none tabular-nums"
                      >
                        {item.unread_count! > 99 ? "99+" : item.unread_count}
                      </motion.div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ====================================================================
          ACTIVE CHAT CANVAS WORKSPACE (FULLSCREEN & CUSTOMIZABLE)
          ==================================================================== */}
      <div className={`flex-1 flex flex-col h-full ${!selectedUser ? "hidden md:flex items-center justify-center bg-[#070707]" : "flex"} overflow-hidden relative ${getBgThemeClass()}`}>
        {/* Custom Photo Wallpaper Layer */}
        {selectedUser && themeConfig.bgTheme === "wallpaper" && themeConfig.wallpaperUrl && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <img
              src={themeConfig.wallpaperUrl}
              alt="Chat Wallpaper"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none transition-all duration-300"
              style={{
                filter: (themeConfig.wallpaperBlur ?? 0) > 0 ? `blur(${themeConfig.wallpaperBlur}px)` : undefined,
                transform: (themeConfig.wallpaperBlur ?? 0) > 0 ? 'scale(1.08)' : undefined
              }}
            />
            <div 
              className="absolute inset-0 bg-black transition-opacity duration-300" 
              style={{ opacity: (themeConfig.wallpaperDim ?? 45) / 100 }}
            />
          </div>
        )}

        {selectedUser ? (
          <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden relative z-1">
            
            {/* Thread Header (Instagram DM Style with Profile info, Calling & True or Dare shortcut) */}
            <div className="px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 border-b border-white/5 bg-[#0D0D0D]/95 backdrop-blur-md flex items-center justify-between shrink-0 select-none z-30 sticky top-0 shadow-md">
              {/* Clickable Profile Info Header */}
              <div 
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-3 cursor-pointer group hover:opacity-90 transition-all p-1 -ml-1 rounded-2xl hover:bg-white/5"
                title="View Profile & Details"
              >
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedUser(null);
                  }}
                  className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 cursor-pointer shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                <div className="relative shrink-0">
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                    <img
                      src={selectedUser.avatar_url}
                      alt={selectedUser.username}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#0D0D0D]"
                    />
                  </div>
                  {selectedUser.is_online ? (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0D0D0D] rounded-full ring-1 ring-emerald-400/50" />
                  ) : null}
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 truncate flex-wrap">
                    <span className="font-extrabold text-sm md:text-base text-white group-hover:underline truncate">
                      {themeConfig.nickname && themeConfig.nickname.trim() !== "" ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-white font-black">{themeConfig.nickname}</span>
                          <span className="text-slate-400 text-xs font-normal">@{selectedUser.username}</span>
                        </span>
                      ) : (
                        `@${selectedUser.username}`
                      )}
                    </span>
                    {selectedUser.is_mutual && (
                      <span 
                        className="text-[8px] font-extrabold px-1.5 py-0.2 rounded-md bg-white/5 border border-white/10 shrink-0"
                        style={{ color: themeConfig.accentColor }}
                      >
                        Mutual
                      </span>
                    )}
                    {(selectedUser.username.toLowerCase() === "rayane" || selectedUser.username.toLowerCase() === "rayan" || selectedUser.username.toLowerCase() === "rayanee") && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shrink-0 shadow-sm" title="Verified Creator">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedUser.is_online ? (
                      <span className="text-[10px] text-emerald-400 font-bold tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                        Active now
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold tracking-tight">
                        Tap for profile info
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Header Right Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* THEME CUSTOMIZER */}
                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(true)}
                  title="Customize Chat Theme"
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                >
                  <Palette className="h-4 w-4" style={{ color: themeConfig.accentColor }} />
                </button>

                {/* FULLSCREEN DM TOGGLE */}
                <button
                  type="button"
                  onClick={() => setIsFullScreen((prev) => !prev)}
                  title={isFullScreen ? "Exit Full Screen" : "Expand to Full Screen"}
                  className={`hidden sm:flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
                    isFullScreen 
                      ? "bg-white text-slate-950 font-bold" 
                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white"
                  }`}
                >
                  {isFullScreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Watch Together Shared Player Panel */}
            <AnimatePresence>
              {showWatchTogether && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="bg-slate-900/95 border-b border-white/10 overflow-hidden flex flex-col shrink-0"
                >
                  <div className="p-4 flex flex-col md:flex-row gap-4 items-stretch max-w-7xl mx-auto w-full">
                    {/* YouTube Video Embed Frame */}
                    <div className="flex-1 bg-black rounded-2xl overflow-hidden aspect-video relative border border-white/5 shadow-2xl">
                      <iframe
                        id="watch-together-iframe"
                        src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&enablejsapi=1&rel=0`}
                        title="Watch Together Video Player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0 absolute top-0 left-0"
                      />
                    </div>

                    {/* Shared Panel Sidebar Controls */}
                    <div className="w-full md:w-80 flex flex-col justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                      {/* Top bar control & URL Input */}
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 animate-pulse">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                            Watch Together Live
                          </h4>
                          <button
                            type="button"
                            onClick={() => setShowWatchTogether(false)}
                            className="p-1 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Paste URL Form */}
                        <div className="flex gap-1.5 mt-1">
                          <input
                            type="text"
                            placeholder="Paste YouTube Link or ID..."
                            value={inputVideoUrl}
                            onChange={(e) => setInputVideoUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleLoadVideo(inputVideoUrl);
                              }
                            }}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/20"
                          />
                          <button
                            type="button"
                            onClick={() => handleLoadVideo(inputVideoUrl)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold px-3 py-2 rounded-xl text-xs transition-colors"
                          >
                            Go
                          </button>
                        </div>
                      </div>

                      {/* Presets Grid */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Popular Shared Anthems 🇲🇦🎵
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { name: "Moroccan Lofi ☕", id: "5yx6yLUn698" },
                            { name: "Babylone - Zina 🎸", id: "3p-38F7-94o" },
                            { name: "Saad Lamjarred 🎤", id: "_g-R0-ZAnjY" },
                            { name: "Zouhair Bahaoui 🚗", id: "u1_p0-3vK4g" }
                          ].map((vid) => (
                            <button
                              key={vid.id}
                              type="button"
                              onClick={() => {
                                setCurrentVideoId(vid.id);
                                emitWatchSync("change", vid.id);
                                triggerToast(`🎬 Playing: ${vid.name}`, "success");
                              }}
                              className={`text-[10px] font-extrabold text-left px-2.5 py-2 rounded-xl border transition-all ${
                                currentVideoId === vid.id
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                              }`}
                            >
                              {vid.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Active Watchers list - Who is watching */}
                      <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
                        {Object.keys(watchers).length > 0 ? (
                          <div className="flex flex-col gap-1.5 bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              Actively Watching ({Object.keys(watchers).length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {Object.values(watchers).map((watcher: any, i) => (
                                <span key={i} className="text-[10px] bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-md font-bold">
                                  @{watcher.username}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 bg-black/10 p-2.5 rounded-xl border border-dashed border-white/5 text-center">
                            Waiting for others to join...
                          </div>
                        )}
                      </div>

                      {/* Sync Controls Info Badge */}
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="text-[9px] text-slate-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-2.5 leading-relaxed">
                          <span className="font-extrabold text-emerald-400 block mb-0.5">⚡ Auto Sync Connected</span>
                          Playback triggers like <span className="text-white font-bold">Play</span>, <span className="text-white font-bold">Pause</span>, and <span className="text-white font-bold">Seek (forward/backward)</span> are now synchronized automatically.
                        </div>
                        {watchActionLog.length > 0 && (
                          <div className="text-[9px] text-slate-500 bg-black/25 rounded-lg p-1.5 font-mono max-h-12 overflow-y-auto mt-0.5 scrollbar-none">
                            {watchActionLog[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scrolling Bubble Message Log */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 flex flex-col gap-4 scrollbar-none">
              {/* Instagram Style Profile Header Card at top of thread */}
              <div className="flex flex-col items-center justify-center text-center py-6 px-4 mb-2 border-b border-white/5 bg-white/[0.02] rounded-3xl gap-2">
                <div 
                  onClick={() => setShowProfileModal(true)}
                  className="relative p-1 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 cursor-pointer hover:scale-105 transition-all shadow-xl"
                  title="View full profile"
                >
                  <img
                    src={selectedUser.avatar_url}
                    alt={selectedUser.username}
                    referrerPolicy="no-referrer"
                    className="w-18 h-18 rounded-full object-cover border-4 border-[#0D0D0D]"
                  />
                  {selectedUser.is_online && (
                    <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-black rounded-full ring-1 ring-emerald-400" />
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <h3 className="text-base font-extrabold text-white">
                      {themeConfig.nickname && themeConfig.nickname.trim() !== "" ? (
                        <span className="flex flex-col items-center">
                          <span className="text-white font-black">{themeConfig.nickname}</span>
                          <span className="text-slate-400 text-xs font-normal">@{selectedUser.username}</span>
                        </span>
                      ) : (
                        `@${selectedUser.username}`
                      )}
                    </h3>
                    {selectedUser.is_mutual && (
                      <span 
                        className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-white/5 border border-white/10 shrink-0"
                        style={{ color: themeConfig.accentColor }}
                      >
                        Mutual
                      </span>
                    )}
                    {(selectedUser.username.toLowerCase() === "rayane" || selectedUser.username.toLowerCase() === "rayan" || selectedUser.username.toLowerCase() === "rayanee") && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shrink-0 shadow-sm" title="Verified Creator">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-xs line-clamp-2">
                    {selectedUser.bio || "Raynista Community Member"}
                  </p>
                </div>

                {/* Profile Link Button */}
                <div className="flex items-center gap-2 mt-1 select-none">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(true)}
                    className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    View Profile
                  </button>
                </div>
              </div>

              {loadingChat ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse py-10">
                  Loading chat...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2 select-none my-auto opacity-70">
                  <p className="text-xs text-slate-400 font-medium">No messages yet</p>
                  <p className="text-[11px] text-slate-500">Send a message to start chatting</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isCurrentUserSender = msg.sender_id === user?.id;
                  const isAudioMessage = msg.message_text.startsWith("[AUDIO_MESSAGE]:");
                  const audioSrc = isAudioMessage ? msg.message_text.substring("[AUDIO_MESSAGE]:".length) : "";

                  const isSystemMessage = msg.sender_id === -1;
                  if (isSystemMessage) {
                    const isGameInvitation = msg.message_text.startsWith("[GAME_INVITATION]:");
                    if (isGameInvitation) {
                      const parts = msg.message_text.split(":");
                      const gameType = parts[1];
                      const convId = parseInt(parts[2]);
                      const creatorName = parts[3];
                      const isCreatorMe = creatorName === user?.username;

                      return (
                        <div
                          key={msg.id || i}
                          id={`msg-${msg.id}`}
                          className="w-full flex justify-center my-4 animate-in zoom-in-95 duration-250"
                        >
                          <div className="bg-[#111111] border border-white/15 rounded-2xl p-5 max-w-sm w-full flex flex-col items-center gap-3.5 shadow-2xl">
                            <div 
                              className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
                              style={{ backgroundColor: themeConfig.accentColor }}
                            >
                              <Gamepad2 className="h-6 w-6 animate-pulse" />
                            </div>
                            <div className="text-center">
                              <span 
                                className="text-[9px] font-extrabold uppercase tracking-widest bg-white/5 border border-white/10 px-2.5 py-1 rounded-full"
                                style={{ color: themeConfig.accentColor }}
                              >
                                Game Challenge
                              </span>
                              <h4 className="font-display font-extrabold text-sm text-slate-200 uppercase mt-2.5 tracking-tight">
                                {gameType === "tictactoe" ? "Tic-Tac-Toe Arena" :
                                 gameType === "connect4" ? "Connect Four Showdown" : "Chess Grand Prix"}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-bold mt-1">
                                Issued by @{creatorName}
                              </p>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                if (socket && socket.connected) {
                                  socket.emit("game:join", {
                                    conversationId: convId,
                                    player: {
                                      id: user.id,
                                      username: user.username,
                                      avatarUrl: user.avatar_url
                                    }
                                  });
                                  setMobileTab("game");
                                }
                              }}
                              className="w-full text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                              style={{ backgroundColor: themeConfig.accentColor }}
                            >
                              {isCreatorMe ? "Open Game Lobby" : "Accept & Play!"}
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id || i} id={`msg-${msg.id}`} className="w-full flex justify-center my-2 animate-in fade-in duration-200">
                        <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 shadow-sm text-center">
                          <Sparkles className="h-3 w-3" style={{ color: themeConfig.accentColor }} />
                          <span>{msg.message_text}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <motion.div
                      key={msg.id || i}
                      id={`msg-${msg.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex w-full items-end gap-2.5 group relative ${
                        isCurrentUserSender ? "justify-end" : "justify-start"
                      }`}
                    >
                      {/* Receiver Avatar */}
                      {!isCurrentUserSender && (
                        msg.sender_username === "raynai" ? (
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg mb-2 shrink-0 border border-white/20 animate-pulse" 
                            style={{ backgroundColor: themeConfig.accentColor }}
                            title="Raynai AI"
                          >
                            <Sparkles className="h-4 w-4 text-white fill-white/10" />
                          </div>
                        ) : (
                          <img
                            src={selectedUser.avatar_url}
                            alt={selectedUser.username}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover border border-white/10 mb-2 shrink-0"
                          />
                        )
                      )}

                      {/* Message Content Container */}
                      <div className="max-w-[82%] md:max-w-[68%] flex flex-col gap-1 relative">
                        {!isCurrentUserSender && msg.sender_username === "raynai" && (
                          <div className="flex items-center gap-1.5 mb-0.5 select-none">
                            <span 
                              className="text-[9px] font-black tracking-widest uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1"
                              style={{ color: themeConfig.accentColor }}
                            >
                              Raynai AI Bot 🤖
                            </span>
                          </div>
                        )}

                        {/* QUOTED REPLY PREVIEW BANNER (If message is a reply) */}
                        {msg.reply_to_text && (
                          <div 
                            onClick={() => msg.reply_to_id && handleScrollToMessage(msg.reply_to_id)}
                            className="px-3.5 py-2 rounded-xl bg-black/40 border-l-4 border-white/30 text-xs text-slate-300 flex flex-col gap-0.5 cursor-pointer hover:bg-black/60 transition-all select-none mb-0.5"
                            style={{ borderLeftColor: themeConfig.accentColor }}
                          >
                            <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: themeConfig.accentColor }}>
                              <CornerDownRight className="h-3 w-3" />
                              <span>@{msg.reply_to_username || "User"}</span>
                            </div>
                            <span className="truncate text-slate-400 text-[11px] font-medium">
                              {msg.reply_to_text.startsWith("[AUDIO_MESSAGE]:") ? "🎤 Voice message" : msg.reply_to_text}
                            </span>
                          </div>
                        )}

                        {/* Double Tap Reaction Pop Particle Animation */}
                        <AnimatePresence>
                          {doubleTapPop && doubleTapPop.msgId === msg.id && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0, y: 0 }}
                              animate={{ scale: [0, 1.5, 1.2], opacity: 1, y: -28 }}
                              exit={{ scale: 0.4, opacity: 0, y: -45 }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none select-none text-4xl drop-shadow-[0_0_25px_rgba(255,255,255,0.9)]"
                            >
                              <span>{doubleTapPop.emoji}</span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Message Bubble Body with Double-Tap Trigger */}
                        <div
                          onClick={() => handleMessageTap(msg)}
                          className="relative select-text cursor-pointer touch-manipulation"
                          title="Double tap to react"
                        >
                          {isAudioMessage ? (
                            <VoiceMessagePlayer 
                              audioSrc={audioSrc} 
                              isSelf={isCurrentUserSender} 
                              accentColor={themeConfig.accentColor}
                            />
                          ) : (
                            <div
                              className={`px-4.5 py-2.5 md:px-5 md:py-3 ${themeConfig.fontSize} leading-relaxed font-medium transition-all ${getBubbleClasses(
                                themeConfig.bubbleStyle,
                                isCurrentUserSender,
                                msg.sender_username === "raynai"
                              )}`}
                              style={
                                isCurrentUserSender
                                  ? themeConfig.bubbleGradient
                                    ? { background: themeConfig.accentGradient || themeConfig.accentColor, boxShadow: `0 4px 16px ${themeConfig.accentColor}40` }
                                    : { backgroundColor: themeConfig.accentColor }
                                  : {}
                              }
                            >
                              <p className="break-words whitespace-pre-wrap select-text">{renderMessageTextWithMentions(msg.message_text, isCurrentUserSender)}</p>
                            </div>
                          )}

                          {/* Floating Reaction Badge */}
                          {msg.reaction && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerMessageReaction(msg.id, null);
                              }}
                              title="Tap to remove reaction"
                              className={`absolute -bottom-2.5 ${
                                isCurrentUserSender ? "right-2" : "left-2"
                              } bg-[#18181B]/95 border border-white/20 rounded-full px-2 py-0.5 text-xs shadow-xl flex items-center gap-1 active:scale-90 transition-transform cursor-pointer z-10`}
                            >
                              <span className="text-xs leading-none">{msg.reaction}</span>
                            </button>
                          )}
                        </div>

                        {/* Timestamp, Edited Badge & Read Receipt */}
                        <div className={`flex items-center gap-1.5 px-1 select-none text-[10px] text-slate-500 font-semibold tracking-wide mt-0.5 ${
                          isCurrentUserSender ? "justify-end" : "justify-start"
                        }`}>
                          <span>{formatMessageTime(msg.created_at)}</span>
                          
                          {Number(msg.is_edited || 0) === 1 && (
                            <span className="text-[9px] text-slate-400 italic font-medium">(edited)</span>
                          )}

                          {isCurrentUserSender && (
                            <span className="flex items-center gap-0.5 text-[9px] font-bold">
                              {Boolean(msg.is_read) ? (
                                <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-slate-500" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* QUICK ACTION BAR (HOVER OR TAP REACTION MENU) */}
                      {!isAudioMessage && (
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#1A1A1E] border border-white/10 rounded-full px-1.5 py-0.5 shadow-lg shrink-0 ${
                          isCurrentUserSender ? "order-first" : ""
                        }`}>
                          {/* Quick Emoji Reaction Pill */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveReactionPickerMsgId(activeReactionPickerMsgId === msg.id ? null : msg.id)}
                              title="React with Emoji"
                              className="p-1 text-slate-400 hover:text-amber-400 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                            >
                              <Smile className="h-3.5 w-3.5" />
                            </button>

                            {/* Popup Emoji Palette */}
                            {activeReactionPickerMsgId === msg.id && (
                              <div className={`absolute bottom-full mb-1.5 ${isCurrentUserSender ? 'right-0' : 'left-0'} bg-[#1F1F23] border border-white/20 rounded-full px-2 py-1 flex items-center gap-1 shadow-2xl z-30 animate-in zoom-in-95`}>
                                {["❤️", "🔥", "⚡", "😂", "😍", "👍", "💀"].map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      triggerMessageReaction(msg.id, msg.reaction === emoji ? null : emoji);
                                      setActiveReactionPickerMsgId(null);
                                      playSound("click");
                                    }}
                                    className="p-1 hover:scale-125 transition-transform text-sm cursor-pointer"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Reply Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessage(null);
                              setReplyingTo(msg);
                              inputRef.current?.focus();
                            }}
                            title="Reply to message"
                            className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Button (For sender's own text messages) */}
                          {isCurrentUserSender && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(msg)}
                              title="Edit message"
                              className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Delete Button (For own messages or conversation participants) */}
                          {isCurrentUserSender && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              title="Delete message"
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Sender Avatar */}
                      {isCurrentUserSender && (
                        <img
                          src={user?.avatar_url}
                          alt={user?.username}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border mb-2 shrink-0"
                          style={{ borderColor: `${themeConfig.accentColor}50` }}
                        />
                      )}
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* EXPANDED & SPACIOUS MESSAGE INPUT BAR */}
            <div className="px-4 md:px-8 py-3.5 border-t border-white/5 bg-[#0D0D0D]/95 backdrop-blur-2xl shrink-0 flex flex-col gap-2">
              
              {/* REPLYING-TO BANNER */}
              <AnimatePresence>
                {replyingTo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between bg-[#151515] border-l-4 rounded-xl px-4 py-2 text-xs select-none shadow-md overflow-hidden"
                    style={{ borderLeftColor: themeConfig.accentColor }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Reply className="h-4 w-4 shrink-0" style={{ color: themeConfig.accentColor }} />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-[11px]">
                          Replying to @{replyingTo.sender_username || (replyingTo.sender_id === user?.id ? user?.username : selectedUser.username)}
                        </span>
                        <span className="truncate text-slate-400 text-[11px] max-w-md">
                          {replyingTo.message_text.startsWith("[AUDIO_MESSAGE]:") ? "🎤 Voice message" : replyingTo.message_text}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      title="Cancel Reply"
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* EDITING-MESSAGE BANNER & INPUT FORM */}
              <AnimatePresence>
                {editingMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex flex-col gap-2 bg-[#161616] border border-white/15 rounded-2xl p-3 shadow-xl"
                  >
                    <div className="flex items-center justify-between text-xs px-1">
                      <div className="flex items-center gap-1.5 font-bold" style={{ color: themeConfig.accentColor }}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Editing Message</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Press ESC to cancel • Enter to save</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="edit-message-input"
                        type="text"
                        value={editInputText}
                        onChange={(e) => setEditInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit();
                          }
                        }}
                        className="flex-1 bg-[#0D0D0D] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessage(null);
                          setEditInputText("");
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveEdit()}
                        className="px-4 py-2 rounded-xl text-white text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-md"
                        style={{ backgroundColor: themeConfig.accentColor }}
                      >
                        Save
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* STANDARD MESSAGE INPUT BAR (HIDDEN WHEN EDITING) */}
              {!editingMessage && (
                isRecording ? (
                  <div className="flex items-center justify-between gap-4 bg-[#141414] border border-red-500/40 rounded-2xl px-5 py-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      <span className="text-[11px] font-black text-red-500 tracking-wider uppercase">Recording Voice</span>
                      <span className="text-sm font-mono text-slate-200 font-bold tabular-nums">
                        {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
                      </span>
                    </div>

                    {/* Waveform indicator */}
                    <div className="flex-1 max-w-[140px] flex items-center justify-center gap-1">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-[2.5px] bg-red-500 rounded-full"
                          style={{
                            height: `${8 + Math.sin((recordingDuration * 2) + i) * 12}px`,
                            transition: "height 0.2s ease-in-out"
                          }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        title="Discard Recording"
                        className="p-3 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all active:scale-90 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={stopRecordingAndSend}
                        title="Send Voice Message"
                        className="p-3 rounded-xl text-white shadow-lg transition-all active:scale-90 cursor-pointer"
                        style={{ backgroundColor: themeConfig.accentColor }}
                      >
                        <Send className="h-4 w-4 -rotate-12" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <form
                      onSubmit={handleSendMessage}
                      className="flex items-center gap-3 w-full"
                    >
                      {/* Left: Blue Instagram Camera Icon */}
                      <button
                        type="button"
                        onClick={() => {
                          playSound("click");
                          triggerToast("Instagram Camera activated! Take a premium photo snap.", "success");
                        }}
                        className="w-10 h-10 rounded-full bg-[#0095F6] text-white flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        title="Camera Snap"
                      >
                        <Camera className="h-5 w-5 fill-current" />
                      </button>

                      {/* Pill Container */}
                      <div className="flex-1 flex items-center bg-[#1C1C1E] rounded-full border border-white/5 focus-within:border-white/15 px-3 py-1.5 transition-all">
                        {/* Smile button inside pill */}
                        <button 
                          type="button" 
                          onClick={() => setInputText((prev) => prev + " 😊 ")}
                          title="Insert emoji"
                          className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                        >
                          <Smile className="h-5.5 w-5.5" />
                        </button>

                        <input
                          ref={inputRef}
                          type="text"
                          placeholder="Message..."
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onFocus={() => {
                            setTimeout(() => {
                              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                            }, 250);
                          }}
                          className="flex-1 bg-transparent border-none px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-hidden font-medium"
                        />

                        {/* Action Icons when input is empty */}
                        {!inputText.trim() ? (
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Microphone / Record Voice Button */}
                            <button
                              type="button"
                              onClick={startRecording}
                              title="Record Voice Note"
                              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all active:scale-90 cursor-pointer"
                            >
                              <Mic className="h-5.5 w-5.5" />
                            </button>

                            {/* Gallery / Image Button */}
                            <button
                              type="button"
                              onClick={() => {
                                playSound("click");
                                triggerToast("Select media to send from your premium gallery", "info");
                              }}
                              title="Send Image"
                              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all active:scale-90 cursor-pointer"
                            >
                              <Image className="h-5.5 w-5.5" />
                            </button>

                            {/* Game / Dice Shortcut (Instagram sticker representation) */}
                            <button
                              type="button"
                              onClick={() => triggerTruthOrDare()}
                              title="Play Truth or Dare"
                              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all active:scale-90 cursor-pointer"
                            >
                              <Dices className="h-5.5 w-5.5 text-purple-400" />
                            </button>
                          </div>
                        ) : (
                          /* Send Button - Styled like Instagram colored link text */
                          <button
                            type="submit"
                            className="text-[#0095F6] font-extrabold text-sm hover:text-blue-400 transition-colors cursor-pointer px-2.5 py-1.5 shrink-0"
                          >
                            Send
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none my-auto">
            <div 
              className="p-6 rounded-3xl bg-white/5 border border-white/10 mb-5 animate-bounce"
              style={{ color: themeConfig.accentColor }}
            >
              <MessageCircle className="h-10 w-10" />
            </div>
            <h3 className="font-display font-black text-white text-lg uppercase tracking-wider">Your Direct Messages</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed font-medium">
              Choose a conversation from the sidebar or tap any friend in the mutual contacts rail to begin chatting in real-time.
            </p>
          </div>
        )}
      </div>

      {/* ====================================================================
          MODAL 1: INSTAGRAM PROFILE DETAILS & ACTIONS MODAL
          ==================================================================== */}
      <AnimatePresence>
        {showProfileModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#111111] border border-white/15 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center gap-5 text-center relative"
            >
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Instagram Story Gradient Avatar */}
              <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-xl mt-2">
                <img
                  src={selectedUser.avatar_url}
                  alt={selectedUser.username}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#111111]"
                />
                {selectedUser.is_online ? (
                  <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-3 border-[#111111] rounded-full" />
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-black text-lg text-white">@{selectedUser.username}</h3>
                  {selectedUser.is_mutual && (
                    <span 
                      className="text-[9px] font-black px-2 py-0.5 rounded-md bg-white/5 border border-white/10"
                      style={{ color: themeConfig.accentColor }}
                    >
                      Mutual
                    </span>
                  )}
                </div>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  {selectedUser.is_online ? "Active Now" : "Offline"}
                </span>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-xs">
                  {selectedUser.bio || "Raynista Member • Connected via Direct Messages"}
                </p>
              </div>

              {/* Instagram Action Grid (Voice Call, Video Call, True or Dare, Theme) */}
              <div className="grid grid-cols-3 gap-2.5 w-full pt-2 border-t border-white/10">
                {/* Voice Call */}
                <button
                  type="button"
                  onClick={startVoiceCall}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/20 border border-white/5 hover:border-emerald-500/40 text-slate-200 hover:text-emerald-400 transition-all cursor-pointer active:scale-95 group"
                >
                  <Phone className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold">Voice Call</span>
                </button>

                {/* Video Call */}
                <button
                  type="button"
                  onClick={startVideoCall}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-blue-500/20 border border-white/5 hover:border-blue-500/40 text-slate-200 hover:text-blue-400 transition-all cursor-pointer active:scale-95 group"
                >
                  <Video className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold">Video Call</span>
                </button>

                {/* True or Dare */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    triggerTruthOrDare();
                  }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/5 hover:bg-purple-500/20 border border-white/5 hover:border-purple-500/40 text-slate-200 hover:text-purple-400 transition-all cursor-pointer active:scale-95 group"
                >
                  <Sparkles className="h-5 w-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold">True or Dare</span>
                </button>
              </div>

              {/* Secondary Options */}
              <div className="flex flex-col w-full gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    onSelectUserProfile?.(selectedUser.username);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#FF7A00]/15 hover:bg-[#FF7A00]/25 text-[#FF7A00] border border-[#FF7A00]/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#FF7A00]" />
                    View Full Profile (@{selectedUser.username})
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#FF7A00]" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    setShowCustomizeModal(true);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Palette className="h-4 w-4" style={{ color: themeConfig.accentColor }} />
                    Customize Chat Theme
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileModal(false);
                    triggerToast(`Notifications for @${selectedUser.username} updated`, "info");
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-400" />
                    Mute Notifications
                  </span>
                  <Check className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL 2: INSTAGRAM VOICE CALL FULLSCREEN OVERLAY
          ==================================================================== */}
      <AnimatePresence>
        {activeVoiceCall && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-between h-full max-h-[640px] max-w-sm w-full p-8 text-center select-none"
            >
              {/* Header */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  Instagram Voice Call
                </span>
                <span className="text-xs text-slate-500 font-medium">End-to-end encrypted</span>
              </div>

              {/* Center User Pulsing Visualizer */}
              <div className="flex flex-col items-center gap-4 my-auto">
                <div className="relative">
                  {/* Pulsing Ripple Rings */}
                  <span className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
                  <span className="absolute -inset-8 rounded-full bg-purple-500/10 animate-pulse" />
                  
                  <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-2xl">
                    <img
                      src={selectedUser.avatar_url}
                      alt={selectedUser.username}
                      referrerPolicy="no-referrer"
                      className="w-32 h-32 rounded-full object-cover border-4 border-[#0D0D0D]"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <h2 className="text-2xl font-black text-white">@{selectedUser.username}</h2>
                  <p className="text-sm font-mono text-emerald-400 font-bold tabular-nums">
                    {activeVoiceCall.isCalling ? "Calling..." : formatCallDuration(activeVoiceCall.duration)}
                  </p>
                </div>
              </div>

              {/* Call Controls Bar */}
              <div className="flex items-center justify-center gap-6 w-full pt-6">
                {/* Mute Mic */}
                <button
                  type="button"
                  onClick={() => setActiveVoiceCall((prev) => prev ? { ...prev, isMuted: !prev.isMuted } : null)}
                  className={`p-4 rounded-full transition-all cursor-pointer active:scale-95 ${
                    activeVoiceCall.isMuted 
                      ? "bg-red-500/20 text-red-400 border border-red-500/40" 
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  title={activeVoiceCall.isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  <Mic className="h-6 w-6" />
                </button>

                {/* End Call Button */}
                <button
                  type="button"
                  onClick={endVoiceCall}
                  className="p-5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/40 transition-all cursor-pointer active:scale-90 hover:scale-105"
                  title="End Call"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>

                {/* Speakerphone */}
                <button
                  type="button"
                  onClick={() => setActiveVoiceCall((prev) => prev ? { ...prev, isSpeaker: !prev.isSpeaker } : null)}
                  className={`p-4 rounded-full transition-all cursor-pointer active:scale-95 ${
                    activeVoiceCall.isSpeaker 
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" 
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  title="Speakerphone"
                >
                  <Volume2 className="h-6 w-6" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL 3: INSTAGRAM VIDEO CALL FULLSCREEN OVERLAY
          ==================================================================== */}
      <AnimatePresence>
        {activeVideoCall && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full max-w-4xl max-h-[100dvh] flex flex-col justify-between p-4 md:p-6 overflow-hidden select-none"
            >
              {/* Remote Video Stream View (Simulated Full Cam Screen) */}
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-linear-to-b from-slate-900 via-[#0a0a0a] to-slate-950 overflow-hidden">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-2xl">
                    <img
                      src={selectedUser.avatar_url}
                      alt={selectedUser.username}
                      referrerPolicy="no-referrer"
                      className="w-32 h-32 md:w-44 md:h-44 rounded-full object-cover border-4 border-[#0D0D0D] animate-pulse"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <h3 className="text-xl md:text-2xl font-black text-white">@{selectedUser.username}</h3>
                    <span className="text-xs text-emerald-400 font-mono font-bold">
                      {activeVideoCall.isCalling ? "Calling Video..." : `Live • ${formatCallDuration(activeVideoCall.duration)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top Header Bar */}
              <div className="relative z-10 flex items-center justify-between bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Video Call with @{selectedUser.username}
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold tabular-nums">
                  {formatCallDuration(activeVideoCall.duration)}
                </span>
              </div>

              {/* Local Video Picture-in-Picture Feed */}
              <div className="relative z-10 self-end mr-2 mb-2">
                <div className="w-32 h-44 md:w-40 md:h-56 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-slate-900 relative">
                  {!activeVideoCall.isVideoOff ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${activeVideoCall.isFlipped ? "scale-x-[-1]" : ""}`}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 text-xs font-bold gap-2">
                      <VideoOff className="h-6 w-6" />
                      <span>Camera Off</span>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 text-[9px] font-black bg-black/60 px-2 py-0.5 rounded-md text-white backdrop-blur-xs">
                    You
                  </span>
                </div>
              </div>

              {/* Video Call Bottom Controls Bar */}
              <div className="relative z-10 flex items-center justify-center gap-5 bg-black/60 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/15 max-w-md mx-auto w-full">
                {/* Flip Camera */}
                <button
                  type="button"
                  onClick={() => setActiveVideoCall((prev) => prev ? { ...prev, isFlipped: !prev.isFlipped } : null)}
                  className="p-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                  title="Flip Camera View"
                >
                  <FlipHorizontal className="h-5 w-5" />
                </button>

                {/* Mute Mic */}
                <button
                  type="button"
                  onClick={() => setActiveVideoCall((prev) => prev ? { ...prev, isMuted: !prev.isMuted } : null)}
                  className={`p-3.5 rounded-full transition-all cursor-pointer active:scale-95 ${
                    activeVideoCall.isMuted 
                      ? "bg-red-500/20 text-red-400 border border-red-500/40" 
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  title={activeVideoCall.isMuted ? "Unmute Mic" : "Mute Mic"}
                >
                  <Mic className="h-5 w-5" />
                </button>

                {/* Toggle Camera */}
                <button
                  type="button"
                  onClick={() => setActiveVideoCall((prev) => prev ? { ...prev, isVideoOff: !prev.isVideoOff } : null)}
                  className={`p-3.5 rounded-full transition-all cursor-pointer active:scale-95 ${
                    activeVideoCall.isVideoOff 
                      ? "bg-red-500/20 text-red-400 border border-red-500/40" 
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  title={activeVideoCall.isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {activeVideoCall.isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>

                {/* End Video Call Button */}
                <button
                  type="button"
                  onClick={endVideoCall}
                  className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/40 transition-all cursor-pointer active:scale-90"
                  title="End Video Call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL 4: PROFESSIONAL MOBILE TIKTOK CHAT CUSTOMIZER (BOTTOM SHEET & DIALOG)
          ==================================================================== */}
      <AnimatePresence>
        {showCustomizeModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 60, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="bg-[#121215] border-t sm:border border-white/15 rounded-t-[32px] sm:rounded-3xl max-h-[92vh] sm:max-h-[88vh] max-w-lg w-full shadow-2xl flex flex-col overflow-hidden text-white pb-safe"
            >
              {/* Mobile Drag Indicator */}
              <div className="pt-3 pb-1 flex justify-center sm:hidden">
                <span className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>

              {/* Modal Header */}
              <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#15151A]">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md"
                    style={{ backgroundColor: themeConfig.accentColor }}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-sm uppercase tracking-tight text-white flex items-center gap-1.5">
                      Chat Customization
                      <span 
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border text-white"
                        style={{ backgroundColor: `${themeConfig.accentColor}30`, borderColor: `${themeConfig.accentColor}60` }}
                      >
                        PRO
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {selectedUser ? `Personalize chat with @${selectedUser.username}` : "Theme settings"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      updateTheme(DEFAULT_THEME);
                      triggerToast("Theme reset to default", "info");
                    }}
                    title="Reset to default"
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomizeModal(false)}
                    className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 scrollbar-none">
                
                {/* 1. INTERACTIVE LIVE PREVIEW CARD */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Live Preview
                  </span>
                  <div 
                    className={`relative p-4 rounded-2xl border border-white/15 overflow-hidden flex flex-col gap-2.5 transition-all shadow-inner ${
                      themeConfig.bgTheme === "pitch" ? "bg-black" :
                      themeConfig.bgTheme === "aurora" ? "bg-[#08030B]" :
                      themeConfig.bgTheme === "cyber" ? "bg-[#060812]" :
                      themeConfig.bgTheme === "emerald" ? "bg-[#030B06]" :
                      themeConfig.bgTheme === "rose" ? "bg-[#0E0306]" :
                      themeConfig.bgTheme === "midnight" ? "bg-[#0A0F1D]" :
                      themeConfig.bgTheme === "mesh" ? "bg-[#090909]" :
                      themeConfig.bgTheme === "espresso" ? "bg-[#140E0A]" : "bg-black"
                    }`}
                  >
                    {themeConfig.bgTheme === "wallpaper" && themeConfig.wallpaperUrl && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <img
                          src={themeConfig.wallpaperUrl}
                          alt="Wallpaper preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          style={{
                            filter: (themeConfig.wallpaperBlur ?? 0) > 0 ? `blur(${themeConfig.wallpaperBlur}px)` : undefined,
                            transform: (themeConfig.wallpaperBlur ?? 0) > 0 ? 'scale(1.1)' : undefined
                          }}
                        />
                        <div 
                          className="absolute inset-0 bg-black" 
                          style={{ opacity: (themeConfig.wallpaperDim ?? 45) / 100 }}
                        />
                      </div>
                    )}

                    {/* Preview Receiver Bubble */}
                    <div className="relative z-1 flex items-end gap-2 max-w-[85%] self-start">
                      <div className="w-6 h-6 rounded-full bg-slate-700 shrink-0 flex items-center justify-center text-[10px] font-bold">
                        {selectedUser ? selectedUser.username.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div className={`p-2.5 ${themeConfig.fontSize} ${getBubbleClasses(themeConfig.bubbleStyle, false, false)}`}>
                        <p className="text-xs leading-tight">How does this chat look on phone? ✨</p>
                      </div>
                    </div>

                    {/* Preview Sender Bubble */}
                    <div className="relative z-1 flex items-end gap-2 max-w-[85%] self-end">
                      <div className="relative">
                        <div 
                          className={`p-2.5 ${themeConfig.fontSize} font-medium transition-all ${getBubbleClasses(themeConfig.bubbleStyle, true, false)}`}
                          style={
                            themeConfig.bubbleGradient
                              ? { background: themeConfig.accentGradient || themeConfig.accentColor, boxShadow: `0 4px 14px ${themeConfig.accentColor}30` }
                              : { backgroundColor: themeConfig.accentColor }
                          }
                        >
                          <p className="text-xs leading-tight">Looks super sleek like TikTok! 🔥</p>
                        </div>
                        {/* Sample Reaction */}
                        <div className="absolute -bottom-2 right-1 bg-[#18181B] border border-white/20 rounded-full px-1.5 py-0.2 text-[10px] shadow-md flex items-center">
                          <span>{themeConfig.doubleTapReaction || "❤️"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. ACCENT COLORS & GRADIENTS */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Paintbrush className="h-3.5 w-3.5" style={{ color: themeConfig.accentColor }} />
                      Accent Colors & Glow
                    </label>
                    <span className="text-[11px] font-bold text-slate-400">{themeConfig.accentName}</span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {THEME_ACCENTS.map((item) => {
                      const isSelected = themeConfig.accentColor === item.color;
                      return (
                        <button
                          key={item.color}
                          type="button"
                          onClick={() => updateTheme({ accentColor: item.color, accentName: item.name, accentGradient: item.gradient })}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all cursor-pointer ${
                            isSelected ? "border-white bg-white/15 scale-105 shadow-md" : "border-white/5 bg-white/5 hover:border-white/20"
                          }`}
                        >
                          <span 
                            className="w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-transform"
                            style={{ background: item.gradient || item.color }}
                          >
                            {isSelected && <Check className="h-4 w-4 text-white drop-shadow-md stroke-[3]" />}
                          </span>
                          <span className="text-[9px] font-bold text-slate-300 truncate max-w-[55px] text-center">
                            {item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Gradient Bubbles Toggle */}
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 mt-1">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">Vibrant Bubble Gradient</span>
                      <span className="text-[10px] text-slate-400">Apply smooth dual-color glow to sender bubbles</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateTheme({ bubbleGradient: !themeConfig.bubbleGradient })}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        themeConfig.bubbleGradient ? "bg-emerald-500" : "bg-white/20"
                      }`}
                    >
                      <span 
                        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                          themeConfig.bubbleGradient ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. CHAT BACKGROUND & PHOTO WALLPAPERS & UPLOAD */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" style={{ color: themeConfig.accentColor }} />
                      Background & Custom Wallpapers
                    </label>
                    <span className="text-[10px] text-slate-400">Atmosphere</span>
                  </div>

                  {/* Hidden File Input for Custom Background Image Upload */}
                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleBgUpload(file);
                      }
                      e.target.value = "";
                    }}
                  />

                  {/* CLICK TO UPLOAD & DRAG-AND-DROP DROPZONE */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsBgDragging(true);
                    }}
                    onDragLeave={() => setIsBgDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsBgDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        handleBgUpload(file);
                      }
                    }}
                    onClick={() => bgFileInputRef.current?.click()}
                    className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group relative overflow-hidden ${
                      isBgDragging
                        ? "border-emerald-400 bg-emerald-500/15 scale-[1.01]"
                        : isUploadingBg
                        ? "border-white/40 bg-white/10"
                        : "border-white/20 bg-gradient-to-b from-white/10 to-white/5 hover:border-white/40 hover:bg-white/10"
                    }`}
                  >
                    {isUploadingBg ? (
                      <div className="flex flex-col items-center gap-2 py-1">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                        <span className="text-xs font-bold text-white">Uploading custom background...</span>
                      </div>
                    ) : (
                      <>
                        <div 
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110"
                          style={{ background: themeConfig.accentGradient || themeConfig.accentColor }}
                        >
                          <UploadCloud className="h-6 w-6 text-white drop-shadow-sm" />
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <p className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>Click to Upload Custom Wallpaper</span>
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white font-bold">New</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Tap anywhere to choose from device or drag & drop (PNG, JPG, WebP)
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Active Custom Wallpaper Quick Bar (if wallpaper is active) */}
                  {themeConfig.bgTheme === "wallpaper" && themeConfig.wallpaperUrl && (
                    <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/10 border border-white/20">
                      <img
                        src={themeConfig.wallpaperUrl}
                        alt="Current Background"
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-white/20 shadow-md shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">Active Custom Wallpaper</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.2 rounded border border-emerald-500/30">Active</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">Applied to this chat</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => bgFileInputRef.current?.click()}
                          className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1"
                        >
                          <FolderOpen className="h-3 w-3" />
                          <span>Change</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTheme({ wallpaperUrl: "", bgTheme: "pitch" })}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all cursor-pointer"
                          title="Remove wallpaper"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ambient Atmosphere Themes Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {THEME_BACKGROUNDS.map((bg) => {
                      const isSelected = themeConfig.bgTheme === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => {
                            if (bg.id === "wallpaper" && !themeConfig.wallpaperUrl) {
                              updateTheme({ bgTheme: "wallpaper", wallpaperUrl: WALLPAPER_PRESETS[0].url });
                            } else {
                              updateTheme({ bgTheme: bg.id as any });
                            }
                          }}
                          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected ? "border-white bg-white/15 shadow-md ring-1 ring-white/30" : "border-white/5 bg-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white truncate">{bg.name}</span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: themeConfig.accentColor }} />}
                          </div>
                          <span className="text-[9px] text-slate-400 line-clamp-1">{bg.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Curated Photo Wallpapers Presets Gallery */}
                  <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/10 mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Image className="h-3.5 w-3.5" style={{ color: themeConfig.accentColor }} />
                        Curated TikTok Wallpapers
                      </span>
                      <span className="text-[10px] text-slate-400">1-Tap Set</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {WALLPAPER_PRESETS.map((wp) => {
                        const isChosen = themeConfig.bgTheme === "wallpaper" && themeConfig.wallpaperUrl === wp.url;
                        return (
                          <button
                            key={wp.url}
                            type="button"
                            onClick={() => updateTheme({ bgTheme: "wallpaper", wallpaperUrl: wp.url })}
                            className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                              isChosen ? "border-white ring-2 ring-white/40 scale-102 shadow-lg" : "border-white/10 hover:border-white/30"
                            }`}
                          >
                            <img
                              src={wp.url}
                              alt={wp.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-1.5">
                              <span className="text-[9px] font-bold text-white leading-tight truncate">{wp.name}</span>
                            </div>
                            {isChosen && (
                              <span className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5 text-white shadow-md">
                                <Check className="h-3 w-3 stroke-[3]" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Wallpaper URL Input */}
                    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/10">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Or Paste Direct Image Link</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Paste image link (https://...)"
                          value={themeConfig.wallpaperUrl || ""}
                          onChange={(e) => updateTheme({ bgTheme: "wallpaper", wallpaperUrl: e.target.value })}
                          className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                        />
                        {themeConfig.wallpaperUrl && (
                          <button
                            type="button"
                            onClick={() => updateTheme({ wallpaperUrl: "", bgTheme: "pitch" })}
                            className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold transition-all cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Wallpaper Dimmer & Blur Sliders */}
                    {themeConfig.bgTheme === "wallpaper" && themeConfig.wallpaperUrl && (
                      <div className="flex flex-col gap-3 mt-2 pt-2 border-t border-white/10">
                        {/* Dimmer Slider */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-300">
                            <span>Wallpaper Dim Overlay</span>
                            <span className="font-mono text-emerald-400">{themeConfig.wallpaperDim ?? 45}%</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="85"
                            value={themeConfig.wallpaperDim ?? 45}
                            onChange={(e) => updateTheme({ wallpaperDim: Number(e.target.value) })}
                            className="w-full accent-white h-1.5 bg-white/20 rounded-lg cursor-pointer"
                          />
                        </div>

                        {/* Blur Slider */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-300">
                            <span>Background Blur Effect</span>
                            <span className="font-mono text-emerald-400">{themeConfig.wallpaperBlur ?? 0}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="16"
                            value={themeConfig.wallpaperBlur ?? 0}
                            onChange={(e) => updateTheme({ wallpaperBlur: Number(e.target.value) })}
                            className="w-full accent-white h-1.5 bg-white/20 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. 10 TIKTOK CHAT BUBBLE TYPES & TYPOGRAPHY */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <MessageSquarePlus className="h-3.5 w-3.5" style={{ color: themeConfig.accentColor }} />
                      10 Chat Bubble Types
                    </label>
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      10 Styles
                    </span>
                  </div>
                  
                  {/* 10 Bubble Shapes Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {BUBBLE_STYLES_LIST.map((style) => {
                      const isSelected = themeConfig.bubbleStyle === style.id || 
                        (style.id === "tiktok-pill" && (themeConfig.bubbleStyle === "rounded-3xl" || themeConfig.bubbleStyle === "rounded-full")) ||
                        (style.id === "ios-classic" && themeConfig.bubbleStyle === "rounded-2xl") ||
                        (style.id === "minimal-sharp" && themeConfig.bubbleStyle === "rounded-xl");

                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => {
                            updateTheme({ bubbleStyle: style.id });
                            playSound("click");
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 relative overflow-hidden group ${
                            isSelected 
                              ? "border-white bg-white/20 shadow-lg ring-2 ring-white/30 scale-[1.02]" 
                              : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base leading-none">{style.iconTag}</span>
                              <span className={`text-xs font-black truncate ${isSelected ? "text-white" : "text-slate-200"}`}>
                                {style.name}
                              </span>
                            </div>
                            {style.badge && (
                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/15 text-white/90">
                                {style.badge}
                              </span>
                            )}
                          </div>
                          <span className={`text-[10px] line-clamp-1 ${isSelected ? "text-slate-200 font-medium" : "text-slate-400"}`}>
                            {style.desc}
                          </span>
                          {isSelected && (
                            <div 
                              className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center -translate-y-2 translate-x-2 rotate-45"
                              style={{ background: themeConfig.accentColor }}
                            >
                              <Check className="h-2.5 w-2.5 text-white -rotate-45" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Font Size Scaling */}
                  <div className="flex items-center gap-2 mt-1">
                    {[
                      { id: "text-xs", label: "Small (12px)" },
                      { id: "text-sm", label: "Standard (14px)" },
                      { id: "text-base", label: "Large (16px)" }
                    ].map((size) => {
                      const isSelected = (themeConfig.fontSize || "text-sm") === size.id;
                      return (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => {
                            updateTheme({ fontSize: size.id as any });
                            playSound("click");
                          }}
                          className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                            isSelected ? "border-white bg-white/20 text-white shadow-xs" : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                          }`}
                        >
                          {size.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. TIKTOK EXTRAS & PERSONALIZATION */}
                <div className="flex flex-col gap-3 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" style={{ color: themeConfig.accentColor }} />
                      TikTok Double-Tap Reaction
                    </label>
                    <span className="text-[10px] text-slate-400">Quick Heart</span>
                  </div>

                  {/* Double tap emoji selector */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {["❤️", "🔥", "⚡", "✨", "💀", "👑", "😍", "🎉", "👏", "💯"].map((emoji) => {
                      const isSelected = (themeConfig.doubleTapReaction || "❤️") === emoji;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            updateTheme({ doubleTapReaction: emoji });
                            playSound("click");
                          }}
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-all cursor-pointer shrink-0 border ${
                            isSelected ? "border-white bg-white/20 scale-110 shadow-lg" : "border-white/5 bg-white/5 hover:border-white/20"
                          }`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>

                  {/* Thread Nickname */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Thread Nickname {selectedUser ? `for @${selectedUser.username}` : ""}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Bestie, Rayan, Boss"
                        value={themeConfig.nickname || ""}
                        onChange={(e) => updateTheme({ nickname: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/20"
                      />
                      {themeConfig.nickname && (
                        <button
                          type="button"
                          onClick={() => updateTheme({ nickname: "" })}
                          className="px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold transition-all cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer / Apply Button */}
              <div className="p-4 border-t border-white/10 bg-[#15151A] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomizeModal(false);
                    playSound("click");
                    triggerToast("Chat theme applied successfully!", "success");
                  }}
                  className="w-full py-3.5 rounded-2xl text-white font-black text-xs uppercase tracking-wider shadow-xl transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                  style={{ backgroundColor: themeConfig.accentColor }}
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  Done & Save Preferences
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
