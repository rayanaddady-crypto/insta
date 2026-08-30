import React, { useState, useEffect, useRef, useId } from "react";
import { useAuth } from "./AuthContext";
import { MusicTrack } from "../types";
import { 
  Search, Music, Play, Pause, Upload, Sparkles, X, Check, 
  Volume2, VolumeX, Flame, Disc, Radio, RefreshCw, Plus, Globe,
  Headphones, Sliders, ChevronLeft, ChevronRight, Clock, FastForward, Rewind
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playSound } from "../utils/sound";

interface MusicPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (track: {
    music_track: string;
    music_title: string;
    music_artist: string;
    music_url: string;
    music_cover: string;
    music_start_time?: number;
  }) => void;
  currentTrackTitle?: string;
}

const GENRE_CATEGORIES = [
  { id: "trending", label: "Trending Hits", icon: "🔥" },
  { id: "all", label: "Global Catalog", icon: "🌐" },
  { id: "Pop", label: "Global Pop", icon: "✨" },
  { id: "Hip Hop", label: "Hip-Hop & Rap", icon: "🎤" },
  { id: "Arabic", label: "Moroccan & Arabic", icon: "🇲🇦" },
  { id: "Phonk", label: "Phonk & Drift", icon: "⚡" },
  { id: "Lofi", label: "Lofi Chill", icon: "🎧" },
  { id: "R&B", label: "R&B & Soul", icon: "💫" },
  { id: "Electronic", label: "EDM & Club", icon: "🎹" },
  { id: "Rock", label: "Rock & Indie", icon: "🎸" },
  { id: "my_uploads", label: "My Uploads", icon: "📁" },
  { id: "upload", label: "Upload Audio", icon: "⬆️" }
];

const QUICK_SEARCH_SUGGESTIONS = [
  "ElGrandeToto", "Morad", "Dizzy DROS", "Travis Scott", "Taylor Swift", "The Weeknd", "Drake", 
  "Billie Eilish", "Dua Lipa", "Phonk Gym", "Lofi Beats", "Soolking", "Sabrina Carpenter"
];

const PRESET_COVERS = [
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80",
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&h=300&q=80"
];

// Fallback top tracks for instant zero-latency results
const INSTANT_FALLBACK_TRACKS: MusicTrack[] = [
  {
    id: 101,
    title: "Love Nwantiti (feat. ElGrandeToto) [North African Remix]",
    artist: "CKay & ElGrandeToto",
    genre: "Hip Hop",
    is_trending: 1,
    cover_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 30
  },
  {
    id: 102,
    title: "Mghayer",
    artist: "ElGrandeToto",
    genre: "Hip Hop",
    is_trending: 1,
    cover_url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&h=300&q=80",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 30
  },
  {
    id: 103,
    title: "Salade Coco",
    artist: "ElGrandeToto",
    genre: "Hip Hop",
    is_trending: 1,
    cover_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=300&h=300&q=80",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    duration: 30
  },
  {
    id: 104,
    title: "Pelele",
    artist: "Morad",
    genre: "Hip Hop",
    is_trending: 1,
    cover_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=300&h=300&q=80",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
    duration: 30
  },
  {
    id: 105,
    title: "Motorola",
    artist: "Morad",
    genre: "Hip Hop",
    is_trending: 1,
    cover_url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&h=300&q=80",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    duration: 30
  },
  {
    id: 106,
    title: "M3a L3echrane",
    artist: "Dizzy DROS",
    genre: "Hip Hop",
    is_trending: 1,
    cover_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=300&h=300&q=80",
    audio_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
    duration: 30
  }
];

