import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { InstagramNote } from "../types";
import { Plus, Music, X, Send, Trash2, Sparkles, MessageCircle, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playSound } from "../utils/sound";

interface InstagramNotesBarProps {
  onSelectUserForChat?: (user: { id: number; username: string; avatar_url: string; bio: string }) => void;
  accentColor?: string;
}

const EMOJI_OPTIONS = ["💭", "🔥", "🎵", "☕", "✨", "🎮", "💡", "🏖️", "💻", "🚀", "❤️", "⚡"];

const MUSIC_PRESETS = [
  "Moroccan Lofi Vibes 🎧",
  "Casablanca Sunset Beats 🌅",
  "Late Night Coding 💻",
  "Chill Hip Hop Vibe 🎵",
  "Acoustic Coffee Mood ☕",
  "Gym Motivation 🔥"
];

export const InstagramNotesBar: React.FC<InstagramNotesBarProps> = ({ 
  onSelectUserForChat,
  accentColor = "#0095F6"
}) => {
  const { user, fetchWithAuth, socket } = useAuth();
  const [notes, setNotes] = useState<InstagramNote[]>([]);
  const [myNote, setMyNote] = useState<InstagramNote | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFriendNote, setSelectedFriendNote] = useState<InstagramNote | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Form State
  const [noteText, setNoteText] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("💭");
  const [musicTrack, setMusicTrack] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    // Listen to real-time socket events
    if (socket) {
      const handleNoteUpdated = (updatedNote: InstagramNote) => {
        setNotes((prev) => {
          const filtered = prev.filter((n) => n.user_id !== updatedNote.user_id);
          return [updatedNote, ...filtered];
        });
        if (user && updatedNote.user_id === user.id) {
          setMyNote(updatedNote);
        }
      };

      const handleNoteDeleted = ({ user_id }: { user_id: number }) => {
        setNotes((prev) => prev.filter((n) => n.user_id !== user_id));
        if (user && user_id === user.id) {
          setMyNote(null);
        }
      };

      socket.on("note_updated", handleNoteUpdated);
      socket.on("note_deleted", handleNoteDeleted);

      return () => {
        socket.off("note_updated", handleNoteUpdated);
        socket.off("note_deleted", handleNoteDeleted);
      };
    }
  }, [socket, user]);

  const handleOpenMyNote = () => {
    playSound("click");
    if (myNote) {
      setNoteText(myNote.text);
      setSelectedEmoji(myNote.mood_emoji || "💭");
      setMusicTrack(myNote.music_track || "");
    } else {
      setNoteText("");
      setSelectedEmoji("💭");
      setMusicTrack("");
    }
    setIsCreateModalOpen(true);
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
          music_track: musicTrack.trim()
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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendNote || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const messagePayload = `Replying to your note "${selectedFriendNote.text}": ${replyText.trim()}`;
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

  // Render notes list (My note first, then friends' notes)
  const otherUserNotes = notes.filter((n) => n.user_id !== user.id);

  return (
    <div className="w-full py-3 px-4 select-none">
      {/* Horizontal Notes Carousel */}
      <div className="flex items-start gap-4 overflow-x-auto pb-2 pt-6 scrollbar-none">
        
        {/* ====================================================================
            1. CURRENT USER'S NOTE BUBBLE
            ==================================================================== */}
        <div className="flex flex-col items-center shrink-0 relative group">
          
          {/* Floating Thought Bubble above avatar */}
          <button
            type="button"
            onClick={handleOpenMyNote}
            className="absolute -top-7 z-10 max-w-[90px] px-2.5 py-1 bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-white/15 rounded-2xl shadow-xl flex items-center gap-1 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            {myNote ? (
              <div className="flex items-center gap-1 overflow-hidden">
                <span className="text-xs">{myNote.mood_emoji || "💭"}</span>
                <span className="text-[10px] text-white font-medium truncate max-w-[60px]">
                  {myNote.text}
                </span>
              </div>
            ) : (
              <span className="text-[9px] text-slate-400 font-semibold truncate">
                Share a thought...
              </span>
            )}
            {/* Speech bubble tail dot */}
            <div className="absolute -bottom-1 left-4 w-1.5 h-1.5 bg-[#1E1E1E] border-r border-b border-white/15 rotate-45" />
          </button>

          {/* User Avatar with '+' Badge */}
          <div 
            onClick={handleOpenMyNote}
            className="relative cursor-pointer transition-transform duration-200 active:scale-95 mt-1"
          >
            <img
              src={user.avatar_url}
              alt={user.username}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full object-cover border-2 border-white/10 group-hover:border-[#0095F6] transition-colors shadow-md"
            />
            {!myNote && (
              <div className="absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full bg-[#0095F6] text-white flex items-center justify-center border-2 border-black shadow-md">
                <Plus className="h-3 w-3 stroke-[3]" />
              </div>
            )}
          </div>

          <span className="text-[11px] font-medium text-slate-300 mt-1.5 text-center max-w-[65px] truncate">
            Your note
          </span>
        </div>

        {/* ====================================================================
            2. FRIENDS' / OTHER USERS' NOTES BUBBLES
            ==================================================================== */}
        {otherUserNotes.map((item) => (
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
              }}
              className="absolute -top-7 z-10 max-w-[110px] px-2.5 py-1 bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-white/15 rounded-2xl shadow-xl flex items-center gap-1 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span className="text-xs">{item.mood_emoji || "💭"}</span>
              <span className="text-[10px] text-white font-semibold truncate max-w-[75px]">
                {item.text}
              </span>
              {item.music_track && (
                <Music className="h-2.5 w-2.5 text-[#0095F6] shrink-0 animate-bounce" />
              )}
              {/* Speech bubble tail dot */}
              <div className="absolute -bottom-1 left-4 w-1.5 h-1.5 bg-[#1E1E1E] border-r border-b border-white/15 rotate-45" />
            </button>

            {/* Friend Avatar */}
            <div
              onClick={() => {
                playSound("click");
                setSelectedFriendNote(item);
              }}
              className="relative cursor-pointer transition-transform duration-200 active:scale-95 mt-1"
            >
              <img
                src={item.avatar_url}
                alt={item.username}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover border-2 border-white/15 group-hover:border-[#0095F6] transition-colors shadow-md"
              />
              {item.username === "raynai" && (
                <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-gradient-to-tr from-[#FF7A00] to-[#FF0080] text-white flex items-center justify-center border-2 border-black text-[8px] font-bold">
                  AI
                </div>
              )}
            </div>

            <span className="text-[11px] font-medium text-slate-300 mt-1.5 text-center max-w-[65px] truncate">
              {item.username}
            </span>
          </div>
        ))}
      </div>

      {/* ====================================================================
          MODAL: CREATE / EDIT YOUR INSTAGRAM NOTE
          ==================================================================== */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-[28px] p-6 shadow-2xl relative text-white"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="text-center mb-5">
                <div className="relative inline-block mx-auto mb-2">
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
                  />
                  {/* Floating preview bubble */}
                  {noteText.trim() && (
                    <div className="absolute -top-3 -right-2 px-2.5 py-1 bg-[#222222] border border-white/20 rounded-xl text-[10px] text-white font-medium flex items-center gap-1 shadow-lg max-w-[120px] truncate animate-fade-in">
                      <span>{selectedEmoji}</span>
                      <span className="truncate">{noteText}</span>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-base text-white">Share a thought...</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Followers who you follow back will see your note for 24 hours.
                </p>
              </div>

              <form onSubmit={handleShareNote} className="flex flex-col gap-4">
                {/* Note Input */}
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="Share what's on your mind..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-[#0095F6] transition-colors"
                  />
                  <span className="absolute right-3 top-3 text-[10px] text-slate-500 font-mono">
                    {noteText.length}/60
                  </span>
                </div>

                {/* Mood Emoji Picker */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                    Mood / Emoji
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        onClick={() => setSelectedEmoji(emoji)}
                        className={`text-lg p-2 rounded-xl transition-all active:scale-90 cursor-pointer ${
                          selectedEmoji === emoji ? "bg-[#0095F6]/20 border border-[#0095F6] scale-110" : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Music Vibe */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                    <Music className="h-3 w-3 text-[#0095F6]" />
                    Music Track / Vibe (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Casablanca Sunset Beats 🌅"
                    value={musicTrack}
                    onChange={(e) => setMusicTrack(e.target.value)}
                    maxLength={50}
                    className="w-full bg-[#1C1C1C] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#0095F6]"
                  />
                  
                  {/* Preset track tags */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {MUSIC_PRESETS.slice(0, 3).map((track) => (
                      <button
                        type="button"
                        key={track}
                        onClick={() => setMusicTrack(track)}
                        className="text-[9px] px-2 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                      >
                        {track}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-2 mt-2">
                  {myNote && (
                    <button
                      type="button"
                      onClick={handleDeleteNote}
                      className="px-4 py-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting || !noteText.trim()}
                    className="flex-1 py-3 rounded-xl bg-[#0095F6] hover:bg-[#0081D6] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-500/20 active:scale-98"
                  >
                    {isSubmitting ? "Sharing..." : myNote ? "Update Note" : "Share Note"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================================
          MODAL: VIEW & REPLY TO A FRIEND'S NOTE (INSTAGRAM DIRECT STYLE)
          ==================================================================== */}
      <AnimatePresence>
        {selectedFriendNote && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-[28px] p-6 shadow-2xl relative text-white"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedFriendNote(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="flex flex-col items-center text-center mb-6">
                <div className="relative mb-3">
                  <img
                    src={selectedFriendNote.avatar_url}
                    alt={selectedFriendNote.username}
                    referrerPolicy="no-referrer"
                    className="w-18 h-18 rounded-full object-cover border-2 border-[#0095F6] shadow-lg"
                  />
                  <div className="absolute -top-3 -right-2 px-3 py-1.5 bg-[#1F1F1F] border border-white/20 rounded-2xl text-xs text-white font-semibold flex items-center gap-1.5 shadow-xl">
                    <span className="text-sm">{selectedFriendNote.mood_emoji}</span>
                    <span>{selectedFriendNote.text}</span>
                  </div>
                </div>

                <h3 className="font-bold text-base text-white">
                  @{selectedFriendNote.username}
                </h3>
                {selectedFriendNote.music_track && (
                  <div className="flex items-center gap-1 text-[11px] text-[#0095F6] font-medium mt-1 bg-[#0095F6]/10 px-2.5 py-0.5 rounded-full border border-[#0095F6]/20">
                    <Music className="h-3 w-3 animate-bounce" />
                    <span>{selectedFriendNote.music_track}</span>
                  </div>
                )}
              </div>

              {/* Reply with DM Input Form */}
              <form onSubmit={handleSendReply} className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder={`Reply to @${selectedFriendNote.username}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-white/10 rounded-2xl pl-4 pr-12 py-3 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-[#0095F6] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSendingReply || !replyText.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-[#0095F6] hover:bg-[#0081D6] disabled:opacity-40 text-white transition-all cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
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
                    className="text-[#0095F6] hover:underline font-bold"
                  >
                    Open Full Chat →
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
