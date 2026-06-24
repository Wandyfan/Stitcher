/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from "react";
import { SkydivingState, ThemeProfile, SimulationStats, DropConfig } from "../types";
import { gameAudio } from "../utils/audio";
import { 
  Play, 
  RotateCcw, 
  Shield, 
  Cloud, 
  Sun, 
  Sunset, 
  Sunrise, 
  Compass, 
  Disc, 
  Volume2, 
  VolumeX, 
  Flame, 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Settings, 
  Activity, 
  MapPin, 
  Cpu,
  Camera,
  ExternalLink
} from "lucide-react";

interface SimulationUIProps {
  gameState: SkydivingState;
  setGameState: (state: SkydivingState) => void;
  dropConfig: DropConfig;
  setDropConfig: (config: DropConfig) => void;
  stats: SimulationStats;
  altitude: number;
  speed: number;
  gForce: number;
  heading: number;
  onLaunch: () => void;
  reqGyroPermission: () => Promise<void>;
  gyroStatus: "idle" | "granted" | "denied";
  onMuteToggle: () => void;
  isMuted: boolean;
  ionToken: string;
  setIonToken: (token: string) => void;
  onRestart: () => void;
  brandStep: number;
  setBrandStep: (step: number) => void;
  showMasterControls: boolean;
  setShowMasterControls: (show: boolean) => void;
}