// Helper to rank and score tracks with highest priority for exact artist name match
function scoreMusicMatchClient(track: MusicTrack, searchStr: string): number {
  if (!searchStr) return 0;
  const rawQ = searchStr.toLowerCase().trim();
  const cleanQ = rawQ.replace(/[\s\-_.,'/()]+/g, "");
  const title = (track.title || "").toLowerCase().trim();
  const artist = (track.artist || "").toLowerCase().trim();
  const cleanTitle = title.replace(/[\s\-_.,'/()]+/g, "");
  const cleanArtist = artist.replace(/[\s\-_.,'/()]+/g, "");

  let score = 0;

  // 1. EXACT / DOMINANT ARTIST MATCH (Highest Priority)
  if (cleanArtist === cleanQ || artist === rawQ) {
    score += 30000;
  } else if (cleanArtist.startsWith(cleanQ) || artist.startsWith(rawQ)) {
    score += 25000;
  } else if (cleanQ.startsWith(cleanArtist) || rawQ.startsWith(artist)) {
    score += 22000;
  } else if (cleanArtist.includes(cleanQ) || artist.includes(rawQ)) {
    score += 18000;
  }

  // Tokenized artist match
  const qTokens = rawQ.split(/[\s\-_.,'/()]+/).filter(Boolean);
  const artistTokens = artist.split(/[\s\-_.,'/()]+/).filter(Boolean);
  const titleTokens = title.split(/[\s\-_.,'/()]+/).filter(Boolean);

  if (qTokens.length > 0) {
    const matchedArtistTokens = qTokens.filter((token: string) =>
      artistTokens.some((at: string) => at.includes(token) || token.includes(at)) ||
      cleanArtist.includes(token)
    );
    if (matchedArtistTokens.length === qTokens.length) {
      score += 15000;
    } else if (matchedArtistTokens.length > 0) {
      score += 7500 * (matchedArtistTokens.length / qTokens.length);
    }
  }

  // 2. TITLE MATCH
  if (cleanTitle === cleanQ || title === rawQ) {
    score += 12000;
  } else if (cleanTitle.startsWith(cleanQ) || title.startsWith(rawQ)) {
    score += 9000;
  } else if (cleanTitle.includes(cleanQ) || title.includes(rawQ)) {
    score += 6000;
  }

  if (qTokens.length > 0) {
    const matchedTitleTokens = qTokens.filter((token: string) =>
      titleTokens.some((tt: string) => tt.includes(token) || token.includes(tt)) ||
      cleanTitle.includes(token)
    );
    if (matchedTitleTokens.length === qTokens.length) {
      score += 8000;
    } else if (matchedTitleTokens.length > 0) {
      score += 4000 * (matchedTitleTokens.length / qTokens.length);
    }
  }

  if (artistTokens.some((w: string) => w.startsWith(rawQ))) score += 5000;
  if (titleTokens.some((w: string) => w.startsWith(rawQ))) score += 3000;

  if (track.is_trending) score += 100;
  return score;
}

// 72-bar realistic audio waveform distribution
const STATIC_WAVEFORM_BARS = [
  28, 42, 60, 85, 45, 30, 75, 95, 60, 40, 80, 100, 70, 50, 90, 85,
  40, 65, 95, 75, 50, 85, 100, 60, 45, 90, 70, 40, 80, 60, 30, 50,
  70, 90, 55, 35, 65, 80, 95, 60, 40, 75, 90, 50, 30, 60, 85, 40,
  55, 70, 90, 100, 80, 60, 95, 75, 50, 40, 85, 65, 45, 35, 70, 90,
  80, 65, 50, 40, 60, 75, 50, 30
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(q);
  if (index === -1) return <span>{text}</span>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);

  return (
    <span>
      {before}
      <span className="text-[#0095F6] bg-[#0095F6]/20 px-0.5 rounded-xs font-bold">{match}</span>
      {after}
    </span>
  );
}

export const MusicPickerModal: React.FC<MusicPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTrack,
  currentTrackTitle
}) => {
  const { fetchWithAuth, user } = useAuth();
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("trending");

  // Dynamic Phone Screen Size Detection
  const [screenDimensions, setScreenDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== "undefined" ? window.innerWidth : 390,
    height: typeof window !== "undefined" ? window.innerHeight : 844
  });

  useEffect(() => {
    const handleResize = () => {
      setScreenDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isCompactPhone = screenDimensions.height < 680 || screenDimensions.width < 380;

  // Audio Playback Preview State
  const [playingTrackId, setPlayingTrackId] = useState<number | string | null>(null);
  const [currentPreviewTrack, setCurrentPreviewTrack] = useState<MusicTrack | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(30);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Instagram Music Timeline / Scrubber Trimming State (matching user image)
  const [selectedTrimmingTrack, setSelectedTrimmingTrack] = useState<MusicTrack | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [clipDuration, setClipDuration] = useState<number>(30); // 30s Instagram clip length default
  const isDraggingWaveform = useRef(false);
  const dragStartX = useRef(0);
  const initialStartTimeOnDrag = useRef(0);

  // Upload Tab Form State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadArtist, setUploadArtist] = useState("");
  const [uploadGenre, setUploadGenre] = useState("Pop");
  const [uploadAudioFile, setUploadAudioFile] = useState<File | null>(null);
  const [uploadCoverFile, setUploadCoverFile] = useState<File | null>(null);
  const [selectedPresetCover, setSelectedPresetCover] = useState(PRESET_COVERS[0]);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load Tracks from Server with instant client-side fallback & artist-first ranking
  const fetchTracks = async (queryText = searchQuery) => {
    if (selectedCategory === "upload") return;
    setLoading(true);
    try {
      let endpoint = "/api/music";
      const params = new URLSearchParams();

      if (queryText.trim()) {
        params.set("search", queryText.trim());
      }
      if (selectedCategory === "trending") {
        params.set("trending", "1");
      } else if (selectedCategory === "my_uploads") {
        params.set("my_uploads", "1");
      } else if (selectedCategory !== "all") {
        params.set("genre", selectedCategory);
      }

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const res = await fetchWithAuth(endpoint);
      const incomingTracks: MusicTrack[] = res?.tracks || [];

      // Combine with instant fallbacks if matching search
      const combined = [...incomingTracks];
      const seenSignatures = new Set(
        combined.map((t) => `${(t.title || "").toLowerCase().trim()}_${(t.artist || "").toLowerCase().trim()}`)
      );

      for (const fallback of INSTANT_FALLBACK_TRACKS) {
        const sig = `${(fallback.title || "").toLowerCase().trim()}_${(fallback.artist || "").toLowerCase().trim()}`;
        if (!seenSignatures.has(sig)) {
          if (!queryText.trim() || scoreMusicMatchClient(fallback, queryText) > 0) {
            seenSignatures.add(sig);
            combined.push(fallback);
          }
        }
      }

      // Sort with strict artist-first ranking when user is searching
      if (queryText.trim()) {
        combined.sort((a, b) => scoreMusicMatchClient(b, queryText) - scoreMusicMatchClient(a, queryText));
      }

      setTracks(combined);
    } catch (err) {
      console.error("Failed to load music tracks:", err);
      // If network fails, still provide instant fallback tracks
      if (queryText.trim()) {
        const matchingFallbacks = INSTANT_FALLBACK_TRACKS.filter(
          (t) => scoreMusicMatchClient(t, queryText) > 0
        ).sort((a, b) => scoreMusicMatchClient(b, queryText) - scoreMusicMatchClient(a, queryText));
        setTracks(matchingFallbacks);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTracks(searchQuery);
    }
  }, [isOpen, selectedCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchTracks(searchQuery);
    }, 120);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingTrackId(null);
      setCurrentPreviewTrack(null);
      setSelectedTrimmingTrack(null);
      setAudioCurrentTime(0);
    }
  }, [isOpen]);

  const handleTogglePlay = (track: MusicTrack, customStart?: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound("click");

    if (playingTrackId === track.id && customStart === undefined) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingTrackId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const newAudio = new Audio(track.audio_url);
    newAudio.crossOrigin = "anonymous";
    newAudio.volume = 0.85;

    const startPos = typeof customStart === "number" ? customStart : startTime;

    newAudio.onloadedmetadata = () => {
      if (newAudio.duration && isFinite(newAudio.duration)) {
        setAudioDuration(newAudio.duration);
      }
      if (startPos > 0 && startPos < newAudio.duration) {
        newAudio.currentTime = startPos;
      }
    };

    newAudio.ontimeupdate = () => {
      setAudioCurrentTime(newAudio.currentTime);
      if (newAudio.duration && isFinite(newAudio.duration)) {
        setAudioDuration(newAudio.duration);
      }
      // Auto loop clip within chosen 30s window
      if (startPos !== undefined && newAudio.currentTime >= startPos + clipDuration) {
        newAudio.currentTime = startPos;
      }
    };

    newAudio.onended = () => {
      newAudio.currentTime = startPos;
      newAudio.play().catch(() => {});
    };

    newAudio.onerror = () => {
      console.warn("Audio preview playback failed");
      setPlayingTrackId(null);
    };

    newAudio.play().catch((err) => {
      console.warn("Audio play prevented:", err);
    });

    audioRef.current = newAudio;
    setPlayingTrackId(track.id);
    setCurrentPreviewTrack(track);
  };

  const handleOpenTrimmer = (track: MusicTrack, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound("pop");
    setSelectedTrimmingTrack(track);
    setStartTime(0);
    setAudioDuration(track.duration || 30);
    handleTogglePlay(track, 0);
  };

  const handleConfirmTrack = (track: MusicTrack, finalStartTime = startTime) => {
    playSound("pop");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingTrackId(null);
    setSelectedTrimmingTrack(null);

    const formattedTrackString = `${track.title} · ${track.artist}`;
    onSelectTrack({
      music_track: formattedTrackString,
      music_title: track.title,
      music_artist: track.artist,
      music_url: track.audio_url,
      music_cover: track.cover_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80",
      music_start_time: Math.floor(finalStartTime)
    });
    onClose();
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadAudioFile(file);
    setUploadError(null);

    if (!uploadTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setUploadTitle(cleanName);
    }
    if (!uploadArtist.trim() && user?.username) {
      setUploadArtist(user.username);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(objectUrl);

    const tempAudio = new Audio(objectUrl);
    tempAudio.onloadedmetadata = () => {
      if (tempAudio.duration && isFinite(tempAudio.duration)) {
        setAudioDuration(tempAudio.duration);
      }
    };
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadAudioFile) {
      setUploadError("Please select an audio file (MP3, WAV, M4A, etc.)");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Please enter a song title");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(25);

    try {
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => (p < 90 ? p + 15 : p));
      }, 200);

      const formData = new FormData();
      formData.append("audio", uploadAudioFile);
      formData.append("title", uploadTitle.trim());
      formData.append("artist", uploadArtist.trim() || user?.username || "Unknown");
      formData.append("genre", uploadGenre);

      if (uploadCoverFile) {
        formData.append("cover", uploadCoverFile);
      } else {
        formData.append("cover_url", selectedPresetCover);
      }

      const res = await fetchWithAuth("/api/music/upload", {
        method: "POST",
        body: formData
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      if (res && res.track) {
        playSound("success");
        handleOpenTrimmer(res.track);
      } else {
        throw new Error(res?.error || "Failed to upload audio track");
      }
    } catch (err: any) {
      console.error("Music upload failed:", err);
      setUploadError(err.message || "Failed to upload track. Please try another file.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const maxStartTime = Math.max(0, Math.floor(audioDuration - clipDuration));

  // Touch & Mouse scrubber drag handlers for the Instagram waveform
  const handleWaveformMouseDown = (e: React.MouseEvent) => {
    isDraggingWaveform.current = true;
    dragStartX.current = e.clientX;
    initialStartTimeOnDrag.current = startTime;
  };

  const handleWaveformMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingWaveform.current || maxStartTime <= 0) return;
    const deltaX = e.clientX - dragStartX.current;
    // Map drag distance in px to seconds
    const secondsDelta = -(deltaX / 4); 
    const nextStart = Math.min(maxStartTime, Math.max(0, Math.floor(initialStartTimeOnDrag.current + secondsDelta)));
    setStartTime(nextStart);
    if (audioRef.current) {
      audioRef.current.currentTime = nextStart;
    }
  };

  const handleWaveformMouseUp = () => {
    isDraggingWaveform.current = false;
  };

  const handleWaveformTouchStart = (e: React.TouchEvent) => {
    isDraggingWaveform.current = true;
    dragStartX.current = e.touches[0].clientX;
    initialStartTimeOnDrag.current = startTime;
  };

  const handleWaveformTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingWaveform.current || maxStartTime <= 0) return;
    const deltaX = e.touches[0].clientX - dragStartX.current;
    const secondsDelta = -(deltaX / 3.5);
    const nextStart = Math.min(maxStartTime, Math.max(0, Math.round(initialStartTimeOnDrag.current + secondsDelta)));
    setStartTime(nextStart);
    if (audioRef.current && Math.abs(audioRef.current.currentTime - nextStart) > 0.5) {
      audioRef.current.currentTime = nextStart;
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className={`w-full max-w-md bg-[#0F0F11] border-t sm:border border-white/10 rounded-t-[32px] sm:rounded-[28px] overflow-hidden shadow-2xl flex flex-col text-white ${
          isCompactPhone 
            ? "h-[96dvh] max-h-[96dvh]" 
            : "h-[90dvh] max-h-[90dvh] sm:h-auto sm:max-h-[82vh]"
        } pb-safe`}
      >
        {/* Mobile Pull Handle Pill Indicator */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-2 mb-1 sm:hidden shrink-0" />

        {/* ====================================================================
            VIEW A: INSTAGRAM MUSIC TIMELINE TRIMMER (EXACT MATCH TO USER IMAGE)
            ==================================================================== */}
        {selectedTrimmingTrack ? (
          <div 
            onMouseUp={handleWaveformMouseUp}
            onMouseLeave={handleWaveformMouseUp}
            onTouchEnd={handleWaveformMouseUp}
            className={`flex flex-col h-full bg-[#0A0A0C] text-white ${
              isCompactPhone ? "p-3" : "p-4 sm:p-5"
            } select-none relative overflow-y-auto`}
          >
            {/* Top Bar: "New song" / Back on left, "Done" in blue on right */}
            <div className="flex items-center justify-between pt-0.5 pb-2">
              <button
                type="button"
                id="music-trimmer-back-btn"
                onClick={() => {
                  playSound("click");
                  setSelectedTrimmingTrack(null);
                }}
                className="text-xs sm:text-sm font-semibold text-white/90 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>New song</span>
              </button>

              <button
                type="button"
                id="music-trimmer-done-btn"
                onClick={() => handleConfirmTrack(selectedTrimmingTrack, startTime)}
                className="text-xs sm:text-sm font-bold text-[#4C68D7] hover:text-[#5B77E6] cursor-pointer transition-all active:scale-95 bg-[#4C68D7]/15 px-3 py-1 rounded-full border border-[#4C68D7]/30"
              >
                Done
              </button>
            </div>

            {/* Centered Album Cover & Track Title / Artist */}
            <div className={`flex flex-col items-center justify-center ${
              isCompactPhone ? "pt-1 pb-3" : "pt-2 pb-5"
            } text-center`}>
              {/* Instagram Glossy Album Artwork Sticker */}
              <div className={`relative ${
                isCompactPhone ? "w-16 h-16" : "w-20 h-20 sm:w-24 sm:h-24"
              } rounded-2xl overflow-hidden shadow-[0_8px_25px_rgba(0,0,0,0.7)] border border-white/15 bg-neutral-900 mb-2.5 group shrink-0`}>
                <img
                  src={selectedTrimmingTrack.cover_url || PRESET_COVERS[0]}
                  alt={selectedTrimmingTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Title & Artist */}
              <h3 className="text-[14px] sm:text-[15px] font-bold text-white tracking-tight truncate max-w-[260px]">
                {selectedTrimmingTrack.title}
              </h3>
              <p className="text-[12px] text-[#8E8E93] mt-0.5 truncate max-w-[260px]">
                {selectedTrimmingTrack.artist}
              </p>
            </div>

            {/* Middle Row: Clip Duration Badge (30), Timeline Rail with Pink Highlights, Solid White Play Button */}
            <div className="flex items-center gap-2.5 px-1 my-2 shrink-0">
              {/* Duration Circle Selector (30s) */}
              <button
                type="button"
                id="music-clip-duration-btn"
                onClick={() => {
                  playSound("toggle");
                  setClipDuration((prev) => (prev === 30 ? 15 : prev === 15 ? 45 : 30));
                }}
                className="w-8.5 h-8.5 rounded-full border border-white/20 hover:border-white/40 bg-white/5 flex items-center justify-center text-[11px] font-bold text-white shrink-0 cursor-pointer active:scale-95 transition-all shadow-sm"
                title="Click to toggle clip duration (15s, 30s, 45s)"
              >
                {clipDuration}
              </button>

              {/* Pink Highlighted Timeline Scrubber Track */}
              <div className="flex-1 relative flex items-center py-2">
                <div className="w-full h-[2px] bg-white/20 rounded-full relative">
                  {/* Pink / Magenta Popular Chorus Dots */}
                  <div className="absolute left-[25%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#E1306C] shadow-[0_0_8px_#E1306C]" />
                  <div className="absolute left-[68%] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#E1306C] shadow-[0_0_8px_#E1306C]" />

                  {/* White Scrub Handle / Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-2 bg-white rounded-full shadow-md transition-all duration-75 pointer-events-none"
                    style={{
                      left: `${maxStartTime > 0 ? (startTime / maxStartTime) * 92 : 0}%`
                    }}
                  />
                </div>

                {/* Invisible Range Slider overlay for smooth tapping and finger dragging */}
                <input
                  type="range"
                  min={0}
                  max={maxStartTime > 0 ? maxStartTime : 0}
                  step={0.5}
                  value={startTime}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setStartTime(next);
                    if (audioRef.current) audioRef.current.currentTime = next;
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                    const next = Number(e.currentTarget.value);
                    setStartTime(next);
                    if (audioRef.current) audioRef.current.currentTime = next;
                  }}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-full touch-none"
                  style={{ touchAction: "none" }}
                />
              </div>

              {/* Solid White Circular Play/Pause Button (exact match to screenshot) */}
              <button
                type="button"
                id="music-trimmer-play-btn"
                onClick={() => handleTogglePlay(selectedTrimmingTrack, startTime)}
                className="w-8.5 h-8.5 rounded-full bg-white hover:bg-neutral-100 text-black flex items-center justify-center shrink-0 shadow-lg cursor-pointer active:scale-90 transition-transform"
              >
                {playingTrackId === selectedTrimmingTrack.id ? (
                  <Pause className="h-3.5 w-3.5 fill-black text-black" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-black text-black ml-0.5" />
                )}
              </button>
            </div>

            {/* Bottom Waveform Scroller with Signature Instagram Rainbow Gradient Box */}
            <div className={`mt-3 mb-2 shrink-0 ${isCompactPhone ? "mt-2 mb-1" : "mt-5 mb-3"}`}>
              <div 
                onMouseDown={handleWaveformMouseDown}
                onMouseMove={handleWaveformMouseMove}
                onTouchStart={handleWaveformTouchStart}
                onTouchMove={handleWaveformTouchMove}
                onTouchEnd={handleWaveformMouseUp}
                className={`relative ${
                  isCompactPhone ? "h-16" : "h-18 sm:h-20"
                } w-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none`}
                style={{ touchAction: "none" }}
              >
                {/* Horizontal Waveform Frequency Lines Strip */}
                <div 
                  className="flex items-center gap-[4px] px-2 h-full transition-transform duration-75 ease-out"
                  style={{
                    transform: `translateX(-${(startTime / (audioDuration || 1)) * 120}px)`
                  }}
                >
                  {STATIC_WAVEFORM_BARS.map((heightPercent, idx) => (
                    <div
                      key={idx}
                      className="w-[2.5px] sm:w-[3px] rounded-full transition-all duration-150"
                      style={{
                        height: `${Math.max(12, (heightPercent / 100) * (isCompactPhone ? 38 : 46))}px`,
                        backgroundColor:
                          idx >= (startTime / (audioDuration || 1)) * 48 &&
                          idx <= ((startTime + clipDuration) / (audioDuration || 1)) * 48
                            ? "#FFFFFF"
                            : "rgba(255, 255, 255, 0.22)"
                      }}
                    />
                  ))}
                </div>

                {/* Signature Instagram Highlight Window with Rainbow Border & White Backing */}
                <div className="absolute inset-0 m-auto w-[125px] sm:w-[150px] h-[48px] sm:h-[52px] pointer-events-none rounded-[14px] p-[2.5px] bg-gradient-to-r from-[#FFD600] via-[#FF0069] to-[#7638FA] shadow-[0_0_20px_rgba(255,0,105,0.35)] flex items-center justify-between">
                  {/* Left Red/Pink Grip Pin */}
                  <div className="w-[3px] h-5 sm:h-6 bg-[#FF0069] rounded-full ml-0.5" />

                  {/* Inner Frosted White Window */}
                  <div className="w-full h-full bg-white/90 rounded-[11px] mx-1 flex items-center justify-between px-2 overflow-hidden">
                    {[35, 65, 90, 50, 80, 100, 70, 45, 85, 60, 40].map((h, i) => (
                      <div
                        key={i}
                        className="w-[2px] sm:w-[2.5px] bg-[#262626] rounded-full"
                        style={{ height: `${(h / 100) * 28}px` }}
                      />
                    ))}
                  </div>

                  {/* Right Red/Pink Grip Pin */}
                  <div className="w-[3px] h-5 sm:h-6 bg-[#7638FA] rounded-full mr-0.5" />
                </div>
              </div>

              {/* Realtime Start/End Timestamp & Chorus Hint */}
              <div className="flex items-center justify-between text-[10.5px] sm:text-[11px] text-[#8E8E93] font-mono px-1.5 mt-1.5">
                <span>Start: <strong className="text-white">{formatTime(startTime)}</strong></span>
                <span className="text-[9.5px] sm:text-[10px] text-[#E1306C] font-sans font-semibold">Swipe waveform</span>
                <span>End: <strong className="text-white">{formatTime(Math.min(audioDuration, startTime + clipDuration))}</strong></span>
              </div>
            </div>

            {/* Quick ±5s Fine Tuning Micro Adjusters */}
            <div className="mt-auto pt-2 flex items-center justify-center gap-3 shrink-0">
              <button
                type="button"
                id="music-trimmer-prev-5s-btn"
                onClick={() => {
                  playSound("click");
                  const next = Math.max(0, startTime - 5);
                  setStartTime(next);
                  if (audioRef.current) audioRef.current.currentTime = next;
                }}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[11px] sm:text-xs text-slate-300 font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
              >
                <Rewind className="h-3 w-3" /> -5s
              </button>

              <button
                type="button"
                id="music-trimmer-next-5s-btn"
                onClick={() => {
                  playSound("click");
                  const next = Math.min(maxStartTime, startTime + 5);
                  setStartTime(next);
                  if (audioRef.current) audioRef.current.currentTime = next;
                }}
                className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[11px] sm:text-xs text-slate-300 font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
              >
                +5s <FastForward className="h-3 w-3" />
              </button>
            </div>
          </div>
        ) : (
          /* ====================================================================
              VIEW B: SEARCH & CATALOG LIST / UPLOAD TAB
              ==================================================================== */
          <>
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FFD600] via-[#FF0069] to-[#7638FA] flex items-center justify-center shadow-md">
                  <Music className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-white">Instagram Music</h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                      <Globe className="h-2.5 w-2.5" />
                      Live Search
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Search songs or pick timeline clip</p>
                </div>
              </div>

              <button
                type="button"
                id="music-picker-close-btn"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Search Bar & Suggestions */}
            <div className="p-3 border-b border-white/5 bg-[#141416] space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  id="music-search-input"
                  placeholder="Search songs or artists (e.g. 'mo', 'Morad', 'Travis')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1F1F23] border border-white/10 rounded-xl pl-9.5 pr-8 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-[#0095F6] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Search Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-0.5 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-400" /> Quick:
                </span>
                {QUICK_SEARCH_SUGGESTIONS.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => {
                      playSound("toggle");
                      setSearchQuery(tag);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-medium shrink-0 transition-all cursor-pointer ${
                      searchQuery.toLowerCase() === tag.toLowerCase()
                        ? "bg-[#0095F6] text-white shadow-sm"
                        : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Genre / Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none border-t border-white/5">
                {GENRE_CATEGORIES.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => {
                      playSound("toggle");
                      setSelectedCategory(cat.id);
                    }}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? "bg-[#0095F6] text-white shadow-md shadow-blue-500/20"
                        : "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body / Content */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2 scrollbar-thin">
              {selectedCategory === "upload" ? (
                /* ====================================================================
                   UPLOAD CUSTOM MUSIC TAB
                   ==================================================================== */
                <form onSubmit={handleUploadSubmit} className="space-y-4 py-2">
                  <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-4 text-center">
                    <input
                      type="file"
                      id="audio-upload-input"
                      accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                      onChange={handleAudioFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="audio-upload-input"
                      className="cursor-pointer flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/20 hover:border-[#0095F6] rounded-xl transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#0095F6]/20 text-[#0095F6] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-bold text-white">
                        {uploadAudioFile ? uploadAudioFile.name : "Choose audio file"}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        MP3, WAV, M4A, AAC, OGG (Up to 50MB)
                      </span>
                    </label>

                    {isUploading && (
                      <div className="mt-3 bg-white/10 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#0095F6] h-full transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}

                    {uploadPreviewUrl && !isUploading && (
                      <div className="mt-3 p-2.5 bg-[#222222] rounded-xl flex items-center justify-between border border-white/10">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Music className="h-4 w-4 text-[#0095F6] shrink-0 animate-bounce" />
                          <span className="text-xs font-medium text-white truncate">
                            {uploadAudioFile?.name}
                          </span>
                        </div>
                        <audio src={uploadPreviewUrl} controls className="h-7 max-w-[170px]" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Song Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Casablanca Sunset"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        className="w-full bg-[#1C1C1C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#0095F6]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Artist Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rayane"
                        value={uploadArtist}
                        onChange={(e) => setUploadArtist(e.target.value)}
                        className="w-full bg-[#1C1C1C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#0095F6]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Genre / Mood
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {["Pop", "Lofi", "Phonk", "Hip Hop", "Arabic", "Electronic", "Acoustic"].map((g) => (
                        <button
                          type="button"
                          key={g}
                          onClick={() => setUploadGenre(g)}
                          className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                            uploadGenre === g
                              ? "bg-[#0095F6] text-white"
                              : "bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Select Album Art Cover
                    </label>
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                      {PRESET_COVERS.map((cov, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setSelectedPresetCover(cov)}
                          className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                            selectedPresetCover === cov ? "border-[#0095F6] scale-105" : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img src={cov} alt="Cover preset" className="w-full h-full object-cover" />
                          {selectedPresetCover === cov && (
                            <div className="absolute inset-0 bg-[#0095F6]/30 flex items-center justify-center">
                              <Check className="h-4 w-4 text-white stroke-[3]" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {uploadError && (
                    <div className="p-2.5 bg-red-950/40 border border-red-900/40 rounded-xl text-red-400 text-xs">
                      {uploadError}
                    </div>
                  )}

                  <button
                    type="submit"
                    id="music-upload-submit-btn"
                    disabled={isUploading || !uploadAudioFile || !uploadTitle.trim()}
                    className="w-full py-3.5 rounded-xl bg-[#0095F6] hover:bg-[#0081D6] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Uploading Soundtrack...
                      </>
                    ) : (
                      <>
                        <Sliders className="h-4 w-4" />
                        Upload & Choose Clip
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* ====================================================================
                   MUSIC CATALOG LIST (ONLINE + LOCAL TRACKS)
                   ==================================================================== */
                <div>
                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                      <div className="relative">
                        <RefreshCw className="h-8 w-8 animate-spin text-[#0095F6]" />
                        <Headphones className="h-4 w-4 text-white absolute inset-0 m-auto" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-white">Searching songs...</p>
                        <p className="text-[11px] text-slate-500">Live online matching for "{searchQuery || "hits"}"</p>
                      </div>
                    </div>
                  ) : tracks.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <Music className="h-8 w-8 mx-auto text-slate-600 mb-1" />
                      <p className="text-xs font-semibold text-white">No tracks found</p>
                      <p className="text-[11px] text-slate-500">
                        Try searching for another song, artist or upload your own audio!
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedCategory("upload")}
                        className="mt-2 px-4 py-2 rounded-xl bg-[#0095F6] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload Music Track
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between px-1 pb-1 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {tracks.length} songs found
                        </span>
                        <span className="text-slate-500">Tap song to trim 30s timeline clip</span>
                      </div>

                      {tracks.map((track) => {
                        const isPlaying = playingTrackId === track.id;
                        const isSelected = currentTrackTitle && track.title.toLowerCase().includes(currentTrackTitle.toLowerCase());

                        return (
                          <div
                            key={track.id}
                            id={`music-track-item-${track.id}`}
                            onClick={(e) => handleOpenTrimmer(track, e)}
                            className={`group p-2.5 rounded-2xl flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                              isSelected
                                ? "bg-[#0095F6]/15 border-[#0095F6]/50"
                                : isPlaying
                                ? "bg-[#0095F6]/10 border-[#0095F6]/30 shadow-md shadow-blue-500/10"
                                : "bg-[#161618] hover:bg-[#202024] border-white/5 hover:border-white/10"
                            }`}
                          >
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 group/cover shadow-sm bg-black/40">
                              <img
                                src={track.cover_url || PRESET_COVERS[0]}
                                alt={track.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <button
                                type="button"
                                onClick={(e) => handleTogglePlay(track, undefined, e)}
                                className="absolute inset-0 bg-black/40 group-hover/cover:bg-black/60 flex items-center justify-center transition-colors cursor-pointer"
                              >
                                {isPlaying ? (
                                  <Pause className="h-5 w-5 text-[#0095F6] fill-[#0095F6]" />
                                ) : (
                                  <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                                )}
                              </button>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-white truncate group-hover:text-[#0095F6] transition-colors">
                                  <HighlightMatch text={track.title} query={searchQuery} />
                                </span>
                                {track.is_trending ? (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 font-bold rounded-md flex items-center gap-0.5 shrink-0">
                                    <Flame className="h-2.5 w-2.5 fill-amber-300" />
                                    TOP
                                  </span>
                                ) : null}
                                {track.is_online ? (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-blue-500/15 text-blue-300 font-bold rounded-md shrink-0 flex items-center gap-0.5">
                                    <Globe className="h-2.5 w-2.5" />
                                    Online
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span className="truncate">
                                  <HighlightMatch text={track.artist} query={searchQuery} />
                                </span>
                                <span>•</span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {track.duration ? formatTime(track.duration) : "0:30"}
                                </span>
                                {track.genre && (
                                  <span className="text-[9px] px-1.5 py-0.2 bg-white/5 rounded-md text-slate-400 truncate max-w-[100px]">
                                    {track.genre}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleOpenTrimmer(track, e)}
                                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#0095F6] hover:text-white text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                              >
                                <Sliders className="h-3 w-3" />
                                Clip
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
