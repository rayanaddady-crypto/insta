import React, { useState, useRef } from "react";
import { X, Upload, Image as ImageIcon, Video, Clock } from "lucide-react";
import { useAuth } from "./AuthContext";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (postType: string) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { fetchWithAuth, triggerToast } = useAuth();
  
  const [postType, setPostType] = useState<"standard" | "reel" | "story">("standard");
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (selectedFile: File) => {
    // Basic validation
    const isImage = selectedFile.type.startsWith("image/");
    const isVideo = selectedFile.type.startsWith("video/");
    
    if (postType === "reel" && !isVideo) {
      triggerToast("Reels must be video files", "error");
      return;
    }
    
    if (postType === "story" && !isImage && !isVideo) {
      triggerToast("Stories must be images or videos", "error");
      return;
    }

    if (postType === "standard" && !isImage) {
      triggerToast("Standard posts must be images", "error");
      return;
    }

    setFile(selectedFile);
    
    // For preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setMediaUrl(reader.result);
        triggerToast("File loaded successfully!", "success");
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !mediaUrl.trim()) {
      triggerToast("Please provide a media file or URL", "error");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(10); // Start progress

    try {
      let endpoint = postType === "story" ? "/api/stories/create" : "/api/posts/create";
      
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("media_url", mediaUrl);
      }
      
      if (postType !== "story") {
        formData.append("caption", caption);
        formData.append("post_type", postType);
      }

      setUploadProgress(50); // Simulate progress

      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        body: formData, // FormData doesn't need Content-Type header, browser sets it with boundary
        // Remove Content-Type so fetch sets it automatically
        headers: {
          "Accept": "application/json"
        }
      });
      
      // We need to override the default fetchWithAuth behavior because it hardcodes JSON stringify
      // Wait, fetchWithAuth in AuthContext sets Content-Type to application/json by default!
      // I must fix that in AuthContext.

      setUploadProgress(100);
      triggerToast(`${postType === "reel" ? "Reel" : postType === "story" ? "Story" : "Post"} created successfully!`, "success");
      
      setMediaUrl("");
      setCaption("");
      setFile(null);
      setPostType("standard");
      setUploadProgress(0);
      onSuccess(postType);
      onClose();
    } catch (err: any) {
      triggerToast(err.message || "Failed to create post", "error");
      setUploadProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAspectRatioPreview = () => {
    if (!mediaUrl) return null;
    let aspectRatioClass = "aspect-square";
    if (postType === "reel" || postType === "story") aspectRatioClass = "aspect-[9/16]";
    else aspectRatioClass = "aspect-square"; // Could add 4:5 switch later

    return (
      <div className={`w-full ${aspectRatioClass} bg-slate-900 rounded-xl overflow-hidden relative group`}>
        {mediaUrl.startsWith("data:video") || mediaUrl.endsWith(".mp4") ? (
          <video src={mediaUrl} className="w-full h-full object-cover" autoPlay loop muted />
        ) : (
          <img src={mediaUrl} className="w-full h-full object-cover" alt="Preview" />
        )}
        <button
          type="button"
          onClick={() => { setMediaUrl(""); setFile(null); }}
          className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in text-white">
      <div className="bg-[#121212] rounded-2xl max-w-md w-full shadow-2xl border border-white/10 overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <h3 className="font-display font-extrabold text-sm text-white tracking-wider uppercase">Create</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Upload Progress Bar */}
        {isSubmitting && (
          <div className="h-1 w-full bg-slate-800 shrink-0">
            <div 
              className="h-full bg-[#0095F6] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
          
          {/* Post Type Selector */}
          <div className="flex bg-black p-1 rounded-lg shrink-0 border border-white/10">
            <button
              type="button"
              onClick={() => { setPostType("standard"); setMediaUrl(""); setFile(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                postType === "standard"
                  ? "bg-[#1A1A1A] text-[#0095F6] font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span>Posts</span>
            </button>
            <button
              type="button"
              onClick={() => { setPostType("reel"); setMediaUrl(""); setFile(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                postType === "reel"
                  ? "bg-[#1A1A1A] text-[#0095F6] font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Video className="h-4 w-4" />
              <span>Reels</span>
            </button>
            <button
              type="button"
              onClick={() => { setPostType("story"); setMediaUrl(""); setFile(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-medium text-xs sm:text-sm transition-all cursor-pointer ${
                postType === "story"
                  ? "bg-[#1A1A1A] text-[#0095F6] font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Story</span>
            </button>
          </div>

          {/* Media Preview or Upload Zone */}
          {mediaUrl ? (
            renderAspectRatioPreview()
          ) : (
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-[200px] ${
                dragOver 
                  ? "border-[#0095F6] bg-[#0095F6]/10" 
                  : "border-white/10 bg-black/40 hover:bg-white/5"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file"
                accept={postType === "reel" ? "video/mp4,video/*" : "image/*,video/*"}
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload className="h-10 w-10 text-[#0095F6]" />
              <div className="text-center">
                <span className="block text-sm font-semibold text-slate-200">
                  Drag & drop your {postType === "reel" ? "video" : "photo/video"} here
                </span>
                <span className="block text-xs mt-1 text-slate-500 font-bold uppercase tracking-wider">
                  Or click to select file
                </span>
              </div>
            </div>
          )}

          {/* Divider */}
          {!file && (
            <>
              <div className="flex items-center gap-3 my-2">
                <hr className="flex-1 border-white/10" />
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Or paste URL</span>
                <hr className="flex-1 border-white/10" />
              </div>

              {/* Media URL Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Media URL
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={mediaUrl.startsWith("data:") ? "" : mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-xs bg-black text-white focus:border-[#0095F6] focus:outline-hidden transition-all font-semibold"
                />
              </div>
            </>
          )}

          {/* Caption Input */}
          {postType !== "story" && (
            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Caption
              </label>
              <textarea
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 border border-white/10 rounded-lg text-xs bg-black text-white focus:border-[#0095F6] focus:outline-hidden transition-all resize-none font-semibold"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (!mediaUrl && !file)}
            className="mt-4 w-full bg-[#0095F6] hover:bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
          >
            {isSubmitting ? (
              <span className="animate-pulse">Uploading...</span>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {postType === "story" ? "Add Story" : "Share"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
