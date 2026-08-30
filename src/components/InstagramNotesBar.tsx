import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { InstagramNote } from "../types";
import { 
  Plus, Music, X, Send, Trash2, Sparkles, MessageCircle, Check,
  Play, Pause, Volume2, VolumeX, Disc, Radio, RefreshCw, Upload,
  Heart, Star, Users, Flame, Smile, ShieldCheck, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playSound } from "../utils/sound";
import { MusicPickerModal } from "./MusicPickerModal";

interface InstagramNotesBarProps {
  onSelectUserForChat?: (user: { id: number; username: string; avatar_url: string; bio: string }) => void;
  accentColor?: string;
}

const EMOJI_OPTIONS = ["💭", "🔥", "🎵", "☕", "✨", "🎮", "💡", "🏖️", "💻", "🚀", "❤️", "⚡", "😴", "🎧", "🍕", "🦾"];
const QUICK_REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "😢", "👏", "😍", "💯"];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export const InstagramNotesBar: React.FC<InstagramNotesBarProps> = ({ 
  onSelectUserForChat,
  accentColor = "#0095F6"
}) => {
  const { user, fetchWithAuth, socket } = useAuth();
  const [notes, setNotes] = useState<InstagramNote[]>([]);
  const [myNote, setMyNote] = useState<InstagramNote | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & Popups
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMusicPickerOpen, setIsMusicPickerOpen] = useState(false);
  const [selectedFriendNote, setSelectedFriendNote] = useState<InstagramNote | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  // Form State for creating/editing note
  const [noteText, setNoteText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("💭");
  const [musicTrack, setMusicTrack] = useState("");
  const [musicTitle, setMusicTitle] = useState("");
  const [musicArtist, setMusicArtist] = useState("");
  const [musicUrl, setMusicUrl] = useState("");
  const [musicCover, setMusicCover] = useState("");
  const [musicStartTime, setMusicStartTime] = useState<number>(0);
  const [audience, setAudience] = useState<"followers" | "close_friends">("followers");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio Playback State for Notes
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(30);
  const noteAudioRef = useRef<HTMLAudioElement | null>(null);

  const loadNotes = async () => {
    try {
      const data = await fetchWithAuth("/api/notes");
      if (data) {
        setMyNote(data.my_note || null);
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.warn("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();

    // Real-time socket events for notes & likes
    if (socket) {
      const handleNoteUpdated = (updatedNote: InstagramNote) => {
        setNotes((prev) => {
          const filtered = prev.filter((n) => n.user_id !== updatedNote.user_id);
          return [updatedNote, ...filtered];
        });
        if (user && updatedNote.user_id === user.id) {
          setMyNote(updatedNote);
        }
        if (selectedFriendNote && selectedFriendNote.id === updatedNote.id) {
          setSelectedFriendNote(updatedNote);
        }
      };

      const handleNoteDeleted = ({ user_id }: { user_id: number }) => {
        setNotes((prev) => prev.filter((n) => n.user_id !== user_id));
        if (user && user_id === user.id) {
          setMyNote(null);
        }
        if (selectedFriendNote && selectedFriendNote.user_id === user_id) {
          setSelectedFriendNote(null);
        }
      };

      const handleNoteLiked = ({ note_id, user_id, is_liked, likes_count }: any) => {
        setNotes((prev) =>
          prev.map((n) => {
            if (n.id === note_id) {
              return {
                ...n,
                likes_count: likes_count,
                is_liked: user && user.id === user_id ? is_liked : n.is_liked
              };
            }
            return n;
          })
        );

        if (myNote && myNote.id === note_id) {
          setMyNote((prev) => (prev ? { ...prev, likes_count, is_liked: user && user.id === user_id ? is_liked : prev.is_liked } : null));
        }

        if (selectedFriendNote && selectedFriendNote.id === note_id) {
          setSelectedFriendNote((prev) => (prev ? { ...prev, likes_count, is_liked: user && user.id === user_id ? is_liked : prev.is_liked } : null));
        }
      };

      socket.on("note_updated", handleNoteUpdated);
      socket.on("note_deleted", handleNoteDeleted);
      socket.on("note_liked", handleNoteLiked);

      return () => {
        socket.off("note_updated", handleNoteUpdated);
        socket.off("note_deleted", handleNoteDeleted);
        socket.off("note_liked", handleNoteLiked);
      };
    }
  }, [socket, user, selectedFriendNote]);

  // Audio Playback Cleanup
  useEffect(() => {
    return () => {
      if (noteAudioRef.current) {
        noteAudioRef.current.pause();
        noteAudioRef.current = null;
      }
    };
  }, []);

  const handleToggleNoteAudio = (audioUrl: string, startTime = 0, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound("click");

    if (playingAudioUrl === audioUrl && isPlaying) {
      if (noteAudioRef.current) {
        noteAudioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    if (noteAudioRef.current) {
      noteAudioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";
    audio.muted = isMuted;
    audio.volume = 0.85;

    audio.onloadedmetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setPlaybackDuration(audio.duration);
      }
      if (startTime > 0 && startTime < audio.duration) {
        audio.currentTime = startTime;
      }
    };

    audio.ontimeupdate = () => {
      setPlaybackCurrentTime(audio.currentTime);
      if (audio.duration && isFinite(audio.duration)) {
        setPlaybackDuration(audio.duration);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackCurrentTime(0);
    };

    audio.onerror = () => {
      console.warn("Note audio failed to play");
      setIsPlaying(false);
    };

    audio.play().catch((err) => {
      console.warn("Audio playback prevented:", err);
      setIsPlaying(false);
    });

    noteAudioRef.current = audio;
    setPlayingAudioUrl(audioUrl);
    setIsPlaying(true);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound("toggle");
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (noteAudioRef.current) {
      noteAudioRef.current.muted = nextMute;
    }
  };

  const handleOpenMyNote = () => {
    playSound("click");
    if (myNote) {
      setNoteText(myNote.text);
      setSelectedEmoji(myNote.mood_emoji || "💭");
      setMusicTrack(myNote.music_track || "");
      setMusicTitle(myNote.music_title || "");
      setMusicArtist(myNote.music_artist || "");
      setMusicUrl(myNote.music_url || "");
      setMusicCover(myNote.music_cover || "");
      setMusicStartTime(myNote.music_start_time || 0);
      setAudience(myNote.audience === "close_friends" ? "close_friends" : "followers");
    } else {
      setNoteText("");
      setSelectedEmoji("💭");
      setMusicTrack("");
      setMusicTitle("");
      setMusicArtist("");
      setMusicUrl("");
      setMusicCover("");
      setMusicStartTime(0);
      setAudience("followers");
    }
    setIsCreateModalOpen(true);
  };

  const handleSelectTrackFromPicker = (track: {
    music_track: string;
    music_title: string;
    music_artist: string;
    music_url: string;
    music_cover: string;
    music_start_time?: number;
  }) => {
    setMusicTrack(track.music_track);
    setMusicTitle(track.music_title);
    setMusicArtist(track.music_artist);
    setMusicUrl(track.music_url);
    setMusicCover(track.music_cover);
    setMusicStartTime(track.music_start_time || 0);
  };

  const handleRemoveMusic = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound("pop");
    setMusicTrack("");
    setMusicTitle("");
    setMusicArtist("");
    setMusicUrl("");
    setMusicCover("");
    setMusicStartTime(0);
  };

  const handleShareNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          text: noteText.trim().slice(0, 60),
          mood_emoji: selectedEmoji,
          music_track: musicTrack.trim(),
          music_title: musicTitle.trim(),
          music_artist: musicArtist.trim(),
          music_url: musicUrl.trim(),
          music_cover: musicCover.trim(),
          music_start_time: musicStartTime,
          audience
        })
      });

      if (res && res.note) {
        setMyNote(res.note);
        setNotes((prev) => {
          const filtered = prev.filter((n) => n.user_id !== res.note.user_id);
          return [res.note, ...filtered];
        });
        playSound("pop");
        setIsCreateModalOpen(false);
      }
    } catch (err: any) {
      console.error("Failed to share note:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async () => {
    try {
      await fetchWithAuth("/api/notes", { method: "DELETE" });
      setMyNote(null);
      if (user) {
        setNotes((prev) => prev.filter((n) => n.user_id !== user.id));
      }
      playSound("click");
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  // Toggle Like on a note
  const handleToggleLikeNote = async (note: InstagramNote, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playSound("like");
    
    // Heart burst animation
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 900);

    const isCurrentlyLiked = Boolean(note.is_liked);
    const updatedCount = isCurrentlyLiked ? Math.max(0, (note.likes_count || 1) - 1) : (note.likes_count || 0) + 1;

    // Optimistic update
    const updatedNote = { ...note, is_liked: !isCurrentlyLiked, likes_count: updatedCount };
    if (selectedFriendNote?.id === note.id) setSelectedFriendNote(updatedNote);
    if (myNote?.id === note.id) setMyNote(updatedNote);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updatedNote : n)));

    try {
      const res = await fetchWithAuth(`/api/notes/${note.id}/like`, { method: "POST" });
      if (res && res.success) {
        const finalNote = { ...note, is_liked: res.is_liked, likes_count: res.likes_count };
        if (selectedFriendNote?.id === note.id) setSelectedFriendNote(finalNote);
        if (myNote?.id === note.id) setMyNote(finalNote);
        setNotes((prev) => prev.map((n) => (n.id === note.id ? finalNote : n)));
      }
    } catch (err) {
      console.error("Failed to toggle note like:", err);
    }
  };

  // Send Direct Message Reply
  const handleSendReply = async (customMessage?: string) => {
    const textToSend = customMessage || replyText.trim();
    if (!selectedFriendNote || !textToSend) return;

    setIsSendingReply(true);
    try {
      const messagePayload = `Replying to your note "${selectedFriendNote.text}": ${textToSend}`;
      await fetchWithAuth("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({
          receiver_id: selectedFriendNote.user_id,
          message_text: messagePayload
        })
      });

      playSound("pop");
      setReplyText("");
      const targetFriend = {
        id: selectedFriendNote.user_id,
        username: selectedFriendNote.username,
        avatar_url: selectedFriendNote.avatar_url,
        bio: selectedFriendNote.text
      };
      setSelectedFriendNote(null);
      if (onSelectUserForChat) {
        onSelectUserForChat(targetFriend);
      }
    } catch (err) {
      console.error("Failed to reply to note:", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  if (!user) return null;

  const otherUserNotes = notes.filter((n) => n.user_id !== user.id);

  return (
    <div className="w-full py-1.5 px-3 select-none">
      {/* Horizontal Instagram Notes Carousel */}
      <div className="flex items-start gap-4 overflow-x-auto pb-2 pt-7 scrollbar-none">
        
        {/* ====================================================================
            1. CURRENT USER'S NOTE BUBBLE
            ==================================================================== */}
        <div className="flex flex-col items-center shrink-0 relative group">
          {/* Floating Thought Bubble above avatar with authentic pointer tail */}
          <button
            type="button"
            id="user-note-bubble-btn"
            onClick={handleOpenMyNote}
            className={`absolute -top-7 z-10 max-w-[125px] px-3 py-1.5 rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex flex-col items-center transition-all transform hover:scale-105 active:scale-95 cursor-pointer border ${
              myNote?.audience === "close_friends"
                ? "bg-[#102414] border-emerald-500/50 text-emerald-300"
                : "bg-[#262626] hover:bg-[#303030] border-white/20 text-white"
            }`}
          >
            {myNote ? (
              <div className="flex flex-col items-center max-w-[110px]">
                <div className="flex items-center gap-1 overflow-hidden">
                  <span className="text-xs">{myNote.mood_emoji || "💭"}</span>
                  <span className="text-[11px] font-semibold truncate max-w-[80px]">
                    {myNote.text}
                  </span>
                </div>
                {(myNote.music_track || myNote.music_title) && (
                  <div className="flex items-center gap-1 text-[9px] text-[#0095F6] mt-0.5 truncate max-w-[100px]">
                    <Music className="h-2.5 w-2.5 shrink-0 animate-bounce" />
                    <span className="truncate">{myNote.music_title || myNote.music_track}</span>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-neutral-400 font-medium truncate">
                Share a thought...
              </span>
            )}

            {/* Speech bubble tail dot connector to avatar */}
            <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border ${
              myNote?.audience === "close_friends"
                ? "bg-[#102414] border-emerald-500/50"
                : "bg-[#262626] border-white/20"
            }`} />
            <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full border ${
              myNote?.audience === "close_friends"
                ? "bg-[#102414] border-emerald-500/50"
                : "bg-[#262626] border-white/20"
            }`} />
          </button>

          {/* User Avatar with '+' or Close Friends Badge */}
          <div 
            onClick={handleOpenMyNote}
            className="relative cursor-pointer transition-transform duration-150 active:scale-95 mt-1"
          >
            <img
              src={user.avatar_url}
              alt={user.username}
              referrerPolicy="no-referrer"
              className={`w-15 h-15 rounded-full object-cover shadow-md transition-all ${
                myNote?.audience === "close_friends"
                  ? "border-[2.5px] border-emerald-500 ring-2 ring-emerald-500/30"
                  : "border-2 border-white/10 group-hover:border-[#0095F6]"
              }`}
            />
            {!myNote ? (
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#0095F6] text-white flex items-center justify-center border-2 border-black shadow-md">
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
              </div>
            ) : myNote.audience === "close_friends" ? (
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-black shadow-md">
                <Star className="h-3 w-3 fill-white" />
              </div>
            ) : null}
          </div>

          <span className="text-[11.5px] font-medium text-neutral-300 mt-1.5 text-center max-w-[70px] truncate">
            Your note
          </span>
        </div>

        {/* ====================================================================
            2. FRIENDS' / OTHER USERS' NOTES BUBBLES
            ==================================================================== */}
        {otherUserNotes.map((item) => {
          const isCloseFriend = item.audience === "close_friends";

          return (
            <div 
              key={`note-${item.id}-${item.user_id}`}
              className="flex flex-col items-center shrink-0 relative group"
            >
              {/* Floating Note Thought Bubble */}
              <button
                type="button"
                onClick={() => {
                  playSound("click");
                  setSelectedFriendNote(item);
                  if (item.music_url) {
                    handleToggleNoteAudio(item.music_url, item.music_start_time || 0);
                  }
                }}
                className={`absolute -top-7 z-10 max-w-[130px] px-3 py-1.5 rounded-[18px] shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex flex-col items-center transition-all transform hover:scale-105 active:scale-95 cursor-pointer border ${
                  isCloseFriend
                    ? "bg-[#102414] border-emerald-500/50 text-emerald-300"
                    : "bg-[#262626] hover:bg-[#303030] border-white/20 text-white"
                }`}
              >
                <div className="flex items-center gap-1 overflow-hidden max-w-[110px]">
                  <span className="text-xs">{item.mood_emoji || "💭"}</span>
                  <span className="text-[11px] font-semibold truncate max-w-[85px]">
                    {item.text}
                  </span>
                </div>
                {(item.music_track || item.music_title) && (
                  <div className="flex items-center gap-1 text-[9px] text-[#0095F6] mt-0.5 truncate max-w-[105px]">
                    <Music className="h-2.5 w-2.5 shrink-0 animate-bounce" />
                    <span className="truncate">{item.music_title || item.music_track}</span>
                  </div>
                )}

                {/* Speech bubble tail dots */}
                <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border ${
                  isCloseFriend
                    ? "bg-[#102414] border-emerald-500/50"
                    : "bg-[#262626] border-white/20"
                }`} />
                <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full border ${
                  isCloseFriend
                    ? "bg-[#102414] border-emerald-500/50"
                    : "bg-[#262626] border-white/20"
                }`} />
              </button>

              {/* Friend Avatar */}
              <div
                onClick={() => {
                  playSound("click");
                  setSelectedFriendNote(item);
                  if (item.music_url) {
                    handleToggleNoteAudio(item.music_url, item.music_start_time || 0);
                  }
                }}
                className="relative cursor-pointer transition-transform duration-150 active:scale-95 mt-1"
              >
                <img
                  src={item.avatar_url}
                  alt={item.username}
                  referrerPolicy="no-referrer"
                  className={`w-15 h-15 rounded-full object-cover shadow-md transition-all ${
                    isCloseFriend
                      ? "border-[2.5px] border-emerald-500 ring-2 ring-emerald-500/30"
                      : "border-2 border-white/15 group-hover:border-[#0095F6]"
                  }`}
                />
                {item.username === "raynai" ? (
                  <div className="absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-[#FF7A00] to-[#FF0080] text-white flex items-center justify-center border-2 border-black text-[8px] font-bold">
                    AI
                  </div>
                ) : isCloseFriend ? (
                  <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-black shadow-md">
                    <Star className="h-3 w-3 fill-white" />
                  </div>
                ) : null}
              </div>

              <span className="text-[11.5px] font-medium text-neutral-300 mt-1.5 text-center max-w-[70px] truncate flex items-center justify-center gap-0.5">
                {item.username}
              </span>
            </div>
          );
        })}
      </div>

      {/* ====================================================================
          MODAL: CREATE / EDIT YOUR INSTAGRAM NOTE (AUTHENTIC INSTAGRAM MOBILE FLOW)
          ==================================================================== */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-sm bg-[#121214] border-t sm:border border-white/10 rounded-t-[34px] sm:rounded-[30px] p-5 shadow-2xl relative text-white max-h-[92vh] overflow-y-auto"
            >
              {/* Top Navigation Bar: Cancel on left, Share in blue on right */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <button
                  type="button"
                  id="note-modal-cancel-btn"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-sm font-semibold text-neutral-300 hover:text-white cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <span className="text-sm font-bold text-white">New Note</span>

                <button
                  type="button"
                  id="note-modal-share-btn"
                  onClick={handleShareNote}
                  disabled={isSubmitting || !noteText.trim()}
                  className="text-sm font-bold text-[#0095F6] hover:text-[#25A6FF] disabled:opacity-40 cursor-pointer transition-colors"
                >
                  {isSubmitting ? "Sharing..." : "Share"}
                </button>
              </div>

              <form onSubmit={handleShareNote} className="flex flex-col items-center pt-5 pb-2">
                {/* Centered User Avatar with Floating Editable Note Thought Bubble */}
                <div className="relative mb-5 flex flex-col items-center">
                  {/* Floating Speech Bubble with active input */}
                  <div className={`mb-3 px-4 py-2.5 rounded-[22px] shadow-2xl flex flex-col items-center border relative max-w-[240px] w-full ${
                    audience === "close_friends"
                      ? "bg-[#102414] border-emerald-500/50"
                      : "bg-[#262626] border-white/20"
                  }`}>
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-base">{selectedEmoji}</span>
                      <input
                        type="text"
                        autoFocus
                        required
                        maxLength={60}
                        placeholder="Share a thought..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        className="bg-transparent border-none text-xs text-white placeholder-neutral-400 focus:outline-hidden w-full font-medium"
                      />
                    </div>
                    <span className="text-[9px] text-neutral-500 self-end mt-0.5 font-mono">
                      {noteText.length}/60
                    </span>

                    {/* Speech Bubble pointer dots */}
                    <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border ${
                      audience === "close_friends" ? "bg-[#102414] border-emerald-500/50" : "bg-[#262626] border-white/20"
                    }`} />
                    <div className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full border ${
                      audience === "close_friends" ? "bg-[#102414] border-emerald-500/50" : "bg-[#262626] border-white/20"
                    }`} />
                  </div>

                  {/* Circular Avatar */}
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    referrerPolicy="no-referrer"
                    className={`w-20 h-20 rounded-full object-cover shadow-xl ${
                      audience === "close_friends"
                        ? "border-3 border-emerald-500 ring-4 ring-emerald-500/20"
                        : "border-2 border-white/20"
                    }`}
                  />
                </div>

                {/* Mood Emoji Picker Row */}
                <div className="w-full mb-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none justify-center">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => setSelectedEmoji(emoji)}
                        className={`text-lg p-1.5 rounded-xl transition-all active:scale-90 cursor-pointer ${
                          selectedEmoji === emoji ? "bg-[#0095F6]/20 border border-[#0095F6] scale-115" : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Instagram Attached Music Pill or "+ Music" Button */}
                <div className="w-full mb-4">
                  {musicTrack ? (
                    <div className="p-3 bg-[#1C1C1E] border border-white/15 rounded-2xl flex items-center justify-between gap-3 shadow-md">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {musicCover ? (
                          <img
                            src={musicCover}
                            alt="Track cover"
                            className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FFD600] to-[#7638FA] flex items-center justify-center shrink-0">
                            <Music className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {musicTitle || musicTrack}
                          </p>
                          <p className="text-[10px] text-neutral-400 truncate">
                            {musicArtist || "Instagram Music"} • Clip: {formatTime(musicStartTime)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {musicUrl && (
                          <button
                            type="button"
                            onClick={(e) => handleToggleNoteAudio(musicUrl, musicStartTime, e)}
                            className="p-2 rounded-full bg-[#0095F6] hover:bg-[#0081D6] text-white transition-colors cursor-pointer shadow-md"
                          >
                            {isPlaying && playingAudioUrl === musicUrl ? (
                              <Pause className="h-3.5 w-3.5 fill-white" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsMusicPickerOpen(true)}
                          className="text-[10.5px] font-semibold text-[#0095F6] hover:underline px-1.5 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveMusic}
                          className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id="note-add-music-btn"
                      onClick={() => setIsMusicPickerOpen(true)}
                      className="w-full py-2.5 px-3 bg-[#1C1C1E] hover:bg-[#252528] border border-white/15 rounded-2xl flex items-center justify-center gap-2 text-xs text-white font-semibold transition-all cursor-pointer shadow-sm active:scale-98"
                    >
                      <Music className="h-4 w-4 text-[#0095F6]" />
                      <span>Add music...</span>
                    </button>
                  )}
                </div>

                {/* Audience Privacy Control */}
                <div className="w-full mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2 block text-center">
                    Share with
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAudience("followers")}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        audience === "followers"
                          ? "bg-[#0095F6]/15 border-[#0095F6] text-white"
                          : "bg-[#18181A] border-white/5 text-neutral-400 hover:text-white"
                      }`}
                    >
                      <Users className="h-4 w-4 text-[#0095F6]" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">Followers</p>
                        <p className="text-[9px] text-neutral-400 truncate">Who follow back</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAudience("close_friends")}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        audience === "close_friends"
                          ? "bg-emerald-500/15 border-emerald-500 text-white"
                          : "bg-[#18181A] border-white/5 text-neutral-400 hover:text-white"
                      }`}
                    >
                      <Star className="h-4 w-4 text-emerald-400 fill-emerald-400" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-400 truncate">Close Friends</p>
                        <p className="text-[9px] text-neutral-400 truncate">⭐ Green Badge</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Actions: Delete if already exists */}
                {myNote && (
                  <button
                    type="button"
                    onClick={handleDeleteNote}
                    className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Current Note
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL: VIEW & REPLY TO FRIEND'S NOTE (AUTHENTIC INSTAGRAM POPUP)
          ==================================================================== */}
      <AnimatePresence>
        {selectedFriendNote && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-sm bg-[#121214] border-t sm:border border-white/10 rounded-t-[34px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl relative text-white"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  if (noteAudioRef.current) {
                    noteAudioRef.current.pause();
                  }
                  setIsPlaying(false);
                  setSelectedFriendNote(null);
                }}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              {/* Heart Burst Animation on Like */}
              <AnimatePresence>
                {showHeartBurst && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.3, y: 0 }}
                    animate={{ opacity: 1, scale: 1.4, y: -40 }}
                    exit={{ opacity: 0, scale: 1.8, y: -80 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute inset-0 m-auto w-24 h-24 flex items-center justify-center pointer-events-none z-30"
                  >
                    <Heart className="w-24 h-24 text-red-500 fill-red-500 drop-shadow-2xl" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col items-center text-center mb-4">
                {/* Avatar with Big Thought Bubble */}
                <div 
                  onDoubleClick={() => handleToggleLikeNote(selectedFriendNote)}
                  className="relative mb-3 cursor-pointer select-none group"
                >
                  <img
                    src={selectedFriendNote.avatar_url}
                    alt={selectedFriendNote.username}
                    referrerPolicy="no-referrer"
                    className={`w-20 h-20 rounded-full object-cover shadow-xl ${
                      selectedFriendNote.audience === "close_friends"
                        ? "border-3 border-emerald-500 ring-4 ring-emerald-500/20"
                        : "border-3 border-[#0095F6] ring-4 ring-blue-500/20"
                    }`}
                  />
                  
                  {/* Thought Bubble */}
                  <div className={`absolute -top-4 -right-3 px-3.5 py-2 rounded-[20px] text-xs font-semibold flex items-center gap-1.5 shadow-2xl border ${
                    selectedFriendNote.audience === "close_friends"
                      ? "bg-[#102414] border-emerald-500/50 text-emerald-300"
                      : "bg-[#222222] border-white/20 text-white"
                  }`}>
                    <span className="text-base">{selectedFriendNote.mood_emoji}</span>
                    <span className="max-w-[120px] truncate">{selectedFriendNote.text}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base text-white">
                    @{selectedFriendNote.username}
                  </h3>
                  {selectedFriendNote.audience === "close_friends" && (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30 flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 fill-emerald-400" />
                      Close Friends
                    </span>
                  )}
                </div>

                {/* Likes Counter & Like Toggle Button */}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={(e) => handleToggleLikeNote(selectedFriendNote, e)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition-all active:scale-90 cursor-pointer ${
                      selectedFriendNote.is_liked
                        ? "bg-red-500/20 border-red-500/50 text-red-400 shadow-md shadow-red-500/20"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-neutral-300"
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        selectedFriendNote.is_liked ? "text-red-500 fill-red-500" : "text-neutral-300"
                      }`}
                    />
                    <span>
                      {selectedFriendNote.likes_count ? `${selectedFriendNote.likes_count} ${selectedFriendNote.likes_count === 1 ? "like" : "likes"}` : "Like"}
                    </span>
                  </button>
                </div>

                {/* Interactive Music Player Card with Timeline */}
                {(selectedFriendNote.music_track || selectedFriendNote.music_url) && (
                  <div className="w-full mt-3 p-3 bg-[#1A1A1D] border border-white/10 rounded-2xl shadow-inner">
                    <div className="flex items-center gap-3">
                      {/* Spinning Vinyl Cover Art */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 shadow-md ${
                            isPlaying && playingAudioUrl === selectedFriendNote.music_url
                              ? "animate-[spin_4s_linear_infinite]"
                              : ""
                          }`}
                        >
                          <img
                            src={
                              selectedFriendNote.music_cover ||
                              "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=300&h=300&q=80"
                            }
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute inset-0 m-auto w-3 h-3 rounded-full bg-black border border-white/40" />
                      </div>

                      {/* Song & Artist Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-bold text-white truncate">
                          {selectedFriendNote.music_title || selectedFriendNote.music_track}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {selectedFriendNote.music_artist || "Instagram Music"}
                        </p>
                        
                        {/* Audio Progress Bar */}
                        <div className="w-full bg-white/10 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="bg-[#0095F6] h-full transition-all duration-150"
                            style={{
                              width: `${
                                isPlaying && playingAudioUrl === selectedFriendNote.music_url && playbackDuration > 0
                                  ? (playbackCurrentTime / playbackDuration) * 100
                                  : 0
                              }%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Play & Mute Controls */}
                      {selectedFriendNote.music_url && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleToggleNoteAudio(selectedFriendNote.music_url!, selectedFriendNote.music_start_time || 0, e)}
                            className="w-8 h-8 rounded-full bg-[#0095F6] hover:bg-[#0081D6] text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md"
                          >
                            {isPlaying && playingAudioUrl === selectedFriendNote.music_url ? (
                              <Pause className="h-4 w-4 fill-white" />
                            ) : (
                              <Play className="h-4 w-4 fill-white ml-0.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleMute}
                            className="p-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {isMuted ? (
                              <VolumeX className="h-4 w-4 text-red-400" />
                            ) : (
                              <Volume2 className="h-4 w-4 text-neutral-300" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Reactions Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 scrollbar-none">
                  {QUICK_REACTION_EMOJIS.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => handleSendReply(emoji)}
                      className="text-lg p-1.5 rounded-full hover:bg-white/10 transition-transform active:scale-125 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply with DM Input Form */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendReply(); }} className="flex flex-col gap-2.5">
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={`Reply to @${selectedFriendNote.username}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-[#1C1C1E] border border-white/10 rounded-2xl pl-4 pr-12 py-3 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-[#0095F6] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-[#0095F6] hover:bg-[#0081D6] disabled:opacity-40 text-white transition-all cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-neutral-400 px-1">
                  <span>Replies send as a Direct Message</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectUserForChat) {
                        onSelectUserForChat({
                          id: selectedFriendNote.user_id,
                          username: selectedFriendNote.username,
                          avatar_url: selectedFriendNote.avatar_url,
                          bio: selectedFriendNote.text
                        });
                      }
                      setSelectedFriendNote(null);
                    }}
                    className="text-[#0095F6] hover:underline font-bold flex items-center gap-0.5"
                  >
                    Full Chat <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL: INSTAGRAM MUSIC PICKER (ONLINE SEARCH + TIMELINE TRIMMER)
          ==================================================================== */}
      <MusicPickerModal
        isOpen={isMusicPickerOpen}
        onClose={() => setIsMusicPickerOpen(false)}
        onSelectTrack={handleSelectTrackFromPicker}
        currentTrackTitle={musicTitle || musicTrack}
      />
    </div>
  );
};
