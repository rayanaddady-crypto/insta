import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { RaymiLogo } from "./RaymiLogo";
import { playSound } from "../utils/sound";
import { 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Chrome, 
  Apple, 
  Facebook, 
  AlertCircle,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { InstallAppModal } from "./InstallAppModal";

export const Auth: React.FC = () => {
  const { login, fetchWithAuth, triggerToast } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(false);
  
  // Form states
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login form states
  const [usernameOrEmail, setUsernameOrEmail] = useState("");

  // Submitting / UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authStatus, setAuthStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  
  // Username check states
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sound handler for typing
  const handleInputChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    playSound("type");
    setter(e.target.value);
  };

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const passwordStrength = getPasswordStrength(password);
  const passwordStrengthLabel = () => {
    if (passwordStrength <= 1) return { label: "Weak", color: "bg-red-500", text: "text-red-500" };
    if (passwordStrength <= 3) return { label: "Moderate", color: "bg-amber-500", text: "text-amber-500" };
    if (passwordStrength <= 4) return { label: "Strong", color: "bg-blue-500", text: "text-blue-500" };
    return { label: "High Security", color: "bg-emerald-500", text: "text-emerald-500" };
  };

  // Debounced username availability checker
  useEffect(() => {
    if (isLogin || !username) {
      setUsernameStatus("idle");
      return;
    }

    if (username.length < 3) {
      setUsernameStatus("taken");
      return;
    }

    setUsernameStatus("checking");

    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetchWithAuth(`/api/check-username/${username}`);
        if (response && response.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("taken");
        }
      } catch (err) {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [username, isLogin]);

  // Floating Particles Background Setup
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; duration: number; delay: number }>>([]);
  useEffect(() => {
    const generated = Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 18 + 8,
      delay: Math.random() * -10
    }));
    setParticles(generated);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound("click");
    
    // Validations
    if (!isLogin) {
      if (usernameStatus === "taken") {
        triggerFloatingError("Username is unavailable or too short.");
        return;
      }
      if (password !== confirmPassword) {
        triggerFloatingError("Passwords do not match.");
        return;
      }
      if (password.length < 6) {
        triggerFloatingError("Password must be at least 6 characters.");
        return;
      }
    }

    setIsSubmitting(true);
    setAuthStatus("loading");
    setErrorMessage("");

    try {
      if (isLogin) {
        const response = await fetchWithAuth("/api/login", {
          method: "POST",
          body: JSON.stringify({
            usernameOrEmail,
            password
          })
        });
        
        playSound("success");
        setAuthStatus("success");
        setTimeout(() => {
          login(response.token, response.user);
        }, 1200);
      } else {
        const response = await fetchWithAuth("/api/register", {
          method: "POST",
          body: JSON.stringify({
            username,
            email,
            password
          })
        });

        playSound("success");
        setAuthStatus("success");
        setTimeout(() => {
          login(response.token, response.user);
        }, 1200);
      }
    } catch (err: any) {
      playSound("error");
      setAuthStatus("error");
      const errTxt = err.message || "Failed to authenticate. Please check your credentials.";
      setErrorMessage(errTxt);
      triggerToast(errTxt, "error");
      setIsSubmitting(false);
    }
  };

  const triggerFloatingError = (msg: string) => {
    playSound("error");
    setErrorMessage(msg);
    setAuthStatus("error");
    triggerToast(msg, "error");
    setTimeout(() => {
      setAuthStatus("idle");
    }, 4000);
  };

  const handleThirdPartyLogin = async (provider: string) => {
    playSound("click");
    setIsSubmitting(true);
    setAuthStatus("loading");

    try {
      const response = await fetchWithAuth("/api/auth/sso", {
        method: "POST",
        body: JSON.stringify({ provider })
      });

      playSound("success");
      setAuthStatus("success");
      triggerToast(`Authenticated with ${provider}! Logged in as @${response.user.username}`, "success");
      setTimeout(() => {
        login(response.token, response.user);
      }, 1000);
    } catch (err: any) {
      playSound("error");
      setAuthStatus("error");
      setErrorMessage(err.message || `${provider} authentication failed.`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center bg-black overflow-hidden px-4 py-8 font-sans select-none text-white">
      
      {/* Black & Blue Futuristic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-gradient-to-b from-[#0095F6]/20 via-[#00D2FF]/5 to-transparent blur-[120px] pointer-events-none" />
      <div className="absolute top-[25%] left-[-10%] w-[380px] h-[380px] rounded-full bg-[#0095F6]/10 blur-[130px] pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[20%] right-[-10%] w-[420px] h-[420px] rounded-full bg-[#0055FF]/10 blur-[150px] pointer-events-none" />

      {/* Floating Blue Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-[#0095F6]/40 blur-[0.5px]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `float-slow ${p.duration}s infinite linear`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes float-slow {
          0% { transform: translateY(0px) rotate(0deg) scale(1); opacity: 0; }
          15% { opacity: 0.9; }
          85% { opacity: 0.9; }
          100% { transform: translateY(-130px) rotate(360deg) scale(1.15); opacity: 0; }
        }
      `}</style>

      <div className="w-full max-w-[460px] z-10">
        
        {/* Floating Error Message Banner */}
        <AnimatePresence>
          {authStatus === "error" && errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="mb-4 bg-red-950/90 backdrop-blur-md border border-red-500/30 text-red-200 p-4 rounded-2xl flex items-start gap-3 shadow-2xl"
            >
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1">
                <h4 className="font-semibold text-xs text-red-300 uppercase tracking-wider">Authentication Error</h4>
                <p className="text-[11px] text-red-200/90 mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
              <button 
                onClick={() => {
                  playSound("click");
                  setAuthStatus("idle");
                }} 
                className="text-red-400 hover:text-white text-xs font-semibold px-2 hover:bg-white/10 rounded-lg py-1 transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center justify-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14 }}
            className="mb-3"
          >
            <RaymiLogo size="xl" />
          </motion.div>
          
          <h1 className="font-display font-black text-4xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#0095F6] bg-clip-text text-transparent uppercase">
            Raymi
          </h1>
          <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-1 flex items-center gap-1.5 justify-center">
            <Sparkles className="h-3 w-3 text-[#0095F6]" />
            Next-Gen Social Network
          </p>
        </div>

        {/* Central Glassmorphic Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="relative bg-[#0A0D14]/80 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-blue-950/40 rounded-[28px] p-7 md:p-9 overflow-hidden"
        >
          {/* Glass Top Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#0095F6] to-transparent" />

          {/* SUCCESS OVERLAY */}
          <AnimatePresence>
            {authStatus === "success" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/95 backdrop-blur-md z-30 flex flex-col items-center justify-center text-center p-6"
              >
                <motion.div
                  initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 bg-[#0095F6] rounded-full flex items-center justify-center text-white mb-4 shadow-xl shadow-blue-500/40"
                >
                  <Check className="h-10 w-10 stroke-[3]" />
                </motion.div>
                <h3 className="text-xl font-bold tracking-tight text-white font-display">Welcome to Raymi</h3>
                <p className="text-xs text-[#00D2FF] font-semibold mt-1">Opening your feed & messages...</p>
                <div className="mt-6 flex items-center gap-1.5 justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#0095F6] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#0095F6] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#0095F6] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* LOADING OVERLAY */}
          <AnimatePresence>
            {authStatus === "loading" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-md z-30 flex flex-col items-center justify-center text-center p-6"
              >
                <div className="relative w-16 h-16 mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#0095F6] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                </div>
                <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">Authenticating Raymi Account</h3>
                <p className="text-[11px] text-slate-400 mt-1">Establishing secure connection...</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Switcher */}
          <div className="flex bg-black p-1 rounded-2xl mb-6 border border-white/10 relative">
            <button
              type="button"
              onClick={() => {
                playSound("toggle");
                setIsLogin(true);
                setAuthStatus("idle");
              }}
              className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all duration-300 relative z-10 cursor-pointer ${
                isLogin ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                playSound("toggle");
                setIsLogin(false);
                setAuthStatus("idle");
              }}
              className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all duration-300 relative z-10 cursor-pointer ${
                !isLogin ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
            <motion.div
              className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-[#0095F6] to-[#0066FF] shadow-lg shadow-blue-500/20 z-0"
              initial={false}
              animate={{
                left: isLogin ? "4px" : "calc(50% + 2px)",
                width: "calc(50% - 6px)"
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* REGISTER FIELDS */}
            {!isLogin && (
              <>
                {/* Username Input */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username</label>
                    {username.length >= 3 && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${
                        usernameStatus === "available" ? "text-emerald-400" : usernameStatus === "checking" ? "text-slate-400" : "text-red-400"
                      }`}>
                        {usernameStatus === "available" && "✓ Available"}
                        {usernameStatus === "checking" && "Checking..."}
                        {usernameStatus === "taken" && "Unavailable"}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. raymi_star"
                      required
                      value={username}
                      onChange={handleInputChange((val) => setUsername(val.toLowerCase().trim()))}
                      className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#0095F6] focus:ring-1 focus:ring-[#0095F6] transition-all hover:border-white/20"
                    />
                  </div>
                </div>

                {/* Name Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Ray"
                      required
                      value={name}
                      onChange={handleInputChange(setName)}
                      className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#0095F6] focus:ring-1 focus:ring-[#0095F6] transition-all hover:border-white/20"
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      placeholder="e.g. user@raymi.com"
                      required
                      value={email}
                      onChange={handleInputChange(setEmail)}
                      className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#0095F6] focus:ring-1 focus:ring-[#0095F6] transition-all hover:border-white/20"
                    />
                  </div>
                </div>
              </>
            )}

            {/* LOGIN INPUT: USERNAME OR EMAIL */}
            {isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Username or Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Enter username or email..."
                    required
                    value={usernameOrEmail}
                    onChange={handleInputChange(setUsernameOrEmail)}
                    className="w-full pl-10 pr-4 py-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#0095F6] focus:ring-1 focus:ring-[#0095F6] transition-all hover:border-white/20 font-medium"
                  />
                </div>
              </div>
            )}

            {/* PASSWORD */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      playSound("click");
                      triggerToast("Password reset link sent!", "info");
                    }}
                    className="text-[10px] text-[#0095F6] font-semibold hover:underline cursor-pointer"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={handleInputChange(setPassword)}
                  className="w-full pl-10 pr-10 py-3 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:outline-hidden focus:border-[#0095F6] focus:ring-1 focus:ring-[#0095F6] transition-all hover:border-white/20 font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    playSound("click");
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-3 top-3.5 text-slate-500 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {!isLogin && password && (
                <div className="mt-1 flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-bold tracking-wider uppercase">
                    <span className="text-slate-500">Security Strength</span>
                    <span className={passwordStrengthLabel().text}>{passwordStrengthLabel().label}</span>
                  </div>
                  <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div 
                        key={idx}
                        className={`h-full flex-1 transition-all duration-300 ${
                          idx < passwordStrength ? passwordStrengthLabel().color : "bg-white/5"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CONFIRM PASSWORD (REGISTER ONLY) */}
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    required
                    value={confirmPassword}
                    onChange={handleInputChange(setConfirmPassword)}
                    className={`w-full pl-10 pr-4 py-3 bg-black/60 border rounded-xl text-xs text-white focus:outline-hidden transition-all ${
                      confirmPassword && password !== confirmPassword 
                        ? "border-red-500/50 focus:border-red-500" 
                        : confirmPassword && password === confirmPassword
                        ? "border-emerald-500/50 focus:border-emerald-500"
                        : "border-white/10 focus:border-[#0095F6]"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* REMEMBER ME (LOGIN ONLY) */}
            {isLogin && (
              <div className="flex items-center gap-2 my-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={() => {
                    playSound("click");
                    setRememberMe(!rememberMe);
                  }}
                  className="accent-[#0095F6] h-3.5 w-3.5 border-white/20 bg-black rounded-sm cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-[11px] font-medium text-slate-400 cursor-pointer hover:text-slate-300 select-none">
                  Keep me signed in
                </label>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#0095F6] to-[#0066FF] hover:from-blue-600 hover:to-blue-700 active:scale-98 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 cursor-pointer mt-2 tracking-wider uppercase"
            >
              <span>{isLogin ? "Log In to Raymi" : "Create Raymi Account"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Social Sign In Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative px-3 bg-[#0A0D14] text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              Quick Connect
            </span>
          </div>

          {/* Social SSO Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => handleThirdPartyLogin("Google")}
              className="py-2.5 bg-black/50 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl text-slate-200 flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer hover:border-[#0095F6]/40"
            >
              <Chrome className="h-4 w-4 text-[#0095F6]" />
              <span className="text-[10px] font-bold">Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleThirdPartyLogin("Apple")}
              className="py-2.5 bg-black/50 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl text-slate-200 flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer hover:border-white/40"
            >
              <Apple className="h-4 w-4 text-white" />
              <span className="text-[10px] font-bold">Apple</span>
            </button>

            <button
              type="button"
              onClick={() => handleThirdPartyLogin("Facebook")}
              className="py-2.5 bg-black/50 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl text-slate-200 flex items-center justify-center gap-1.5 text-xs transition-all cursor-pointer hover:border-[#1877F2]/40"
            >
              <Facebook className="h-4 w-4 text-[#1877F2]" />
              <span className="text-[10px] font-bold">Meta</span>
            </button>
          </div>

        </motion.div>
      </div>

      <InstallAppModal 
        isOpen={showInstallModal} 
        onClose={() => setShowInstallModal(false)} 
      />
    </div>
  );
};

