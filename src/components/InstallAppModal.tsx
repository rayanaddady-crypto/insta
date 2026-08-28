import React, { useState, useEffect } from "react";
import { 
  Download, 
  Smartphone, 
  X, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ExternalLink,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "./AuthContext";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { triggerToast } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setIsIOS(true);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        triggerToast("Raynista shortcut added to phone home screen!", "success");
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      triggerToast("Follow instructions below to add Raynista shortcut to your phone desktop", "info");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="relative p-6 bg-gradient-to-r from-[#121212] via-[#0F0F0F] to-[#121212] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF7A00] to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                <Download className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-display font-extrabold text-lg text-white">
                  Add Raynista to Phone Desktop
                </h2>
                <p className="text-xs text-slate-400">
                  Instant mobile app shortcut — 1-click launch from home screen
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Status Card */}
            {isInstalled ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Raynista App Installed!</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    You are currently using Raynista directly as a standalone app on your device.
                  </p>
                </div>
              </div>
            ) : deferredPrompt ? (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-[#FF7A00]/15 via-orange-950/20 to-transparent border border-[#FF7A00]/30 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#FF7A00] flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">1-Click Phone Shortcut</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Click the button below to immediately create a desktop icon on your phone screen!
                  </p>
                </div>
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3.5 rounded-xl bg-[#FF7A00] hover:bg-orange-600 active:scale-95 text-white text-xs font-extrabold tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all cursor-pointer mt-1"
                >
                  <Download className="h-4 w-4" />
                  Install Shortcut to Phone Desktop
                </button>
              </div>
            ) : null}

            {/* Manual Instructions for Android & iPhone */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Info className="h-4 w-4 text-[#FF7A00]" />
                How to add shortcut to phone desktop manually:
              </h4>

              {/* Android Chrome Instructions */}
              <div className="p-4 rounded-2xl bg-[#121212] border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-[#FF7A00]" />
                  <span className="text-xs font-bold text-white">Android (Chrome / Edge / Firefox)</span>
                </div>
                <ol className="text-xs text-slate-400 space-y-1.5 pl-5 list-decimal">
                  <li>Tap the browser menu button (<strong className="text-white">⋮ 3 dots</strong> top-right).</li>
                  <li>Select <strong className="text-white">"Add to Home screen"</strong> or <strong className="text-white">"Install app"</strong>.</li>
                  <li>Confirm <strong className="text-white">"Add"</strong> — Raynista icon will appear on your phone desktop!</li>
                </ol>
              </div>

              {/* iPhone Safari Instructions */}
              <div className="p-4 rounded-2xl bg-[#121212] border border-white/5 space-y-2">
                <div className="flex items-center gap-2">
                  <Share className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">iPhone / iPad (Safari)</span>
                </div>
                <ol className="text-xs text-slate-400 space-y-1.5 pl-5 list-decimal">
                  <li>Tap the Safari <strong className="text-white">Share button</strong> (square with arrow pointing up at bottom).</li>
                  <li>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong className="text-white">"Add"</strong> in top right. Open Raynista directly from phone home screen!</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 bg-[#080808] border-t border-white/5 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Raynista PWA & Desktop Shortcut Ready</span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