export default function SimulationUI({
  gameState,
  setGameState,
  dropConfig,
  setDropConfig,
  stats,
  altitude,
  speed,
  gForce,
  heading,
  onLaunch,
  reqGyroPermission,
  gyroStatus,
  onMuteToggle,
  isMuted,
  ionToken,
  setIonToken,
  onRestart,
  brandStep,
  setBrandStep,
  showMasterControls,
  setShowMasterControls,
}: SimulationUIProps) {
  
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(10);

  // Sync state timers to handle 10-second ground level look-around after completion
  useEffect(() => {
    if (gameState !== SkydivingState.COMPLETE) {
      setShowSummary(false);
      setCountdown(10);
    } else if (gameState === SkydivingState.COMPLETE && stats.totalDescentTimeSec > 0) {
      setCountdown(10);
      const interval = setInterval(() => {
        setCountdown(prev => Math.max(prev - 1, 0));
      }, 1000);

      const timer = setTimeout(() => {
        setShowSummary(true);
      }, 10.0 * 1000);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [gameState, stats.totalDescentTimeSec]);

  // Calculate stroke dash offsets for circular HUD gauges
  // Circumference = 2 * Math.PI * 54 = 339.29
  const CIR = 339.29;

  const altitudeOffset = useMemo(() => {
    const ratio = Math.min(Math.max(altitude / dropConfig.altitudeStart, 0), 1);
    return CIR * (1 - ratio);
  }, [altitude, dropConfig.altitudeStart]);

  const speedOffset = useMemo(() => {
    const ratio = Math.min(Math.max(speed / 225, 0), 1.2);
    return CIR * (1 - Math.min(ratio, 1));
  }, [speed]);

  // Provide interactive responses on landing accuracy
  const accuracyRemark = useMemo(() => {
    if (stats.landingAccuracyPct >= 95) return { text: "Bullseye Landing on the Mariensäule!", color: "text-emerald-400" };
    if (stats.landingAccuracyPct >= 85) return { text: "Safe Plaza Touchdown! Perfect Flare.", color: "text-amber-400" };
    return { text: "Landed on a cafe umbrella! Still counted.", color: "text-rose-400" };
  }, [stats.landingAccuracyPct]);

  // White Cloud deck sweep calculation
  const cloudOpacity = useMemo(() => {
    // Peak mist density at 3,900m altitude
    const cloudStart = 4200;
    const cloudEnd = 3600;
    if (altitude > cloudStart || altitude < cloudEnd) return 0;
    const midPoint = (cloudStart + cloudEnd) / 2;
    const width = (cloudStart - cloudEnd) / 2;
    return Math.max(0, 1 - Math.abs(altitude - midPoint) / width);
  }, [altitude]);

  // Look controller custom event dispatcher
  const handleLookPress = (dir: "UP" | "DOWN" | "LEFT" | "RIGHT" | "CENTER") => {
    window.dispatchEvent(new CustomEvent("skydive-look", { detail: dir }));
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-20 flex flex-col justify-between">
      {/* 1. MIST CLOUD PENETRATION FLASH FRAME */}
      <div 
        className="absolute inset-0 bg-white transition-opacity duration-75 pointer-events-none"
        style={{ opacity: cloudOpacity }}
      />

      {/* TOP HEADER & MOBILE TELEMETRY CONTAINER */}
      <div className="w-full flex flex-col gap-2 z-30">
        {/* TOP HEADER CONTROLS (Always Visible) */}
        <div className="w-full p-4 pb-1 md:pb-4 flex justify-between items-center pointer-events-auto">
          <div />

          {/* Global Mute / Master Operator controls */}
          <div className="flex items-center gap-2">
            {/* Master Gear Controls */}
            <button
              type="button"
              onClick={() => setShowMasterControls(!showMasterControls)}
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/15 text-white/70 hover:text-white hover:border-amber-400 transition-all shadow-xl active:scale-95 cursor-pointer"
              title="Toggle Master Controls"
            >
              <Settings className={`w-4.5 h-4.5 sm:w-5 sm:h-5 transition-transform duration-300 ${showMasterControls ? "text-amber-400 rotate-90" : "text-white/60 hover:rotate-45"}`} />
            </button>

            {/* Mute toggle */}
            <button
              type="button"
              onClick={onMuteToggle}
              className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-950/40 backdrop-blur-xl border border-white/15 text-white/70 hover:text-white hover:border-white/25 transition-all shadow-xl active:scale-95 cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-red-400" /> : <Volume2 className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* MOBILE HORIZONTAL TELEMETRY BAR (Only during active jump) */}
        {gameState !== SkydivingState.COMPLETE && (
          <div className="md:hidden w-full px-4 pointer-events-auto flex justify-center">
            <div className="w-full max-w-md bg-slate-950/65 backdrop-blur-xl px-3 py-2.5 border border-white/15 rounded-2xl flex items-center justify-around shadow-xl">
              {/* Altitude Stat */}
              <div className="flex flex-col items-center">
                <span className="text-[7.5px] font-mono uppercase text-white/50 tracking-wider">Altitude</span>
                <span className="text-xs font-display font-black text-amber-400 tracking-tight">{Math.round(altitude)}m</span>
              </div>

              {/* Vertical separator */}
              <div className="w-[1px] h-5 bg-white/10" />

              {/* Speed Stat */}
              <div className="flex flex-col items-center">
                <span className="text-[7.5px] font-mono uppercase text-white/50 tracking-wider">Speed</span>
                <span className="text-xs font-display font-black text-amber-350 tracking-tight">{Math.round(speed)} km/h</span>
              </div>

              {/* Vertical separator */}
              <div className="w-[1px] h-5 bg-white/10" />

              {/* G-Force Stat */}
              <div className="flex flex-col items-center">
                <span className="text-[7.5px] font-mono uppercase text-white/50 tracking-wider">G-Force</span>
                <span className={`text-xs font-display font-black tracking-tight ${gForce > 3.0 ? "text-rose-400 animate-pulse" : "text-[#ffb000]"}`}>{gForce.toFixed(2)} G</span>
              </div>

              {/* Vertical separator */}
              <div className="w-[1px] h-5 bg-white/10" />

              {/* Stage/Vector */}
              <div className="flex flex-col items-center">
                <span className="text-[7.5px] font-mono uppercase text-white/50 tracking-wider">Stage</span>
                <span className="text-[8px] font-mono font-bold text-emerald-400 animate-pulse tracking-wide">
                  {gameState === SkydivingState.FREEFALL ? "FALL" :
                   gameState === SkydivingState.PARACHUTE_OPEN ? "DECEL" :
                   gameState === SkydivingState.PARACHUTE_DESCENT ? "GLIDE" : "LAND"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. THE CHOSEN APP VIEW ACCORDING TO STATE */}

      {/* A. START SCREEN / MISSION DASHBOARD */}
      {gameState === SkydivingState.COMPLETE && stats.totalDescentTimeSec === 0 && brandStep === 0 && (
        <div className="absolute inset-0 w-full h-full bg-[#07090e]/90 backdrop-blur-md flex justify-center p-4 md:items-center overflow-y-auto pointer-events-auto z-40">
          <div className="w-full max-w-xl frosted-glass-heavy rounded-2xl md:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6 my-auto scale-95 animate-fade-in relative overflow-hidden">
            
            {/* Background design glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col gap-1 items-center text-center">
              <span className="text-[10px] text-amber-400 font-mono tracking-[0.25em] uppercase font-bold">Cine-Simulation System</span>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">Munich 3D Skydive</h1>
              <p className="text-[11px] sm:text-xs text-white/60 max-w-sm mt-1 leading-relaxed">
                An immersive visual glide starting from 8,500m freefall down to Munich's historic Marienplatz square.
              </p>
            </div>

            {/* 1. Drop Profile Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-white/50 font-mono uppercase tracking-wider">Configure Drop Profile</label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => setDropConfig({ ...dropConfig, profile: "CLEAR_DAY" })}
                  className={`flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                    dropConfig.profile === "CLEAR_DAY"
                      ? "border-amber-400 bg-amber-400/10 text-white"
                      : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-400" />
                  <div>
                    <h3 className="font-medium text-[11px] sm:text-xs">Clear Noon</h3>
                    <p className="text-[9px] opacity-60">High contrast Bavarian light</p>
                  </div>
                </button>

                <button
                  onClick={() => setDropConfig({ ...dropConfig, profile: "CYBER_SUNSET" })}
                  className={`flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                    dropConfig.profile === "CYBER_SUNSET"
                      ? "border-pink-500 bg-pink-500/10 text-white"
                      : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                  }`}
                >
                  <Sunset className="w-4 h-4 text-pink-400" />
                  <div>
                    <h3 className="font-medium text-[11px] sm:text-xs">Cyber Sunset</h3>
                    <p className="text-[9px] opacity-60">Vibrant violet and gold aura</p>
                  </div>
                </button>

                <button
                  onClick={() => setDropConfig({ ...dropConfig, profile: "ALPINE_DAWN" })}
                  className={`flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                    dropConfig.profile === "ALPINE_DAWN"
                      ? "border-orange-400 bg-orange-400/10 text-white"
                      : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                  }`}
                >
                  <Sunrise className="w-4 h-4 text-orange-400" />
                  <div>
                    <h3 className="font-medium text-[11px] sm:text-xs">Alpine Dawn</h3>
                    <p className="text-[9px] opacity-60">Deep mountain mist & amber sky</p>
                  </div>
                </button>

                <button
                  onClick={() => setDropConfig({ ...dropConfig, profile: "MIDNIGHT_NEON" })}
                  className={`flex flex-col gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-xl border text-left transition-all ${
                    dropConfig.profile === "MIDNIGHT_NEON"
                      ? "border-sky-400 bg-sky-400/10 text-white"
                      : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                  }`}
                >
                  <Compass className="w-4 h-4 text-sky-400" />
                  <div>
                    <h3 className="font-medium text-[11px] sm:text-xs">Midnight Neon</h3>
                    <p className="text-[9px] opacity-60">Dark city with glowing spires</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Cloud Density Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-white/50 font-mono uppercase tracking-wider">Atmospheric Clouds Density</label>
              <div className="grid grid-cols-3 gap-2">
                {(["NONE", "LOW", "HEAVY"] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => setDropConfig({ ...dropConfig, cloudsDensity: density })}
                    className={`py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-mono transition-all ${
                      dropConfig.cloudsDensity === density
                        ? "border-white bg-white/10 text-white"
                        : "border-white/5 bg-white/5 text-white/50 hover:border-white/10"
                    }`}
                  >
                    {density}
                  </button>
                ))}
              </div>
            </div>

            {/* Gyroscope Requests section */}
            <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <h4 className="text-[11px] sm:text-xs font-medium">Head-Look Gyroscope Access</h4>
                  <p className="text-[9px] sm:text-[10px] text-white/60 leading-relaxed">
                    Accesses your phone's gyroscope to allow you to look around naturally while falling. Default is mouse-pan.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[9px] sm:text-[10px] font-mono uppercase text-white/40">Status: {gyroStatus.toUpperCase()}</span>
                {gyroStatus !== "granted" ? (
                  <button
                    onClick={reqGyroPermission}
                    className="font-mono text-[9px] sm:text-[10px] bg-white/10 text-white font-medium hover:bg-white/15 px-2.5 py-1 sm:py-1.5 rounded-lg border border-white/10 transition-all pointer-events-auto"
                  >
                    Authorize Sensors
                  </button>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 font-bold tracking-wider">ACTIVE</span>
                )}
              </div>
            </div>

            {/* Master Cesium Ion Token Input Option (Optional) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-white/50 font-mono uppercase tracking-wider">Cesium Ion Access Token (Optional)</label>
                <a target="_blank" href="https://cesium.com/ion" className="text-[9px] text-[#ffc133] hover:underline">Get Token</a>
              </div>
              <input
                type="password"
                placeholder="Insert custom Ion token to load Photorealistic 3D buildings..."
                value={ionToken}
                onChange={(e) => setIonToken(e.target.value)}
                className="w-full bg-black/40 border border-white/10 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-mono text-amber-100 placeholder:text-white/20 focus:outline-none focus:border-amber-400/60 pointer-events-auto"
              />
              <p className="text-[9px] text-white/40 font-mono leading-tight">
                Leaving empty is fully supported. Falls back to flat terrain rendering with a magnificent styled 3D model representation of Marienplatz center.
              </p>
            </div>

            {/* Realistic Vid Clouds Settings */}
            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/5 border border-white/15">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-[10px] text-white/70 font-mono uppercase tracking-wider font-bold">Alpha Clouds Video Overlay</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  placeholder="Paste Realistic Sky Cloud Video Loop URL"
                  value={dropConfig.cloudVideoUrl || ""}
                  onChange={(e) => setDropConfig({ ...dropConfig, cloudVideoUrl: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono text-amber-100 placeholder:text-white/20 focus:outline-none focus:border-amber-400/60 pointer-events-auto"
                />
                <p className="text-[9px] text-white/40 font-mono leading-tight">
                  Supports any public MP4 or WebM video. Plays over the map with screen blending, dynamically timed (playbackRate) with your real physical fall speed!
                </p>
              </div>
            </div>

            {/* Launch Button */}
            <button
              onClick={onLaunch}
              className="w-full py-3.5 sm:py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold uppercase select-none rounded-2xl flex items-center justify-center gap-2 glowing-button cursor-pointer font-sans pointer-events-auto"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
              <span>Launch Skydive Simulation</span>
            </button>
          </div>
        </div>
      )}

      {/* B. ACTIVE SIMULATION HUD INTERFACE */}
      {brandStep === 0 && (gameState === SkydivingState.FREEFALL ||
        gameState === SkydivingState.PARACHUTE_OPEN ||
        gameState === SkydivingState.PARACHUTE_DESCENT ||
        gameState === SkydivingState.LANDING ||
        (gameState === SkydivingState.COMPLETE && !showSummary)) && (
        <div className="absolute inset-0 w-full h-full pointer-events-none">
          
          {/* USER SPECIFIED ALTITUDE & SPEED GAUGES (Desktop Only) */}
          <div className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 w-[160px] py-6 px-3 rounded-[32px] bg-white/12 backdrop-blur-xl border border-white/20 shadow-2xl select-none flex-col gap-4 items-center pointer-events-auto z-10 transition-all">
            <div className="gauge">
              <svg className="w-[120px] h-[120px] transform rotate-[-90deg]" viewBox="0 0 120 120">
                <circle 
                  className="fill-none stroke-white/10"
                  cx="60" 
                  cy="60" 
                  r="54" 
                  strokeWidth="4" 
                />
                <circle 
                  className="fill-none stroke-amber-500 stroke-[4px] rounded-full transition-all duration-75"
                  cx="60" 
                  cy="60" 
                  r="54" 
                  strokeDasharray={CIR}
                  strokeDashoffset={altitudeOffset}
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 4px #ffb000)" }}
                />
              </svg>
              <div className="gauge-value font-display font-extrabold text-[#ffc133] absolute top-[28px] left-0 right-0 text-center tracking-tight" id="altitudeValue">
                {Math.round(altitude)}
              </div>
              <div className="gauge-unit text-[10px] uppercase font-bold text-white/50 absolute top-[54px] left-0 right-0 text-center tracking-wider">
                meters
              </div>
              <div className="gauge-label font-bold text-[9px] uppercase tracking-[0.2em] text-[#ffd278]/80 text-center absolute bottom-3 left-0 right-0">
                Altitude
              </div>
            </div>

            <div className="gauge mt-2">
              <svg className="w-[120px] h-[120px] transform rotate-[-90deg]" viewBox="0 0 120 120">
                <circle 
                  className="fill-none stroke-white/10"
                  cx="60" 
                  cy="60" 
                  r="54" 
                  strokeWidth="4" 
                />
                <circle 
                  className="fill-none stroke-[#ffd278] stroke-[4px] rounded-full transition-all duration-75"
                  cx="60" 
                  cy="60" 
                  r="54" 
                  strokeDasharray={CIR}
                  strokeDashoffset={speedOffset}
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 4px #ffd278)" }}
                />
              </svg>
              <div className="gauge-value font-display font-extrabold text-[#ffc133] absolute top-[28px] left-0 right-0 text-center tracking-tight" id="speedValue">
                {Math.round(speed)}
              </div>
              <div className="gauge-unit text-[10px] uppercase font-bold text-white/50 absolute top-[54px] left-0 right-0 text-center tracking-wider">
                km/h
              </div>
              <div className="gauge-label font-bold text-[9px] uppercase tracking-[0.2em] text-[#ffd278]/80 text-center absolute bottom-3 left-0 right-0">
                Speed
              </div>
            </div>

            {/* Divider line exactly like the design HTML */}
            <div className="w-[100px] h-[1px] bg-white/15 my-1" />

            {/* G-FORCE indicator section */}
            <div className="text-center select-none">
              <div className="text-[10px] text-white/50 tracking-wider uppercase mb-1 font-mono font-bold">G-Force</div>
              <div className="text-xl font-extrabold text-[#ffb000] drop-shadow-[0_0_4px_#ffb000]">{gForce.toFixed(2)}</div>
            </div>
          </div>

          {/* EYE TRACKER CENTER VIEWPORT CROSSHAIR */}
          <div className="crosshair select-none pointer-events-none" />



          {/* BOTTOM TIMELINE PILL FOOTER FOR MAIN GRAPHICS */}
          <div className="absolute bottom-[100px] sm:bottom-[110px] left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-xl px-3 sm:px-5 py-1.5 sm:py-2 rounded-full border border-white/15 flex gap-3 sm:gap-6 items-center z-30 pointer-events-auto transition-all shadow-xl whitespace-nowrap">
            <div className={`flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider transition-opacity ${
              gameState === SkydivingState.FREEFALL ? "opacity-100 text-white" : "opacity-30 text-white/60"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-red-400 ${gameState === SkydivingState.FREEFALL ? "animate-pulse" : ""}`} />
              <span>FREEFALL</span>
            </div>
            <div className={`flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider transition-opacity ${
              (gameState === SkydivingState.PARACHUTE_OPEN || gameState === SkydivingState.PARACHUTE_DESCENT) ? "opacity-100 text-white" : "opacity-30 text-white/60"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${gameState === SkydivingState.PARACHUTE_DESCENT ? "animate-pulse" : ""}`} />
              <span>PARACHUTE</span>
            </div>
            <div className={`flex items-center gap-1 sm:gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-wider transition-opacity ${
              gameState === SkydivingState.LANDING ? "opacity-100 text-white" : "opacity-30 text-white/60"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${gameState === SkydivingState.LANDING ? "animate-bounce" : ""}`} />
              <span>LANDING</span>
            </div>
          </div>

          {/* BOTTOM MAIN INTERACTIVE PULL CHUTE LEVER OR MESSAGE */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-auto z-40 w-full max-w-sm px-4">
            {gameState === SkydivingState.FREEFALL && (
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                {altitude > 1010 ? (
                  <button
                    onClick={() => {
                      setGameState(SkydivingState.PARACHUTE_OPEN);
                    }}
                    className="w-16 h-16 rounded-full font-display font-extrabold text-[#ffffff] bg-gradient-to-r from-red-600 via-orange-500 to-red-600 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] border border-red-500/30 cursor-pointer animate-bounce"
                    title="Deploy Parachute"
                  >
                    <Flame className="w-6 h-6 animate-pulse" />
                  </button>
                ) : (
                  <div className="bg-slate-950/65 backdrop-blur-md text-slate-400 border border-white/5 font-mono text-[9px] sm:text-[10px] py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl text-center shadow-lg uppercase tracking-wider">
                    Auto-Deploying Emergency Canopy
                  </div>
                )}
                {altitude > 1010 && (
                  <p className="text-[8px] sm:text-[9px] text-[#ffb000] font-mono text-center tracking-wider animate-pulse uppercase">
                    Alert: Deploy ripcord before emergency auto-brakes trigger at 1,000m!
                  </p>
                )}
              </div>
            )}

            {gameState === SkydivingState.PARACHUTE_DESCENT && (
              <div className="w-full bg-slate-900/60 backdrop-blur-md border border-white/15 p-2.5 sm:p-3 rounded-2xl flex flex-col gap-1 items-center justify-center text-center">
                <span className="text-[8px] sm:text-[9px] text-emerald-400 font-mono tracking-widest uppercase font-bold animate-pulse">Parachute Deployed successfully</span>
                <span className="text-[9px] sm:text-[10px] text-white/70 font-sans leading-tight">Gliding into Munich Marienplatz central landing pad. Let's look around!</span>
              </div>
            )}

            {/* D. GROUND LEVEL 10S CHRONO COUNTDOWN LOOK-AROUND FOOTER ACCENT */}
            {gameState === SkydivingState.COMPLETE && stats.totalDescentTimeSec > 0 && !showSummary && (
              <div className="w-full bg-slate-950/75 backdrop-blur-xl border border-emerald-500/30 p-3 sm:p-4 rounded-2xl flex flex-col gap-1 sm:gap-1.5 items-center justify-center text-center animate-fade-in shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[9px] sm:text-[10px] text-emerald-400 font-mono tracking-[0.2em] font-bold uppercase">TOUCHDOWN AT MARIENPLATZ!</span>
                </div>
                <span className="text-[10px] sm:text-[11px] text-white/90 font-sans leading-tight">Deceleration complete. Explore the full 3D plaza! Report loads in {countdown}s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* C. LANDING SUMMARY FLIGHT LOG ACCURACY */}
      {gameState === SkydivingState.COMPLETE && stats.totalDescentTimeSec > 0 && showSummary && brandStep === 0 && (
        <div className="absolute inset-0 w-full h-full bg-[#07090e]/95 backdrop-blur-md flex justify-center p-4 md:items-center overflow-y-auto pointer-events-auto z-40">
          <div className="w-full max-w-lg frosted-glass-heavy rounded-2xl md:rounded-[32px] p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6 my-auto scale-95 animate-fade-in relative text-center overflow-hidden">
            
            {/* Header */}
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[9px] text-emerald-400 font-mono tracking-[0.25em] uppercase font-bold">Mission Completed</span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">Drop Simulation Report</h2>
              <div className={`mt-1.5 py-0.5 px-3 rounded-full border border-white/5 bg-white/5 font-mono text-[10px] ${accuracyRemark.color}`}>
                {accuracyRemark.text}
              </div>
            </div>

            {/* Tactical grid metrics list */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-1">
              <div className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase tracking-widest">Landing Accuracy</span>
                <span className="text-xl sm:text-2xl font-display font-black text-emerald-400">{stats.landingAccuracyPct}%</span>
                <span className="text-[9px] text-white/50 leading-tight">Variance from Mariensäule base</span>
              </div>

              <div className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase tracking-widest">Peak Speed Hit</span>
                <span className="text-xl sm:text-2xl font-display font-black text-amber-400">{stats.peakVelocityKmh} km/h</span>
                <span className="text-[9px] text-white/50 leading-tight">Terminal air friction max</span>
              </div>

              <div className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase tracking-widest">Max G-Stress</span>
                <span className="text-xl sm:text-2xl font-display font-black text-rose-400">{stats.gForceMax} G</span>
                <span className="text-[9px] text-white/50 leading-tight">Deceleration shock</span>
              </div>

              <div className="bg-white/5 border border-white/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-left flex flex-col gap-0.5 sm:gap-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase tracking-widest">Total Air Time</span>
                <span className="text-xl sm:text-2xl font-display font-black text-sky-400">{stats.totalDescentTimeSec} s</span>
                <span className="text-[9px] text-white/50 leading-tight">Cinematic glide duration</span>
              </div>
            </div>

            {/* Descent timeline stats details */}
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-black/35 border border-white/10 text-left flex flex-col gap-2.5 font-mono text-[11px] sm:text-xs text-white/60">
              <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-white/40 border-b border-white/5 pb-1.5">
                <span>Flight timeline milestones</span>
                <span>Altitude</span>
              </div>
              <div className="flex justify-between leading-none">
                <span>- Drops launch from plane</span>
                <span>{dropConfig.altitudeStart} m</span>
              </div>
              <div className="flex justify-between leading-none text-yellow-105">
                <span>- Canopy deployment trigger</span>
                <span>{stats.parachuteDeployAltitude} m</span>
              </div>
              <div className="flex justify-between leading-none">
                <span>- Touchdown Marienplatz center</span>
                <span>0 m</span>
              </div>
            </div>

            {/* Launch Again Button */}
            <button
              onClick={onRestart}
              className="w-full py-3.5 sm:py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold uppercase rounded-2xl flex items-center justify-center gap-2 glowing-button cursor-pointer font-sans"
            >
              <RotateCcw className="w-5 h-5 text-slate-950" />
              <span>Launch New Skydiving Drop</span>
            </button>
          </div>
        </div>
      )}

      {/* C. SLIDING MASTER OPERATOR CONTROLS DRAWER PANEL */}
      {showMasterControls && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex justify-end pointer-events-auto">
          <div className="w-full max-w-sm sm:max-w-md bg-[#0a111a]/95 border-l border-white/10 h-full flex flex-col shadow-2xl relative text-white animate-fade-in pr-0">
            
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/30">
              <div className="flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-amber-400 animate-spin" />
                <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider text-white">Master Operator Controls</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterControls(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 hover:border-amber-400 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scroll Container */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              
              {/* Telemetry quick view info */}
              <div className="p-3.5 bg-black/40 border border-white/5 rounded-xl grid grid-cols-2 gap-3.5 text-xs font-mono">
                <div>
                  <span className="block text-[8px] text-white/40 uppercase tracking-wider">Flight State</span>
                  <span className="font-bold text-emerald-400">{gameState}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-white/40 uppercase tracking-wider">Altitude Tick</span>
                  <span className="font-bold text-amber-400">{Math.round(altitude)} m</span>
                </div>
                <div>
                  <span className="block text-[8px] text-white/40 uppercase tracking-wider">Current Velocity</span>
                  <span className="font-bold text-sky-400">{Math.round(speed)} km/h</span>
                </div>
                <div>
                  <span className="block text-[8px] text-white/40 uppercase tracking-wider">Impact Force</span>
                  <span className="font-bold text-rose-400">{gForce.toFixed(2)} G</span>
                </div>
              </div>

              {/* Descent Metrics Log if any completed flights */}
              {stats.totalDescentTimeSec > 0 && (
                <div className="p-4 bg-[#112431]/70 border border-emerald-500/20 rounded-xl flex flex-col gap-2.5 text-xs">
                  <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-black flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Descent Stats Logs</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono leading-relaxed">
                    <div>Landing Acc: <span className="text-white font-bold">{stats.landingAccuracyPct}%</span></div>
                    <div>Peak-Vel: <span className="text-white font-bold">{stats.peakVelocityKmh} km/h</span></div>
                    <div>Max-G: <span className="text-white font-bold">{stats.gForceMax} G</span></div>
                    <div>Airtime: <span className="text-white font-bold">{stats.totalDescentTimeSec} s</span></div>
                  </div>
                  <div className="text-[10px] opacity-60 font-serif leading-tight">
                    Remark: <span className="font-sans font-semibold text-amber-300">{accuracyRemark.text}</span>
                  </div>
                </div>
              )}

              {/* Drop Profile Select Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[9.5px] text-white/50 font-mono uppercase tracking-wider font-bold">Select Drop Profile</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDropConfig({ ...dropConfig, profile: "CLEAR_DAY" })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      dropConfig.profile === "CLEAR_DAY"
                        ? "border-amber-450 bg-amber-450/10 text-white"
                        : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-450" />
                    <span className="text-[10.5px]">Clear Noon</span>
                  </button>

                  <button
                    onClick={() => setDropConfig({ ...dropConfig, profile: "CYBER_SUNSET" })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      dropConfig.profile === "CYBER_SUNSET"
                        ? "border-pink-500 bg-pink-500/10 text-white"
                        : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                    }`}
                  >
                    <Sunset className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-[10.5px]">Cyber Sunset</span>
                  </button>

                  <button
                    onClick={() => setDropConfig({ ...dropConfig, profile: "ALPINE_DAWN" })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      dropConfig.profile === "ALPINE_DAWN"
                        ? "border-orange-400 bg-orange-400/10 text-white"
                        : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                    }`}
                  >
                    <Sunrise className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[10.5px]">Alpine Dawn</span>
                  </button>

                  <button
                    onClick={() => setDropConfig({ ...dropConfig, profile: "MIDNIGHT_NEON" })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      dropConfig.profile === "MIDNIGHT_NEON"
                        ? "border-sky-400 bg-sky-400/10 text-white"
                        : "border-white/5 bg-white/5 text-white/60 hover:border-white/10"
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-[10.5px]">Midnight Neon</span>
                  </button>
                </div>
              </div>

              {/* Cloud Level Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[9.5px] text-white/50 font-mono uppercase tracking-wider font-bold">Cloud Density Selection</label>
                <div className="grid grid-cols-3 gap-2 block">
                  {(["NONE", "LOW", "HEAVY"] as const).map((density) => (
                    <button
                      key={density}
                      onClick={() => setDropConfig({ ...dropConfig, cloudsDensity: density })}
                      className={`py-2 rounded-xl border text-[10px] font-mono transition-all cursor-pointer ${
                        dropConfig.cloudsDensity === density
                          ? "border-white bg-white/10 text-white font-bold"
                          : "border-white/5 bg-white/5 text-white/50 hover:border-white/10"
                      }`}
                    >
                      {density}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gyro controller permission toggle */}
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between text-xs gap-3">
                <span className="font-mono text-[9px] text-white/50 uppercase tracking-wide">Device Gyroscope Auth: {gyroStatus.toUpperCase()}</span>
                {gyroStatus !== "granted" && (
                  <button
                    type="button"
                    onClick={reqGyroPermission}
                    className="font-mono text-[9px] bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded border border-white/10 transition-all pointer-events-auto cursor-pointer text-white"
                  >
                    Authorize
                  </button>
                )}
              </div>

              {/* Master Cesium Token Input option */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[9.5px] text-white/50 font-mono uppercase tracking-wider font-bold">Cesium Ion Access Token</label>
                  <a target="_blank" rel="noreferrer" href="https://cesium.com/ion" className="text-[9px] text-[#ffc133] hover:underline flex items-center gap-0.5 pointer-events-auto">
                    <span>Get Token</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="Insert custom Ion credentials..."
                  value={ionToken}
                  onChange={(e) => setIonToken(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded-xl text-xs font-mono text-amber-100 placeholder:text-white/20 focus:outline-none focus:border-amber-400/60 pointer-events-auto"
                />
              </div>

              {/* Video Clouds settings */}
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                <span className="font-mono text-[9px] uppercase font-bold text-white/70">Realistic Cloud Overlay URL</span>
                <input
                  type="text"
                  placeholder="Paste transparent cloud MP4/WebM loop URL"
                  value={dropConfig.cloudVideoUrl || ""}
                  onChange={(e) => setDropConfig({ ...dropConfig, cloudVideoUrl: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-mono text-amber-100 placeholder:text-white/20 focus:outline-none focus:border-amber-400/60 pointer-events-auto"
                />
              </div>

              {/* Instant Event Action Toggles */}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBrandStep(4); // Instant switch directly to Postcard selfie
                    setShowMasterControls(false);
                  }}
                  className="w-full py-2 bg-[#e32938] hover:bg-red-500 text-white rounded-lg text-xs tracking-wider font-bold uppercase transition-all select-none cursor-pointer flex items-center justify-center gap-1.5 shadow"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Force Selfie post-flight</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRestart();
                    setShowMasterControls(false);
                    setBrandStep(1);
                  }}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white/90 hover:text-white rounded-lg border border-white/10 text-xs tracking-wider uppercase transition-all select-none cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restart App Simulation</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
