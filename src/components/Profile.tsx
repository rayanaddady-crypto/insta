import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { Profile as ProfileType, FeedPost, ReelPost } from "../types";
import { 
  Grid, 
  Film, 
  Edit3, 
  X, 
  LogOut, 
  MessageCircle, 
  AlertCircle, 
  Lock, 
  Shield, 
  Bookmark, 
  Sparkles, 
  Check, 
  Heart, 
  Copy, 
  Share2, 
  MapPin, 
  Link2, 
  Calendar, 
  User as UserIcon, 
  MoreVertical, 
  VolumeX, 
  Volume2, 
  Flag, 
  ShieldOff,
  Upload,
  Scissors,
  ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ProfileProps {
  targetUsername?: string | null;
  onNavigateToMessage: (user: { id: number; username: string; avatar_url: string; bio: string }) => void;
  onClearTargetUsername: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ 
  targetUsername, 
  onNavigateToMessage,
  onClearTargetUsername 
}) => {
  const { user, logout, fetchWithAuth, updateUser, triggerToast, theme } = useAuth();
  
  const isEligibleForGif = user?.email?.toLowerCase() === "rayane@gmail.com" || 
                           user?.username?.toLowerCase() === "rayane" || 
                           user?.username?.toLowerCase() === "rayanee";
  
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [reels, setReels] = useState<ReelPost[]>([]);
  const [bookmarks, setBookmarks] = useState<(FeedPost | ReelPost)[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab switching: "posts" or "reels" or "bookmarks" or "owner"
  const [activeTab, setActiveTab] = useState<"posts" | "reels" | "bookmarks" | "owner">("posts");

  // Owner admin dashboard states
  const [ownerStats, setOwnerStats] = useState<any>(null);
  const [ownerUsers, setOwnerUsers] = useState<any[]>([]);
  const [broadcastText, setBroadcastText] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [loadingOwnerData, setLoadingOwnerData] = useState(false);

  // Options Dropdown State
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  // Edit Profile Dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editedBio, setEditedBio] = useState("");
  const [editedAvatar, setEditedAvatar] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedWebsite, setEditedWebsite] = useState("");
  const [editedGender, setEditedGender] = useState("");
  const [editedLocation, setEditedLocation] = useState("");
  const [editedBirthday, setEditedBirthday] = useState("");
  const [editedIsPrivate, setEditedIsPrivate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Giphy Search & Explorer States
  const [giphySearchQuery, setGiphySearchQuery] = useState("");
  const [giphyGifs, setGiphyGifs] = useState<any[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);

  // Interactive Client-Side Avatar Cropper States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropX, setCropX] = useState<number>(0);
  const [cropY, setCropY] = useState<number>(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Expanded Post Modal state
  const [selectedMediaPost, setSelectedMediaPost] = useState<FeedPost | ReelPost | null>(null);

  const fetchOwnerData = async () => {
    setLoadingOwnerData(true);
    try {
      const statsRes = await fetchWithAuth("/api/owner/stats");
      setOwnerStats(statsRes.stats);
      
      const usersRes = await fetchWithAuth("/api/owner/users");
      setOwnerUsers(usersRes.users || []);
    } catch (err) {
      console.error("Failed to fetch owner metrics:", err);
      triggerToast("Failed to fetch administrative metrics.", "error");
    } finally {
      setLoadingOwnerData(false);
    }
  };

  useEffect(() => {
    if (activeTab === "owner") {
      fetchOwnerData();
    }
  }, [activeTab]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setIsBroadcasting(true);
    try {
      await fetchWithAuth("/api/owner/broadcast", {
        method: "POST",
        body: JSON.stringify({ messageText: broadcastText })
      });
      triggerToast("Broadcast announcement sent to all users!", "success");
      setBroadcastText("");
    } catch (err: any) {
      triggerToast(err.message || "Failed to broadcast announcement", "error");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleToggleVerify = async (targetUserId: number, currentVerify: boolean) => {
    try {
      await fetchWithAuth("/api/owner/verify", {
        method: "POST",
        body: JSON.stringify({ targetUserId, verify: !currentVerify })
      });
      triggerToast(`Verification updated successfully!`, "success");
      setOwnerUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, is_verified: !currentVerify ? 1 : 0 } : u));
    } catch (err: any) {
      triggerToast(err.message || "Failed to update verification", "error");
    }
  };

  const lookupUsername = targetUsername || user?.username;

  const loadProfile = async () => {
    if (!lookupUsername) return;
    setLoading(true);
    try {
      const data = await fetchWithAuth(`/api/users/${lookupUsername}`);
      setProfile(data.profile);
      setPosts(data.posts);
      setReels(data.reels);
      
      if (data.profile.is_current_user) {
        const bmData = await fetchWithAuth("/api/bookmarks");
        setBookmarks(bmData.bookmarks);
      }
      
      // Initialize edit fields with current values
      setEditedBio(data.profile.bio || "");
      setEditedAvatar(data.profile.avatar_url || "");
      setEditedName(data.profile.name || "");
      setEditedWebsite(data.profile.website || "");
      setEditedGender(data.profile.gender || "");
      setEditedLocation(data.profile.location || "");
      setEditedBirthday(data.profile.birthday || "");
      setEditedIsPrivate(data.profile.is_private || false);
    } catch (err: any) {
      if (err.message === "Session expired. Please log in again.") {
        console.warn("Session expired. Redirecting to login.");
      } else {
        console.error("Failed to load profile:", err);
        triggerToast("Error retrieving luxury profile details", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();

    const handleRefresh = () => {
      loadProfile();
    };
    window.addEventListener("refresh-data", handleRefresh);
    return () => {
      window.removeEventListener("refresh-data", handleRefresh);
    };
  }, [targetUsername, lookupUsername]);

  const fetchTrendingGifs = async () => {
    setGiphyLoading(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC&limit=12`);
      if (res.ok) {
        const data = await res.json();
        const gifs = data.data?.map((g: any) => ({
          id: g.id,
          title: g.title,
          url: g.images?.fixed_height?.url || g.images?.original?.url
        })) || [];
        setGiphyGifs(gifs);
      }
    } catch (err) {
      console.error("Giphy trending error:", err);
    } finally {
      setGiphyLoading(false);
    }
  };

  const handleGiphySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giphySearchQuery.trim()) {
      fetchTrendingGifs();
      return;
    }
    setGiphyLoading(true);
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(giphySearchQuery.trim())}&limit=12`);
      if (res.ok) {
        const data = await res.json();
        const gifs = data.data?.map((g: any) => ({
          id: g.id,
          title: g.title,
          url: g.images?.fixed_height?.url || g.images?.original?.url
        })) || [];
        setGiphyGifs(gifs);
      }
    } catch (err) {
      console.error("Giphy search error:", err);
    } finally {
      setGiphyLoading(false);
    }
  };

  useEffect(() => {
    if (isEditOpen) {
      fetchTrendingGifs();
    }
  }, [isEditOpen]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    try {
      const response = await fetchWithAuth(`/api/users/${profile.id}/follow`, {
        method: "POST"
      });

      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          is_following: response.is_following,
          follow_status: response.follow_status,
          followers_count: response.followers_count
        };
      });

      if (response.follow_status === "pending") {
        triggerToast("Access requested. Awaiting approval!", "success");
      } else if (response.follow_status === "accepted") {
        triggerToast(`Connected with @${profile.username}!`, "success");
      } else {
        triggerToast(`Disconnected @${profile.username}.`, "info");
      }

      loadProfile();
    } catch (err: any) {
      triggerToast(err.message || "Failed to alter follow status", "error");
    }
  };

  // HTML5 Interactive Canvas Cropping Engine
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isGif = file.type === "image/gif" || file.name?.toLowerCase().endsWith(".gif");
      if (isGif && !isEligibleForGif) {
        triggerToast("Animated GIF profiles are exclusive to Creator Rayan!", "error");
        e.target.value = ""; // Reset file selection
        return;
      }
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const cropAndCompressImage = (): Promise<string> => {
    return new Promise((resolve) => {
      // If a file was uploaded and it's a GIF, bypass canvas completely to preserve all animation frames
      if (uploadFile && previewSrc) {
        const isGif = 
          uploadFile.type === "image/gif" ||
          uploadFile.name?.toLowerCase().endsWith(".gif") ||
          previewSrc.startsWith("data:image/gif") ||
          previewSrc.includes("image/gif") ||
          previewSrc.includes("R0lGOD");

        if (isGif) {
          let gifUri = previewSrc;
          if (gifUri.includes("R0lGOD") && !gifUri.startsWith("data:image/gif")) {
            const base64Index = gifUri.indexOf("base64,");
            if (base64Index !== -1) {
              gifUri = "data:image/gif;base64," + gifUri.substring(base64Index + 7);
            }
          }
          resolve(gifUri);
          return;
        }
      }

      // If user provided a URL or preset
      if (!uploadFile && editedAvatar) {
        resolve(editedAvatar);
        return;
      }

      if (!previewSrc || !canvasRef.current || !imageRef.current) {
        resolve(editedAvatar || "");
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = imageRef.current;

      if (!ctx) {
        resolve(editedAvatar || previewSrc || "");
        return;
      }

      // Set canvas to standardized premium profile size (300x300)
      canvas.width = 300;
      canvas.height = 300;

      // Draw standard cropped image centered based on zoom sliders
      const size = Math.min(img.naturalWidth, img.naturalHeight) / cropZoom;
      const sx = (img.naturalWidth - size) / 2 + cropX;
      const sy = (img.naturalHeight - size) / 2 + cropY;

      ctx.drawImage(
        img,
        Math.max(0, sx),
        Math.max(0, sy),
        size,
        size,
        0,
        0,
        300,
        300
      );

      // Perform high quality compression (90% quality JPEG)
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        } else {
          resolve(editedAvatar || previewSrc || "");
        }
      }, "image/jpeg", 0.90);
    });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      // Security check: GIFs are exclusive to Rayan
      const isGifUpload = uploadFile && (
        uploadFile.type === "image/gif" || 
        uploadFile.name?.toLowerCase().endsWith(".gif")
      );

      const isGifUrl = editedAvatar && (
        editedAvatar.toLowerCase().includes(".gif") || 
        editedAvatar.toLowerCase().includes("giphy")
      );

      if ((isGifUpload || isGifUrl) && !isEligibleForGif) {
        throw new Error("Animated GIF profile pictures are exclusive to Platform Creator Rayan! Standard accounts are limited to JPEG/PNG portraits.");
      }

      let finalAvatar = "";
      
      // If a file was selected from disk/gallery, upload directly to /api/upload to preserve animated GIFs and raw files
      if (uploadFile) {
        try {
          const formData = new FormData();
          formData.append("file", uploadFile);
          const token = localStorage.getItem("instaclone_token");
          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            if (uploadData.url) {
              finalAvatar = uploadData.url;
            }
          }
        } catch (uploadErr) {
          console.error("Direct file upload error:", uploadErr);
        }
      }

      // Fallback to cropAndCompressImage or editedAvatar URL
      if (!finalAvatar) {
        finalAvatar = await cropAndCompressImage();
      }

      const response = await fetchWithAuth("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: editedName,
          bio: editedBio,
          avatar_url: finalAvatar,
          website: editedWebsite,
          gender: editedGender,
          location: editedLocation,
          birthday: editedBirthday,
          is_private: editedIsPrivate
        })
      });

      updateUser(response.user);
      setIsEditOpen(false);
      setUploadFile(null);
      setPreviewSrc(null);
      triggerToast("Luxe profile synchronized successfully!", "success");
      loadProfile();
    } catch (err: any) {
      triggerToast(err.message || "Failed to edit profile", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // Extra Features Action Triggers
  const handleCopyProfile = () => {
    const profileUrl = `${window.location.origin}/@${profile?.username}`;
    navigator.clipboard.writeText(profileUrl);
    triggerToast("Luxury profile URL copied to clipboard!", "success");
  };

  const handleShareProfile = () => {
    const shareUrl = `${window.location.origin}/@${profile?.username}`;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.name || profile?.username} on Raynista`,
        text: `Check out @${profile?.username}'s luxury portfolio on Raynista!`,
        url: shareUrl
      }).catch(err => console.error(err));
    } else {
      handleCopyProfile();
    }
  };

  const handleMuteToggle = async () => {
    if (!profile) return;
    try {
      await fetchWithAuth(`/api/users/${profile.id}/mute`, { method: "POST" });
      triggerToast(`Muted notifications from @${profile.username}`, "success");
      setIsOptionsOpen(false);
    } catch (err) {
      triggerToast("Failed to mute profile", "error");
    }
  };

  const handleBlockUser = async () => {
    if (!profile) return;
    try {
      await fetchWithAuth(`/api/users/${profile.id}/block`, { method: "POST" });
      triggerToast(`Successfully blocked @${profile.username}`, "info");
      setIsOptionsOpen(false);
      onClearTargetUsername();
    } catch (err) {
      triggerToast("Failed to block user", "error");
    }
  };

  const handleReportUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !reportReason.trim()) return;
    try {
      await fetchWithAuth(`/api/reports`, {
        method: "POST",
        body: JSON.stringify({
          reported_id: profile.id,
          reason: reportReason.trim()
        })
      });
      triggerToast(`Report filed successfully. Thank you.`, "success");
      setIsReportOpen(false);
      setIsOptionsOpen(false);
      setReportReason("");
    } catch (err) {
      triggerToast("Failed to file report", "error");
    }
  };

  return (
    <div id="profile-container" className="max-w-5xl mx-auto px-4 py-8 text-slate-800 dark:text-white min-h-screen">
      
      {/* Return back indicator */}
      {targetUsername && (
        <button 
          id="back-to-directory"
          onClick={onClearTargetUsername}
          className="mb-6 flex items-center gap-2 text-[10px] font-bold text-[#FF7A00] hover:text-white dark:hover:text-[#0A0A0A] hover:bg-[#FF7A00] transition-colors bg-[#FF7A00]/5 px-4 py-2.5 rounded-full uppercase tracking-wider border border-[#FF7A00]/20 cursor-pointer"
        >
          ← Return to Directory
        </button>
      )}

      {loading ? (
        <div id="loading-skeleton" className="flex flex-col gap-8 animate-pulse">
          <div className="h-44 w-full rounded-2xl bg-slate-200 dark:bg-white/5" />
          <div className="flex flex-col md:flex-row gap-6 md:gap-16 items-center border-b border-slate-200 dark:border-white/5 pb-10">
            <div className="w-28 h-28 rounded-full bg-slate-200 dark:bg-white/5" />
            <div className="flex-1 flex flex-col gap-4 w-full">
              <div className="h-5 bg-slate-200 dark:bg-white/5 rounded w-1/3" />
              <div className="h-4 bg-slate-200 dark:bg-white/5 rounded w-1/2" />
              <div className="h-3 bg-slate-200 dark:bg-white/5 rounded w-2/3" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-slate-200 dark:bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      ) : !profile ? (
        <div id="profile-unreachable" className="text-center py-20 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 gap-3 shadow-md">
          <AlertCircle className="h-10 w-10 text-[#FF7A00] animate-pulse" />
          <h3 className="font-bold text-lg dark:text-white text-slate-900">Luxe Profile Unreachable</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            We were unable to resolve profile information for "@{lookupUsername}". The portfolio may have been restricted.
          </p>
        </div>
      ) : (
        <>
          {/* Top Return Navigation Bar when viewing another profile */}
          {!profile.is_current_user && (
            <div className="mb-4 flex items-center justify-between bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
              <button
                onClick={onClearTargetUsername}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#FF7A00] dark:hover:text-[#FF7A00] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 text-[#FF7A00]" />
                <span>Back to My Profile (@{user?.username})</span>
              </button>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Viewing @{profile.username}
              </span>
            </div>
          )}

          {/* COVER HEADER & PROFILE INFORMATION SECTION */}
          <div id="cover-section" className="relative mb-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 shadow-md dark:shadow-2xl bg-white dark:bg-[#0A0A0A]">
            
            {/* Cover Banner */}
            <div className="h-44 w-full bg-linear-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-neutral-900 dark:via-stone-950 dark:to-neutral-900 flex items-center justify-between px-8 relative overflow-hidden select-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-[#FF7A00]/5 via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-white/60 dark:bg-black/40 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/5 backdrop-blur-md">
                  Raynista Club Lounge
                </span>
              </div>
            </div>

            {/* Profile Meta Card Layout */}
            <div className="bg-white/95 dark:bg-[#0A0A0A]/40 backdrop-blur-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-12 items-center md:items-start relative -mt-8 mx-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-lg">
              
              {/* Avatar with Status indicator */}
              <div className="relative -mt-16 md:-mt-20 shrink-0">
                <div className="p-[3px] rounded-full bg-gradient-to-tr from-[#FF7A00] to-amber-500 shadow-lg">
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.username} 
                    referrerPolicy="no-referrer"
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-white dark:border-[#0A0A0A] object-cover bg-slate-100 dark:bg-black" 
                  />
                </div>
                {profile.last_seen === "Online Now" && (
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-4 border-white dark:border-[#0A0A0A] rounded-full animate-pulse" title="Online now" />
                )}
              </div>

              {/* Profile Details */}
              <div className="flex-1 flex flex-col gap-4 text-center md:text-left w-full">
                
                {/* Username + Action Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap">
                    <h2 className="font-display font-extrabold text-xl text-slate-900 dark:text-white">@{profile.username}</h2>
                    
                    {/* Blue Verified badge */}
                    {(profile.is_verified === 1 || profile.is_verified === true || profile.username.toLowerCase() === "rayanee" || profile.username.toLowerCase() === "rayane" || profile.email?.toLowerCase() === "rayane@gmail.com") && (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shrink-0 shadow-sm" title="Verified Profile">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    )}



                    {profile.is_private && (
                      <span className="bg-[#FF7A00]/10 text-[#FF7A00] border border-[#FF7A00]/25 rounded-md px-2 py-0.5 text-[9px] font-bold flex items-center gap-0.5 uppercase tracking-wider">
                        <Lock className="h-2.5 w-2.5" />
                        Private
                      </span>
                    )}
                  </div>
                  
                  {/* Premium Action Button Controls (Desktop Only) */}
                  <div className="hidden md:flex flex-wrap gap-2 justify-center md:justify-start select-none">
                    
                    {/* Copy URL & Share Buttons */}
                    <button
                      id="copy-profile-btn"
                      onClick={handleCopyProfile}
                      title="Copy Profile URL"
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 hover:text-[#FF7A00] dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      id="share-profile-btn"
                      onClick={handleShareProfile}
                      title="Share Profile"
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 hover:text-[#FF7A00] dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>

                    {profile.is_current_user ? (
                      <>
                        <button
                          id="edit-profile-btn"
                          onClick={() => setIsEditOpen(true)}
                          className="px-5 py-2.5 border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-[#FF7A00]" />
                          Edit Profile
                        </button>
                        <button
                          id="signout-profile-btn"
                          onClick={logout}
                          className="md:hidden px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-950/20 dark:text-red-400 border border-red-100 dark:border-red-900/20 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Follow state buttons */}
                        {profile.follow_status === "pending" ? (
                          <button
                            id="follow-pending-btn"
                            onClick={handleFollowToggle}
                            className="px-6 py-2.5 border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                          >
                            Requested
                          </button>
                        ) : (
                          <button
                            id="follow-toggle-btn"
                            onClick={handleFollowToggle}
                            className={`px-6 py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer ${
                              profile.is_following
                                ? "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-red-950/20 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-200 hover:text-red-600"
                                : "bg-[#FF7A00] hover:bg-orange-600 text-white shadow-orange-500/10"
                            }`}
                          >
                            {profile.is_following ? "Following" : "Follow"}
                          </button>
                        )}

                        {/* Direct Chat Messenger (Mutual follows only, or Raynai AI) */}
                        {((profile.is_following && profile.is_followed_by) || profile.username === "raynai") && (
                          <button
                            id="message-user-btn"
                            onClick={() => {
                              onNavigateToMessage({
                                id: profile.id,
                                username: profile.username,
                                avatar_url: profile.avatar_url,
                                bio: profile.bio
                              });
                            }}
                            className="px-5 py-2.5 border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-[#FF7A00]" />
                            Message
                          </button>
                        )}

                        {/* Options button (Block, Mute, Report) */}
                        <div className="relative">
                          <button
                            id="options-trigger"
                            onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                            className="p-2.5 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 cursor-pointer"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          <AnimatePresence>
                            {isOptionsOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-40 font-bold text-xs uppercase tracking-wide text-slate-700 dark:text-slate-300"
                              >
                                <button
                                  onClick={handleMuteToggle}
                                  className="w-full px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2.5 cursor-pointer border-b border-slate-100 dark:border-white/5"
                                >
                                  <VolumeX className="h-4 w-4 text-[#FF7A00]" />
                                  Mute User
                                </button>
                                <button
                                  onClick={handleBlockUser}
                                  className="w-full px-4 py-3.5 text-left hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 flex items-center gap-2.5 cursor-pointer border-b border-slate-100 dark:border-white/5"
                                >
                                  <ShieldOff className="h-4 w-4" />
                                  Block User
                                </button>
                                <button
                                  onClick={() => setIsReportOpen(true)}
                                  className="w-full px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2.5 cursor-pointer"
                                >
                                  <Flag className="h-4 w-4 text-amber-500" />
                                  Report Account
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Follower Stats Counters */}
                <div className="flex gap-8 justify-center md:justify-start py-3 border-y border-slate-100 dark:border-white/5 select-none font-bold text-xs tracking-wider uppercase">
                  <div className="flex flex-col md:flex-row md:gap-1.5 items-center">
                    <span className="text-slate-900 dark:text-white text-sm">{profile.posts_count}</span>
                    <span className="text-slate-400 dark:text-slate-500">Posts</span>
                  </div>
                  <div className="flex flex-col md:flex-row md:gap-1.5 items-center">
                    <span className="text-slate-900 dark:text-white text-sm">{profile.followers_count}</span>
                    <span className="text-slate-400 dark:text-slate-500">Followers</span>
                  </div>
                  <div className="flex flex-col md:flex-row md:gap-1.5 items-center">
                    <span className="text-slate-900 dark:text-white text-sm">{profile.following_count}</span>
                    <span className="text-slate-400 dark:text-slate-500">Following</span>
                  </div>
                </div>

                {/* Bio & Extended Luxe Meta (Age, Location, Website) */}
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                  
                  {/* Name details */}
                  {profile.name && (
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">{profile.name}</h3>
                  )}

                  {profile.bio ? (
                    <p className="whitespace-pre-line text-slate-600 dark:text-slate-400">{profile.bio}</p>
                  ) : (
                    <p className="text-slate-400 italic">This portfolio has not configured a description bio yet.</p>
                  )}

                  {/* Extended attributes cards (Website, age, location, gender) */}
                  <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-slate-500 dark:text-slate-500 text-xs font-semibold">
                    {profile.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#FF7A00]" />
                        {profile.location}
                      </span>
                    )}
                    {profile.website && (
                      <a 
                        href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1 text-[#FF7A00] hover:underline"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {profile.website.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    )}
                    {profile.age && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {profile.age}
                      </span>
                    )}
                    {profile.gender && (
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3.5 w-3.5" />
                        {profile.gender}
                      </span>
                    )}
                  </div>

                  {/* Instagram-style action buttons row for mobile */}
                  <div className="flex md:hidden items-center gap-2 mt-5 w-full select-none">
                    {profile.is_current_user ? (
                      <>
                        <button
                          onClick={() => setIsEditOpen(true)}
                          className="flex-1 py-2 text-center bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-900 dark:text-white font-semibold text-xs rounded-lg transition-all cursor-pointer border border-transparent dark:border-white/5 shadow-xs"
                        >
                          Edit Profile
                        </button>
                        <button
                          onClick={handleShareProfile}
                          className="flex-1 py-2 text-center bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-900 dark:text-white font-semibold text-xs rounded-lg transition-all cursor-pointer border border-transparent dark:border-white/5 shadow-xs"
                        >
                          Share Profile
                        </button>
                        <button
                          onClick={logout}
                          className="px-3.5 py-2 text-center bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-semibold text-xs rounded-lg transition-all cursor-pointer border border-transparent dark:border-red-900/10"
                          title="Logout"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {profile.follow_status === "pending" ? (
                          <button
                            onClick={handleFollowToggle}
                            className="flex-1 py-2 text-center bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 font-semibold text-xs rounded-lg transition-all cursor-pointer"
                          >
                            Requested
                          </button>
                        ) : (
                          <button
                            onClick={handleFollowToggle}
                            className={`flex-1 py-2 text-center font-semibold text-xs rounded-lg transition-all cursor-pointer ${
                              profile.is_following
                                ? "bg-slate-100 dark:bg-[#262626] text-slate-950 dark:text-white border border-transparent dark:border-white/5"
                                : "bg-[#0095F6] hover:bg-[#1877F2] text-white"
                            }`}
                          >
                            {profile.is_following ? "Following" : "Follow"}
                          </button>
                        )}

                        {((profile.is_following && profile.is_followed_by) || profile.username === "raynai") && (
                          <button
                            onClick={() => {
                              onNavigateToMessage({
                                id: profile.id,
                                username: profile.username,
                                avatar_url: profile.avatar_url,
                                bio: profile.bio
                              });
                            }}
                            className="flex-1 py-2 text-center bg-slate-100 dark:bg-[#262626] text-slate-950 dark:text-white font-semibold text-xs rounded-lg transition-all cursor-pointer border border-transparent dark:border-white/5"
                          >
                            Message
                          </button>
                        )}

                        <button
                          onClick={() => setIsOptionsOpen(!isOptionsOpen)}
                          className="px-3 py-2 text-center bg-slate-100 dark:bg-[#262626] text-slate-950 dark:text-white font-semibold text-xs rounded-lg transition-all cursor-pointer border border-transparent dark:border-white/5"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GRID NAVIGATION TABS / PRIVATE PROTECTION */}
          {profile.is_locked ? (
            <div id="private-locked-domain" className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#0A0A0A]/50 border border-slate-200 dark:border-white/5 rounded-2xl p-8 text-center select-none max-w-md mx-auto mt-12 animate-fade-in shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-[#FF7A00]/10 border border-[#FF7A00]/20 flex items-center justify-center mb-4 text-[#FF7A00] shadow-md">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Access Restricted</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-xs">
                Connect with @{profile.username} to view their boutique photo portfolio and exclusive reels stream.
              </p>
            </div>
          ) : (
            <>
              {/* Tab Selector Buttons */}
              <div id="grid-tabs" className="flex items-center justify-center border-b border-slate-200 dark:border-white/5 mb-8 font-bold text-xs tracking-widest uppercase select-none">
                <button
                  id="tab-posts"
                  onClick={() => setActiveTab("posts")}
                  className={`flex items-center gap-2 px-8 py-4 transition-all border-b-2 cursor-pointer ${
                    activeTab === "posts" 
                      ? "border-[#FF7A00] text-[#FF7A00]" 
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  }`}
                >
                  <Grid className="h-4 w-4" />
                  Posts
                </button>
                <button
                  id="tab-reels"
                  onClick={() => setActiveTab("reels")}
                  className={`flex items-center gap-2 px-8 py-4 transition-all border-b-2 cursor-pointer ${
                    activeTab === "reels" 
                      ? "border-[#FF7A00] text-[#FF7A00]" 
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  }`}
                >
                  <Film className="h-4 w-4" />
                  Reels
                </button>
                {profile.is_current_user && (
                  <button
                    id="tab-bookmarks"
                    onClick={() => setActiveTab("bookmarks")}
                    className={`flex items-center gap-2 px-8 py-4 transition-all border-b-2 cursor-pointer ${
                      activeTab === "bookmarks" 
                        ? "border-[#FF7A00] text-[#FF7A00]" 
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    Saved
                  </button>
                )}
                {profile.is_current_user && (user?.username?.toLowerCase() === "rayanee" || user?.username?.toLowerCase() === "rayane" || user?.email?.toLowerCase() === "rayane@gmail.com") && (
                  <button
                    id="tab-owner"
                    onClick={() => setActiveTab("owner")}
                    className={`flex items-center gap-2 px-8 py-4 transition-all border-b-2 cursor-pointer ${
                      activeTab === "owner" 
                        ? "border-blue-500 text-blue-500 font-extrabold" 
                        : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    }`}
                  >
                    <Shield className="h-4 w-4 text-blue-500 animate-pulse" />
                    Command Center
                  </button>
                )}
              </div>

              {/* Grid content */}
              {activeTab === "posts" ? (
                posts.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 gap-2 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aesthetic Void</span>
                    <span className="text-[10px] text-slate-500">No photography uploads are available on this channel yet.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 animate-fade-in">
                    {posts.map((post) => (
                      <div
                        id={`post-grid-item-${post.id}`}
                        key={post.id}
                        onClick={() => setSelectedMediaPost(post)}
                        className="aspect-square bg-slate-100 dark:bg-neutral-900 rounded-xl overflow-hidden cursor-pointer relative group border border-slate-200 dark:border-white/5 shadow-sm"
                      >
                        <img 
                          src={post.media_url} 
                          alt="Grid thumbnail" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transform transition-transform group-hover:scale-105 duration-500" 
                          loading="lazy"
                        />
                        {/* Hover overlay with count */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 text-white">
                          <span className="font-extrabold text-xs tracking-wide flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                            <Heart className="h-3.5 w-3.5 fill-[#FF7A00] text-[#FF7A00]" />
                            {post.likes_count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === "reels" ? (
                reels.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 gap-2 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Reels Stream</span>
                    <span className="text-[10px] text-slate-500">This user has not broadcasted any vertical loops.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 animate-fade-in">
                    {reels.map((reel) => (
                      <div
                        id={`reel-grid-item-${reel.id}`}
                        key={reel.id}
                        onClick={() => setSelectedMediaPost(reel)}
                        className="aspect-[9/16] bg-slate-200 dark:bg-neutral-950 rounded-xl overflow-hidden cursor-pointer relative group border border-slate-200 dark:border-white/5 shadow-sm"
                      >
                        <video 
                          src={reel.media_url} 
                          muted 
                          playsInline
                          className="w-full h-full object-cover" 
                        />
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white gap-2">
                          <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 self-start bg-[#FF7A00]/25 border border-[#FF7A00]/40 text-[#FF7A00] px-2 py-1 rounded-md">
                            <Heart className="h-3 w-3 fill-[#FF7A00]" />
                            {reel.likes_count}
                          </span>
                          <span className="text-[10px] text-slate-200 font-bold truncate leading-none">{reel.caption}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : activeTab === "bookmarks" ? (
                bookmarks.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl flex flex-col items-center justify-center p-6 gap-2 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Saved Works</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Save your favorite portfolios for seamless fast reference.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 animate-fade-in">
                    {bookmarks.map((post) => (
                      <div
                        id={`bookmark-grid-item-${post.id}`}
                        key={post.id}
                        onClick={() => setSelectedMediaPost(post)}
                        className={`bg-slate-100 dark:bg-neutral-900 rounded-xl overflow-hidden cursor-pointer relative group border border-slate-200 dark:border-white/5 shadow-sm ${post.post_type === "reel" ? "aspect-[9/16]" : "aspect-square"}`}
                      >
                        {post.post_type === "reel" ? (
                          <video src={post.media_url} muted playsInline className="w-full h-full object-cover" />
                        ) : (
                          <img src={post.media_url} alt="Saved thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover" loading="lazy" />
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 text-white">
                          <span className="font-extrabold text-xs tracking-wide flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                            <Heart className="h-3.5 w-3.5 fill-[#FF7A00] text-[#FF7A00]" />
                            {post.likes_count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* EXCLUSIVE OWNER COMMAND CENTER DASHBOARD */
                <div className="space-y-8 animate-fade-in text-slate-800 dark:text-slate-100 pb-20">
                  <div className="p-6 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border border-blue-500/20 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-md shadow-blue-500/20 animate-bounce">
                        <Shield className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-extrabold text-lg text-blue-600 dark:text-blue-400">Owner Command Center</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">App Owner: @{user?.username}</p>
                      </div>
                    </div>
                  </div>

                  {loadingOwnerData && !ownerStats ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-blue-500"></div>
                    </div>
                  ) : (
                    <>
                      {/* Stats Overview */}
                      {ownerStats && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Users</span>
                            <h4 className="text-2xl font-display font-extrabold text-blue-500 mt-1">{ownerStats.total_users}</h4>
                          </div>
                          <div className="p-4 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Accounts</span>
                            <h4 className="text-2xl font-display font-extrabold text-emerald-500 mt-1">{ownerStats.total_verified}</h4>
                          </div>
                          <div className="p-4 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Posts & Reels</span>
                            <h4 className="text-2xl font-display font-extrabold text-amber-500 mt-1">{ownerStats.total_posts + ownerStats.total_reels}</h4>
                          </div>
                          <div className="p-4 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Messages</span>
                            <h4 className="text-2xl font-display font-extrabold text-[#FF7A00] mt-1">{ownerStats.total_messages}</h4>
                          </div>
                          <div className="p-4 bg-white dark:bg-[#0A0A0A]/40 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm col-span-2 md:col-span-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reports Logged</span>
                            <h4 className="text-2xl font-display font-extrabold text-rose-500 mt-1">{ownerStats.total_reports}</h4>
                          </div>
                        </div>
                      )}

                      {/* Global Broadcast message */}
                      <div className="p-6 bg-white dark:bg-[#0A0A0A]/30 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2 mb-1">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          Global Broadcast Announcement
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                          Send a direct message notification instantly from you (@{user?.username}) to every user on the platform.
                        </p>
                        <form onSubmit={handleBroadcast} className="space-y-3">
                          <textarea
                            value={broadcastText}
                            onChange={(e) => setBroadcastText(e.target.value)}
                            placeholder="Type your official announcement or message here..."
                            rows={3}
                            className="w-full bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-slate-400 resize-none font-medium"
                          />
                          <button
                            type="submit"
                            disabled={isBroadcasting || !broadcastText.trim()}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                          >
                            {isBroadcasting ? "Broadcasting..." : "Send Global Broadcast"}
                          </button>
                        </form>
                      </div>

                      {/* User Account List and Verification Controls */}
                      <div className="p-6 bg-white dark:bg-[#0A0A0A]/30 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-4">
                          Manage Users & Blue Verification Badge
                        </h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {ownerUsers.length === 0 ? (
                            <p className="text-center text-xs text-slate-500 py-6">No other users signed up yet.</p>
                          ) : (
                            ownerUsers.map((u) => (
                              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative">
                                    <img
                                      src={u.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80"}
                                      alt={u.username}
                                      referrerPolicy="no-referrer"
                                      className="w-9 h-9 rounded-full object-cover"
                                    />
                                    {u.is_online === 1 && (
                                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0A0A0A]" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">@{u.username}</p>
                                    <p className="text-[10px] text-slate-400 font-semibold truncate">{u.name || "No name"}</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVerify(u.id, u.is_verified === 1)}
                                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border shrink-0 cursor-pointer ${
                                    u.is_verified === 1
                                      ? "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/25"
                                      : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-white/10"
                                  }`}
                                >
                                  {u.is_verified === 1 ? "Verified (Blue)" : "Verify User"}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* EDIT PROFILE LUXURY DIALOG MODAL */}
      <AnimatePresence>
        {isEditOpen && (
          <div id="edit-profile-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0D0D0D] rounded-[24px] max-w-lg w-full shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-6 py-4.5">
                <div>
                  <h3 className="font-display font-extrabold text-sm text-slate-900 dark:text-white tracking-wider uppercase">Luxe Portfolio</h3>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Edit credentials & status visibility</p>
                </div>
                <button 
                  onClick={() => {
                    setIsEditOpen(false);
                    setUploadFile(null);
                    setPreviewSrc(null);
                  }}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleUpdateProfile} className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
                
                {/* Advanced Crop & Upload Area */}
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="h-3.5 w-3.5 text-[#FF7A00]" />
                    Interactive Portrait Cropper
                  </label>

                  {/* HTML5 Crop Canvas (hidden) */}
                  <canvas ref={canvasRef} className="hidden" />

                  {previewSrc ? (
                    <div className="flex flex-col items-center gap-4 bg-slate-50 dark:bg-black/40 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                      {(uploadFile?.type === "image/gif" || uploadFile?.name?.toLowerCase().endsWith(".gif") || previewSrc?.startsWith("data:image/gif") || previewSrc?.toLowerCase().includes("image/gif") || previewSrc?.includes("R0lGOD")) && (
                        <div className="w-full text-center px-3 py-1.5 bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400 text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 animate-pulse">
                          <span>✨</span> Animated GIF Detected — Full Motion & Infinite Loop Active
                        </div>
                      )}
                      <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-[#FF7A00]/40 bg-black">
                        <img 
                          ref={imageRef}
                          src={previewSrc} 
                          alt="Cropper preview" 
                          style={{
                            transform: `scale(${cropZoom}) translate(${cropX}px, ${cropY}px)`,
                            transformOrigin: "center center"
                          }}
                          className="w-full h-full object-cover transition-transform"
                        />
                      </div>

                      {/* Interactive sliders for fine cropping control */}
                      <div className="w-full space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                          <span>ZOOM SCALE</span>
                          <span className="text-[#FF7A00]">{cropZoom.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="3" 
                          step="0.1"
                          value={cropZoom}
                          onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                          className="w-full accent-[#FF7A00] h-1.5 bg-slate-200 dark:bg-white/15 rounded-lg cursor-pointer"
                        />

                        <div className="flex gap-4">
                          <div className="flex-1">
                            <span className="text-[9px] font-bold text-slate-400 block mb-1">HORIZONTAL OFFSET</span>
                            <input 
                              type="range" 
                              min="-100" 
                              max="100" 
                              value={cropX}
                              onChange={(e) => setCropX(parseInt(e.target.value))}
                              className="w-full accent-slate-500 h-1.5 bg-slate-200 dark:bg-white/15 rounded-lg cursor-pointer"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-[9px] font-bold text-slate-400 block mb-1">VERTICAL OFFSET</span>
                            <input 
                              type="range" 
                              min="-100" 
                              max="100" 
                              value={cropY}
                              onChange={(e) => setCropY(parseInt(e.target.value))}
                              className="w-full accent-slate-500 h-1.5 bg-slate-200 dark:bg-white/15 rounded-lg cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setUploadFile(null);
                          setPreviewSrc(null);
                        }}
                        className="text-[10px] font-bold text-red-500 uppercase hover:underline"
                      >
                        Reset Upload
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl p-6 text-center bg-slate-50 dark:bg-black/20 hover:border-[#FF7A00]/40 transition-colors">
                      <input 
                        type="file" 
                        accept="image/*"
                        id="avatar-file-upload"
                        onChange={handleFileChange}
                        className="hidden" 
                      />
                      <label htmlFor="avatar-file-upload" className="flex flex-col items-center gap-2 cursor-pointer">
                        <Upload className="h-6 w-6 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Upload portrait from gallery</span>
                        <span className="text-[9px] text-slate-400 uppercase">JPEG, PNG, WEBP up to 5MB</span>
                      </label>
                    </div>
                  )}

                  <input
                    type="url"
                    placeholder="Or paste high-res image or animated GIF URL..."
                    value={editedAvatar}
                    onChange={(e) => setEditedAvatar(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold"
                  />

                  {/* Animated Avatar Presets & Giphy search (Conditional for Rayan) */}
                  {!isEligibleForGif ? (
                    <div className="flex flex-col items-center justify-center p-5 border border-dashed border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/2 rounded-xl text-center gap-2.5 my-2 shadow-xs">
                      <Lock className="h-4 w-4 text-[#FF7A00]" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">GIF Profile Picture Locked</span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[280px]">
                        Animated GIF profile pictures are exclusive to Platform Creator and Owner **Rayan**! Standard accounts can use static images.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Animated Avatar Presets */}
                      <div className="flex flex-col gap-2 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-[#FF7A00]" />
                          Featured Animated GIF Avatars
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: "Sasuke Anime", url: "https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif" },
                            { label: "Cyber Glitch", url: "https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif" },
                            { label: "Pixel Sunset", url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif" },
                            { label: "Neon Aura", url: "https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif" }
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setUploadFile(null);
                                setPreviewSrc(null);
                                setEditedAvatar(preset.url);
                              }}
                              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                                editedAvatar === preset.url && !previewSrc
                                  ? "border-[#FF7A00] bg-[#FF7A00]/10 text-[#FF7A00]"
                                  : "border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              <img src={preset.url} alt={preset.label} className="w-9 h-9 rounded-full object-cover shadow-xs border border-white/20" />
                              <span className="text-[9px] font-bold truncate max-w-full">{preset.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Giphy GIF Explorer */}
                      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-blue-500" />
                          Search Animated GIFs on Giphy
                        </span>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Search Giphy (e.g., anime, glitch, cat)..."
                            value={giphySearchQuery}
                            onChange={(e) => setGiphySearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleGiphySearch(e);
                              }
                            }}
                            className="flex-1 px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={handleGiphySearch}
                            className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] rounded-lg uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Search
                          </button>
                        </div>

                        {giphyLoading ? (
                          <div className="flex justify-center items-center py-4">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-blue-500"></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto pr-1">
                            {giphyGifs.map((gif) => (
                              <button
                                key={gif.id}
                                type="button"
                                onClick={() => {
                                  setUploadFile(null);
                                  setPreviewSrc(null);
                                  setEditedAvatar(gif.url);
                                  triggerToast("Giphy GIF selected!", "success");
                                }}
                                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                                  editedAvatar === gif.url && !previewSrc
                                    ? "border-blue-500 bg-blue-500/10"
                                    : "border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20"
                                }`}
                              >
                                <img src={gif.url} alt={gif.title} className="w-10 h-10 rounded-md object-cover mx-auto" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Form fields in clean 2-column layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ahmed Ali"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Website URL</label>
                    <input
                      type="text"
                      placeholder="e.g. raynista.co"
                      value={editedWebsite}
                      onChange={(e) => setEditedWebsite(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lounge Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Paris, France"
                      value={editedLocation}
                      onChange={(e) => setEditedLocation(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gender</label>
                    <select
                      value={editedGender}
                      onChange={(e) => setEditedGender(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold appearance-none"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Private">Prefer not to say</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Private Birthday (displays as Age only)</label>
                    <input
                      type="date"
                      value={editedBirthday}
                      onChange={(e) => setEditedBirthday(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold"
                    />
                  </div>
                </div>

                {/* Bio Biography text area */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lounge Biography</label>
                  <textarea
                    rows={3}
                    placeholder="Configure an elegant biography about who you are..."
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold resize-none leading-relaxed"
                  />
                </div>

                {/* Account Privacy Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-black/60 border border-slate-100 dark:border-white/5 my-1">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-[#FF7A00]" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">Private Domain</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-normal mt-0.5 font-semibold uppercase">Approval required for all access.</span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editedIsPrivate}
                      onChange={(e) => setEditedIsPrivate(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white dark:after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF7A00]"></div>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-full bg-[#FF7A00] hover:bg-orange-600 disabled:bg-slate-200 text-white font-bold text-xs uppercase tracking-wider py-3.5 rounded-xl transition-all duration-300 shadow-md active:scale-98 cursor-pointer"
                >
                  {isUpdating ? "Synchronizing details..." : "Sync Profile"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXPANDED MEDIA OVERLAY VIEW */}
      <AnimatePresence>
        {selectedMediaPost && (
          <div id="expanded-media-overlay" className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-xl w-full max-h-[85vh] bg-[#0A0A0A] rounded-[24px] overflow-hidden shadow-2xl flex flex-col border border-white/10"
            >
              
              {/* Header */}
              <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-[#0A0A0A] z-10">
                <span className="font-extrabold text-[10px] text-slate-500 uppercase tracking-widest">
                  {selectedMediaPost.post_type === "reel" ? "Exquisite Reel View" : "Boutique Post View"}
                </span>
                <button
                  onClick={() => setSelectedMediaPost(null)}
                  className="text-slate-400 hover:text-white p-1.5 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Media Canvas Body */}
              <div className="flex-1 overflow-hidden bg-black flex items-center justify-center relative min-h-[300px]">
                {selectedMediaPost.post_type === "standard" ? (
                  <img 
                    src={selectedMediaPost.media_url} 
                    alt="Post details" 
                    referrerPolicy="no-referrer"
                    className="max-h-[60vh] max-w-full object-contain" 
                  />
                ) : (
                  <video 
                    src={selectedMediaPost.media_url} 
                    controls 
                    autoPlay
                    className="max-h-[60vh] max-w-full object-contain" 
                  />
                )}
              </div>

              {/* Description captions */}
              <div className="p-6 bg-[#0A0A0A] border-t border-white/5 flex flex-col gap-2 select-none">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FF7A00] flex items-center gap-1.5 self-start bg-[#FF7A00]/10 px-2.5 py-1 rounded-md border border-[#FF7A00]/25">
                  <Heart className="h-3 w-3 fill-[#FF7A00]" />
                  {selectedMediaPost.likes_count} Collectors
                </span>
                <div className="text-xs text-slate-300 leading-relaxed mt-1">
                  <span className="font-extrabold mr-1.5 text-white">@{lookupUsername}</span>
                  <span className="font-medium text-slate-400">{selectedMediaPost.caption}</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REPORT ACCOUNT MODAL */}
      <AnimatePresence>
        {isReportOpen && (
          <div id="report-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0D0D0D] rounded-[24px] max-w-md w-full shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 px-6 py-4">
                <h3 className="font-display font-extrabold text-xs text-slate-900 dark:text-white tracking-wider uppercase">Report Account</h3>
                <button onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleReportUser} className="p-6 flex flex-col gap-4">
                <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider leading-relaxed">
                  Help us protect the Raynista luxury club lounge. Please clarify your report concern below:
                </p>
                <textarea
                  required
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="e.g. Inappropriate media uploads, harassment, or copycat..."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-xs bg-slate-50 dark:bg-[#121212] text-slate-900 dark:text-white focus:outline-hidden focus:border-[#FF7A00] transition-all font-semibold resize-none"
                />
                <button
                  type="submit"
                  className="w-full bg-[#FF7A00] hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all cursor-pointer"
                >
                  File Anonymous Report
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
