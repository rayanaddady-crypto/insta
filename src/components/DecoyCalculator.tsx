import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { Sparkles, Calculator, Newspaper, HelpCircle } from "lucide-react";
import { motion } from "motion/react";

export const DecoyCalculator: React.FC = () => {
  const { deactivateDecoy } = useAuth();
  const [display, setDisplay] = useState<string>("0");
  const [equation, setEquation] = useState<string>("");
  const [history, setHistory] = useState<string[]>([]);
  
  // Custom calculator operations
  const handleNum = (num: string) => {
    setDisplay((prev) => {
      if (prev === "0") return num;
      return prev + num;
    });
    setEquation((prev) => prev + num);
  };

  const handleOperator = (op: string) => {
    setDisplay("0");
    setEquation((prev) => prev + " " + op + " ");
  };

  const handleClear = () => {
    setDisplay("0");
    setEquation("");
  };

  const handleCalculate = () => {
    const cleanEq = equation.trim();
    
    // Check for the secret bypass code
    if (cleanEq === "9876") {
      deactivateDecoy();
      return;
    }

    try {
      // Safe alternative to eval for simple calculator operations
      // Only supports safe arithmetic expressions
      if (!/^[0-9+\-*/.\s]+$/.test(cleanEq)) {
        throw new Error("Invalid format");
      }
      
      const result = Function(`"use strict"; return (${cleanEq})`)();
      const finalResult = String(result);
      
      setDisplay(finalResult);
      setHistory((prev) => [...prev, `${cleanEq} = ${finalResult}`].slice(-4));
      setEquation(finalResult);
    } catch (err) {
      setDisplay("Error");
      setEquation("");
    }
  };

  return (
    <div id="decoy-root" className="min-h-screen bg-[#0A0A0B] text-white flex flex-col items-center justify-center font-sans p-4 relative selection:bg-orange-500 select-none">
      
      {/* Camouflage Background Grid and Soft Ambient Lights */}
      <div className="absolute top-[15%] left-[20%] w-[300px] h-[300px] rounded-full bg-[#FF7A00]/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[15%] right-[20%] w-[350px] h-[350px] rounded-full bg-slate-500/5 blur-[120px] pointer-events-none" />

      {/* Calculator Container */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="w-full max-w-[360px] bg-neutral-900/80 border border-white/5 backdrop-blur-2xl rounded-[32px] p-6 shadow-2xl relative"
      >
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-linear-to-r from-transparent via-white/10 to-transparent" />
        
        {/* Camouflage Top-bar */}
        <div className="flex items-center justify-between mb-6 px-1 text-slate-500">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-[#FF7A00]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Math Utility</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
          </div>
        </div>

        {/* Display Screen */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-5 mb-5 text-right flex flex-col justify-end min-h-[100px] relative overflow-hidden">
          <div className="absolute top-2 left-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] font-bold text-emerald-500/70 uppercase tracking-wider">Floating Point Engine</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium truncate mb-1 tracking-wider">
            {equation || "0"}
          </div>
          <div className="text-3xl font-light font-mono truncate tracking-tight text-white">
            {display}
          </div>
        </div>

        {/* Dynamic Buttons Layout */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1 */}
          <button 
            onClick={handleClear}
            className="h-14 rounded-2xl bg-[#1E1E1F] hover:bg-[#2A2A2B] active:scale-95 text-xs font-bold text-[#FF7A00] transition-all cursor-pointer"
          >
            AC
          </button>
          <button 
            onClick={() => handleOperator("/")}
            className="h-14 rounded-2xl bg-[#1E1E1F] hover:bg-[#2A2A2B] active:scale-95 text-sm font-bold text-slate-300 transition-all cursor-pointer"
          >
            ÷
          </button>
          <button 
            onClick={() => handleOperator("*")}
            className="h-14 rounded-2xl bg-[#1E1E1F] hover:bg-[#2A2A2B] active:scale-95 text-sm font-bold text-slate-300 transition-all cursor-pointer"
          >
            ×
          </button>
          <button 
            onClick={() => handleOperator("-")}
            className="h-14 rounded-2xl bg-[#FF7A00]/10 hover:bg-[#FF7A00]/25 text-[#FF7A00] active:scale-95 text-base font-bold transition-all cursor-pointer"
          >
            -
          </button>

          {/* Row 2 */}
          <button 
            onClick={() => handleNum("7")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            7
          </button>
          <button 
            onClick={() => handleNum("8")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            8
          </button>
          <button 
            onClick={() => handleNum("9")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            9
          </button>
          <button 
            onClick={() => handleOperator("+")}
            className="h-14 rounded-2xl bg-[#FF7A00]/10 hover:bg-[#FF7A00]/25 text-[#FF7A00] active:scale-95 text-base font-bold transition-all cursor-pointer"
          >
            +
          </button>

          {/* Row 3 */}
          <button 
            onClick={() => handleNum("4")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            4
          </button>
          <button 
            onClick={() => handleNum("5")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            5
          </button>
          <button 
            onClick={() => handleNum("6")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            6
          </button>
          <button 
            onClick={() => handleNum(".")}
            className="h-14 rounded-2xl bg-[#1E1E1F] hover:bg-[#2A2A2B] active:scale-95 text-base font-bold text-slate-300 transition-all cursor-pointer"
          >
            .
          </button>

          {/* Row 4 */}
          <button 
            onClick={() => handleNum("1")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            1
          </button>
          <button 
            onClick={() => handleNum("2")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            2
          </button>
          <button 
            onClick={() => handleNum("3")}
            className="h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            3
          </button>
          <button 
            onClick={handleCalculate}
            className="h-14 rounded-2xl bg-[#FF7A00] hover:bg-orange-600 active:scale-95 text-lg font-bold text-white transition-all cursor-pointer shadow-lg shadow-orange-500/15"
          >
            =
          </button>
        </div>

        {/* Zero Center Button */}
        <div className="mt-3">
          <button 
            onClick={() => handleNum("0")}
            className="w-full h-14 rounded-2xl bg-[#141415] hover:bg-[#1E1E1F] active:scale-95 text-base font-medium transition-all cursor-pointer"
          >
            0
          </button>
        </div>
      </motion.div>

      {/* Camouflage Instructions / Help Panel */}
      <div className="mt-6 flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-white/5 border border-white/5 px-4 py-2 rounded-full backdrop-blur-xs select-none">
        <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
        <span>Camouflage Mode Enabled</span>
      </div>
    </div>
  );
};
