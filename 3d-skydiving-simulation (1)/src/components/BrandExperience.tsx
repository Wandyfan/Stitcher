/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { SkydivingState, SimulationStats } from "../types";
import { 
  Check, 
  X, 
  Camera, 
  RotateCcw, 
  Printer, 
  Star, 
  Minus, 
  Plus, 
  Heart, 
  Info, 
  HelpCircle, 
  ExternalLink,
  Play
} from "lucide-react";

interface BrandExperienceProps {
  gameState: SkydivingState;
  setGameState: (state: SkydivingState) => void;
  brandStep: number;
  setBrandStep: (step: number) => void;
  onLaunch: () => void;
  onRestart: () => void;
  stats: SimulationStats;
  showMasterControls: boolean;
  setShowMasterControls: (show: boolean) => void;
}

export default function BrandExperience({
  gameState,
  setGameState,
  brandStep,
  setBrandStep,
  onLaunch,
  onRestart,
  stats,
  showMasterControls,
  setShowMasterControls
}: BrandExperienceProps) {
  // Checkbox/Consent States
  const [step1Checked, setStep1Checked] = useState<boolean>(false);
  const [step9Checked, setStep9Checked] = useState<boolean>(false);

  // Counter/Selector States
  const [ticketQuantity, setTicketQuantity] = useState<number>(1);

  // Interactive Rating State
  const [userRating, setUserRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  // Disclaimer Dialog Popup
  const [showDisclaimerPopup, setShowDisclaimerPopup] = useState<boolean>(false);

  // Camera & Image Capture state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Flash element trigger
  const [flashTriggered, setFlashTriggered] = useState<boolean>(false);

  // Start webcam access for selfie flow (Step 4)
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setCameraError("Webcam APIs are not supported in your browser context.");
      }
    } catch (err: any) {
      console.warn("Camera access denied or unavailable:", err);
      setCameraError("Camera access was denied. Standard customized postcard fallback will be generated.");
    }
  };

  // Stop webcam stream when moving away
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Cleanup camera streams on unmount or step changes
  useEffect(() => {
    if (brandStep === 4) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [brandStep]);

  // Handle countdown sequences for camera snaps (Step 4 -> Countdown -> Snap)
  const runCaptureCountdown = () => {
    setBrandStep(5); // Countdown 3
    
    setTimeout(() => {
      setBrandStep(6); // Countdown 2
    }, 1000);

    setTimeout(() => {
      setBrandStep(7); // Countdown 1
    }, 2000);

    setTimeout(() => {
      // Shutter Trigger! Flash then render
      setFlashTriggered(true);
      setTimeout(() => setFlashTriggered(false), 300);

      captureCanvasSnapshot();
      setBrandStep(8); // Review Photo Page
    }, 3000);
  };

  // Capture current image on a temporary canvas
  const captureCanvasSnapshot = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        // Clear with sunset gradient first as high Class fallback background
        const grad = ctx.createLinearGradient(0, 0, 0, 480);
        grad.addColorStop(0, "#e32938");
        grad.addColorStop(0.5, "#e87a24");
        grad.addColorStop(1, "#fbc531");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 640, 480);

        // Draw Webcam Feed if playing successfully
        if (isCameraActive && videoRef.current) {
          // Mirror selfie horizontally for standard feel
          ctx.translate(640, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Restore transform
        } else {
          // Overlay fallback skydiving vector graphics
          ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
          ctx.beginPath();
          ctx.arc(320, 240, 100, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 24px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("MUNICH 3D GLIDE", 320, 210);
          ctx.font = "14px monospace";
          ctx.fillText("TOUCHDOWN MEMORY", 320, 240);
        }

        // Overlay brand text framing
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 410, 640, 70);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("OZEMPİC® (semaglutide) injection", 24, 438);

        ctx.font = "10px monospace";
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillText(`Landing Accuracy: ${stats?.landingAccuracyPct || 92}% | Marienplatz LZ`, 24, 458);

        ctx.textAlign = "right";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#fbc531";
        ctx.fillText("SEPTEMBER 2026", 616, 442);
        ctx.font = "8px sans-serif";
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.fillText("IT26OZM00027", 616, 458);

        setCapturedPhotoUrl(canvas.toDataURL("image/jpeg"));
      }
    } catch (e) {
      console.error("Canvas photo snapshot generation failed:", e);
    }
  };

  // Re-take action
  const handleRetryPhoto = () => {
    setCapturedPhotoUrl(null);
    setBrandStep(4);
  };  // Ozempic Branded Linear Sunset Gradient Background (Deep red #e23a47 -> orange #ef7e36 -> warm yellow #f4b62a)
  const brandGradientClass = "bg-gradient-to-b from-[#e23a47] via-[#ef7e36] to-[#f4b62a]";

  // Centered white "OZEMPIC®" wordmark in heavy rounded sans with leaping person figure acting as the dot on the 'i'
  const OzempicLogo = () => (
    <div className="flex flex-col items-center select-none py-1 pointer-events-auto">
      <div className="flex items-center relative gap-[1px]">
        <h1 className="text-white font-[950] tracking-[0.05em] text-3xl sm:text-4.5xl uppercase flex items-end font-sans">
          <span>OZEMP</span>
          <span className="relative inline-block select-none">
            <span className="text-white opacity-0">I</span>
            {/* The leaping person figure acting as the dot on the 'I' */}
            <span className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center">
              <span className="text-white font-[950]">I</span>
            </span>
            <span className="absolute -top-[8px] sm:-top-[11px] left-1/2 -translate-x-[55%] w-4 h-4 sm:w-5 sm:h-5 text-white">
              <svg viewBox="0 0 100 100" className="w-4 h-4 sm:w-5 sm:h-5 fill-white stroke-none drop-shadow">
                <circle cx="50" cy="20" r="12" />
                <path d="M 22 55 C 28 45, 38 38, 48 40 C 58 42, 63 48, 70 41 C 78 35, 82 25, 82 25 C 82 25, 76 38, 65 43 C 58 46, 52 52, 48 60 C 44 68, 38 82, 38 82 C 38 82, 36 72, 30 65 C 24 58, 22 55, 22 55 Z" />
                <path d="M 45 40 C 42 32, 30 25, 30 25 C 30 25, 41 28, 52 35 Z" />
              </svg>
            </span>
          </span>
          <span>C</span>
        </h1>
        <span className="text-white font-extrabold text-[11px] sm:text-[13px] self-start mt-2">®</span>
      </div>
    </div>
  );

  // Persistent Badges Footer
  const BrandFooter = () => (
    <div className="w-full flex justify-between items-center px-6 py-4 mt-auto pointer-events-auto text-[10px] sm:text-xs text-white/85 select-none font-sans font-semibold tracking-wide">
      <button 
        onClick={() => setShowDisclaimerPopup(true)}
        className="hover:text-white transition-all underline flex items-center gap-1 cursor-pointer"
      >
        Disclaimer ›
      </button>
      <span className="font-mono tracking-wider text-white/85">IT26OZM00027 September 2026</span>
      <span className="text-white/85">
        ‹ For HCP only
      </span>
    </div>
  );

  // If experience is not completed and brand step is inactive, return null
  if (brandStep === 0) {
    return null;
  }

  return (
    <div className={`absolute inset-0 w-full h-full ${brandGradientClass} flex flex-col justify-between items-center overflow-y-auto pointer-events-auto z-40 font-sans`}>
      
      {/* SHUTTER SPEED FLASH SCREEN CONTAINER */}
      <div className={`absolute inset-0 bg-white transition-opacity duration-200 z-50 pointer-events-none ${
        flashTriggered ? "opacity-100" : "opacity-0"
      }`} />

      {/* Floating Panel Key Toggle */}
      <div className="absolute top-4 left-4 z-50 pointer-events-auto">
        <button
          onClick={() => {
            setShowMasterControls(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 backdrop-blur-xl border border-white/15 text-xs text-white hover:bg-black/35 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" />
          <span>⚙️ Master Panel</span>
        </button>
      </div>

      {/* STAGE HEADER LOGO */}
      <div className="w-full pt-6 px-4 flex flex-col items-center">
        <OzempicLogo />
      </div>

      {/* STEP-BY-STEP BRAND INTERACTIVE SLIDES */}
      <div className="w-full max-w-3xl px-4 flex flex-col items-center justify-center flex-1 py-4">
        
        {/* =======================================================
            SCREEN 1: HCP DECLARATION/TERMS WITH GLASS CARD + "CONTINUE"
            ======================================================= */}
        {brandStep === 1 && (
          <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-[32px] p-6 sm:p-8 md:p-10 shadow-2xl scale-98 animate-fade-in flex flex-col gap-6 text-left text-white max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/70 font-mono uppercase tracking-[0.2em] font-bold">Verification Step</span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">HCP Legal Notice & Consent</h2>
            </div>

            <div className="flex flex-col gap-3 font-sans text-xs text-white/85 leading-relaxed border-t border-b border-white/15 py-4 max-h-[200px] overflow-y-auto pr-1">
              <p>
                You are viewing the Novo Nordisk Virtual platform, provided to non-US health care professionals from around the world. By accessing this site and materials you accept this legal notice and expressly confirm your status as an authorized healthcare professional.
              </p>
              <p>
                This site is not country-specific and therefore may contain information which is not applicable to your region. Therefore, before prescribing any product, always refer to local prescribing publications and/or the Summary of Product Characteristics applicable in your area.
              </p>
              <p>
                This application tool is designed to model spatial coordinate simulation and does not prescribe, suggest or represent clinical medical advice, diagnostics, or treatment guidance. Novo Nordisk accepts no liability for the accuracy, completeness or use of the simulation metrics, and disclaims any liability to update the informational data.
              </p>
            </div>

            {/* HCP Checkbox Validation */}
            <label className="flex items-start gap-3.5 select-none cursor-pointer group mt-1">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={step1Checked}
                  onChange={(e) => setStep1Checked(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5.5 h-5.5 rounded-lg border-2 transition-all flex items-center justify-center ${
                  step1Checked 
                    ? "border-white bg-white/25 shadow-[0_0_8px_rgba(255,255,255,0.3)]" 
                    : "border-white/40 bg-white/5 group-hover:border-white/60"
                }`}>
                  {step1Checked && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                </div>
              </div>
              <span className="text-[11px] sm:text-xs text-white/85 leading-tight group-hover:text-white transition-colors">
                By ticking this checkbox and clicking below, I hereby declare that <span className="font-extrabold text-white">I am a non-US healthcare professional</span> and accept the terms of service.
              </span>
            </label>

            {/* Action button: fully-rounded pill shape, translucent white fill, 2px white border, white label, large tap target */}
            <div className="flex justify-center w-full mt-2">
              <button
                onClick={() => step1Checked && setBrandStep(2)}
                disabled={!step1Checked}
                className={`w-full max-w-[240px] py-4 rounded-full font-extrabold tracking-wider uppercase text-xs sm:text-sm font-sans flex items-center justify-center gap-1.5 transition-all shadow-lg select-none cursor-pointer border-2 ${
                  step1Checked 
                    ? "bg-white/10 hover:bg-white/20 active:scale-95 border-white text-white" 
                    : "bg-white/5 border-white/15 text-white/40 cursor-not-allowed opacity-50"
                }`}
              >
                <span>Continue</span>
              </button>
            </div>
          </div>
        )}

        {/* =======================================================
            SCREEN 4 (brandStep === 2): "TURN AROUND TO EXPERIENCE..." + T2D SUBLINE
            ======================================================= */}
        {brandStep === 2 && (
          <div className="w-full text-center text-white scale-98 animate-fade-in flex flex-col items-center gap-8 py-6">
            <div className="flex flex-col gap-4 max-w-lg">
              <h2 className="text-3xl sm:text-4.5xl font-extrabold tracking-tight text-white leading-[1.1] drop-shadow-md">
                Turn around to experience the freefall
              </h2>
              <p className="text-sm sm:text-base text-white/85 leading-relaxed font-sans font-medium px-2">
                Plus the power of unmatched, proven T2D protection, courtesy of Ozempic®
              </p>
            </div>

            {/* Fully-rounded "pill" shape, translucent white fill, 2px white border, white label, large tap target */}
            <button
              onClick={() => setBrandStep(3)}
              className="bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white rounded-full text-white font-extrabold tracking-wider uppercase text-xs sm:text-sm py-4 px-10 min-w-[200px] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-white/10 cursor-pointer"
            >
              Continue
            </button>
          </div>
        )}

        {/* =======================================================
            SCREEN 3 (brandStep === 3): "YOU'RE ALL SET / GET READY TO JUMP!" + "GO!"
            ======================================================= */}
        {brandStep === 3 && (
          <div className="w-full text-center text-white scale-98 animate-fade-in flex flex-col items-center gap-7 py-8">
            <div className="flex flex-col gap-3 max-w-md">
              <h2 className="text-3xl sm:text-4.5xl font-extrabold tracking-tight text-white drop-shadow-md">
                You're all set.
              </h2>
              <p className="text-base sm:text-lg font-extrabold text-white/85 py-0.5 font-sans">
                Get ready to jump!
              </p>
            </div>

            {/* Fully-rounded "pill" shape, translucent white fill, 2px white border, white label, large tap target */}
            <button
              onClick={() => {
                setBrandStep(0); // Exit brand slides overlay and start simulation
                onLaunch();
              }}
              className="bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white rounded-full text-white font-extrabold tracking-widest uppercase text-xs sm:text-sm py-4 px-12 min-w-[200px] flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-white/10 cursor-pointer"
            >
              Go!
            </button>
          </div>
        )}

        {/* =======================================================
            SCREEN 5 (brandStep === 4): "TIME TO CAPTURE YOUR MOMENT / LOOK UP..." + CAMERA FRAME CORNERS + "TAKE PHOTO"
            ======================================================= */}
        {brandStep === 4 && (
          <div className="w-full text-center text-white scale-98 animate-fade-in flex flex-col items-center gap-5">
            <div className="flex flex-col gap-2 max-w-lg">
              <h2 className="text-2xl sm:text-3.5xl font-extrabold tracking-tight text-white leading-tight">
                Time to capture your moment
              </h2>
              <p className="text-sm sm:text-base text-white/85 font-semibold">
                Look up and say weeee!
              </p>
            </div>

            {/* CAMERA CONTAINER FRAME WITH FOCUS CORNER BRACKETS */}
            <div className="w-full max-w-[420px] aspect-4/3 relative rounded-2xl sm:rounded-3xl border border-white/20 bg-slate-950/40 backdrop-blur-md shadow-2xl p-4 overflow-hidden flex items-center justify-center">
              
              {/* Webcam Video tag */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover rounded-xl transition-transform ${
                  isCameraActive ? "scale-x-[-1]" : "hidden"
                }`}
              />

              {/* Loader placeholder or Denied permissions helper */}
              {!isCameraActive && (
                <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
                  <div className="w-14 h-14 bg-white/5 rounded-full border border-white/15 flex items-center justify-center text-white/50 animate-pulse">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-xs">
                    <span className="text-xs font-semibold text-white/90">Starting Selfie Video Camera...</span>
                    <span className="text-[10px] text-white/70 leading-relaxed px-4">
                      {cameraError || "Please authorize webcam request in your browser's prompt."}
                    </span>
                  </div>
                </div>
              )}

              {/* CAMERA FOCUS CORNER BRACKETS */}
              <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-sm pointer-events-none drop-shadow-md" />
              <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-sm pointer-events-none drop-shadow-md" />
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-sm pointer-events-none drop-shadow-md" />
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-sm pointer-events-none drop-shadow-md" />
              
              {/* Floating Accuracy Tag */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/45 px-2.5 py-0.5 rounded-full border border-white/10 backdrop-blur-sm shadow text-[9.5px] font-mono tracking-wider">
                COORDS: 48.1373N 11.5754E
              </div>

              {/* Camera status badge */}
              <div className="absolute bottom-6 right-6 bg-red-500/85 text-white border border-white/10 px-2 py-0.5 rounded text-[8.5px] font-mono font-bold animate-pulse">
                REC
              </div>
            </div>

            {/* Action pill trigger: fully-rounded "pill" shape, translucent white fill, 2px white border, white label, large tap target */}
            <button
              onClick={runCaptureCountdown}
              className="px-10 py-4 bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white text-white rounded-full font-sans font-extrabold uppercase text-xs sm:text-sm tracking-wider shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Camera className="w-4 h-4 fill-current" />
              <span>Take photo</span>
            </button>
          </div>
        )}

        {/* =======================================================
            SCREENS 6-8 (brandStep === 5, 6, 7): FULL SCREEN COUNTDOWN "3","2","1" WITH CAMERA FRAME
            ======================================================= */}
        {(brandStep === 5 || brandStep === 6 || brandStep === 7) && (
          <div className="w-full text-center text-white scale-98 animate-fade-in flex flex-col items-center gap-6">
            <div className="flex flex-col gap-1.5 max-w-md">
              <span className="text-[10px] text-white/70 font-mono uppercase tracking-[0.2em]">Hold Steady</span>
              <h2 className="text-xl sm:text-2.5xl font-extrabold tracking-tight text-white leading-tight">
                Get Ready! Smile...
              </h2>
            </div>

            {/* Viewfinder with giant numbers */}
            <div className="w-full max-w-[420px] aspect-4/3 relative rounded-2xl sm:rounded-3xl border border-white/25 bg-slate-950/40 backdrop-blur-md shadow-2xl p-4 overflow-hidden flex items-center justify-center">
              
              {/* Keep background camera on */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-40`}
              />

              {/* Giants numbers for timers */}
              <div className="relative text-7xl sm:text-9xl font-display font-black tracking-tighter text-white animate-ping drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                {brandStep === 5 ? "3" : brandStep === 6 ? "2" : "1"}
              </div>

              {/* Camera Focus Brackets */}
              <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-white pointer-events-none drop-shadow-md" />
              <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-white pointer-events-none drop-shadow-md" />
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-white pointer-events-none drop-shadow-md" />
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-white pointer-events-none drop-shadow-md" />
            </div>

            {/* Counting text spacer */}
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70 animate-pulse mt-1">
              Shutter triggering shortly
            </div>
          </div>
        )}

        {/* =======================================================
            SCREEN 9 (brandStep === 8): "READY TO PRINT?" PREVIEW CARD + "RETRY" (DISABLED LOOK) / "USE PHOTO"
            ======================================================= */}
        {brandStep === 8 && (
          <div className="w-full text-center text-white scale-98 animate-fade-in flex flex-col items-center gap-5">
            <div className="flex flex-col gap-1 max-w-md">
              <h2 className="text-2xl sm:text-3.5xl font-extrabold text-white tracking-tight">
                Ready to print?
              </h2>
              <p className="text-sm text-white/85">
                Preview your customized Ozempic® souvenir postcard.
              </p>
            </div>

            {/* PREVIEW CARD */}
            <div className="w-full max-w-[420px] aspect-4/3 relative rounded-2xl sm:rounded-3xl border border-white/25 bg-white/10 backdrop-blur-md shadow-2xl p-2.5 overflow-hidden flex items-center justify-center pointer-events-auto">
              {capturedPhotoUrl ? (
                <img
                  src={capturedPhotoUrl}
                  alt="Review selfie mockup"
                  className="w-full h-full object-cover rounded-xl shadow-inner"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-xs font-mono text-white/70">Processing preview frames...</div>
              )}

              {/* Fancy branding badge overlay inside review box */}
              <div className="absolute top-5 right-5 bg-white/20 backdrop-blur-md border border-white/10 px-2.5 py-0.5 rounded text-[8.5px] uppercase font-mono tracking-widest leading-none text-white font-semibold">
                Preview Postcard
              </div>
            </div>

            {/* Stack button controls */}
            <div className="flex gap-4 w-full max-w-[360px] pointer-events-auto mt-1">
              {/* Retry button styled with a disabled look (low opacity, low pointer-events, but keep layout consistent) */}
              <button
                disabled
                className="flex-1 py-4 bg-white/5 text-white/40 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all border-2 border-white/10 shadow-lg cursor-not-allowed opacity-40 flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              
              {/* Use photo button: fully-rounded translucent white pill */}
              <button
                onClick={() => setBrandStep(9)}
                className="flex-1 py-4 bg-white/10 hover:bg-white/20 active:scale-95 text-white border-2 border-white rounded-full text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Use photo</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =======================================================
            SCREEN 10 (brandStep === 9): CONSENT CHECKBOX + "READ MORE" + STEPPER + "PRINT"
            ======================================================= */}
        {brandStep === 9 && (
          <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-[32px] p-6 sm:p-8 md:p-10 shadow-2xl scale-98 animate-fade-in flex flex-col gap-6 text-left text-white max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/70 font-mono uppercase tracking-[0.2em] font-extrabold">Final Review step</span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
                Just one last thing before we print your postcard
              </h2>
            </div>

            <p className="text-xs text-white/85 leading-relaxed font-sans border-b border-white/15 pb-3">
              <span>Please declare your consent for Novo Nordisk to process and print your custom souvenir.</span>
              <button 
                onClick={() => setShowDisclaimerPopup(true)}
                className="text-white hover:underline font-extrabold inline-flex items-center gap-0.5 ml-1 bg-white/10 px-2 py-0.5 rounded-full text-[10px] cursor-pointer"
              >
                Read more ›
              </button>
            </p>

            {/* Quantity select stepper panel */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between pointer-events-auto select-none gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-extrabold text-white uppercase tracking-wider">Number of Prints</span>
                <span className="text-[10px] text-white/70">Max of 5 physical souvenir copies per session</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTicketQuantity(prev => Math.max(prev - 1, 1))}
                  className="w-8 h-8 rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center text-sm font-bold cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                  disabled={ticketQuantity <= 1}
                >
                  <Minus className="w-3 px-0.5" />
                </button>
                <span className="text-lg font-mono font-extrabold w-6 text-center text-white">{ticketQuantity}</span>
                <button
                  type="button"
                  onClick={() => setTicketQuantity(prev => Math.min(prev + 1, 5))}
                  className="w-8 h-8 rounded-full border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-all flex items-center justify-center text-sm font-bold cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                  disabled={ticketQuantity >= 5}
                >
                  <Plus className="w-3 px-0.5" />
                </button>
              </div>
            </div>

            {/* GDPR Checkbox Consent */}
            <label className="flex items-start gap-3.5 select-none cursor-pointer group mt-1">
              <div className="relative mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={step9Checked}
                  onChange={(e) => setStep9Checked(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5.5 h-5.5 rounded-lg border-2 transition-all flex items-center justify-center ${
                  step9Checked 
                    ? "border-white bg-white/25 shadow-[0_0_8px_rgba(255,255,255,0.3)]" 
                    : "border-white/40 bg-white/5 group-hover:border-white/60"
                }`}>
                  {step9Checked && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                </div>
              </div>
              <span className="text-[11px] sm:text-xs text-white/85 leading-normal group-hover:text-white transition-opacity">
                By ticking this box, you agree that we may process and store your temporarily generated webcam selfie image solely for printing the souvenir postcard.
              </span>
            </label>

            {/* Action button: Centered, fully-rounded active pill button, translucent white fill, 2px border */}
            <div className="flex justify-center w-full mt-2">
              <button
                onClick={() => step9Checked && setBrandStep(10)}
                disabled={!step9Checked}
                className={`w-full max-w-[240px] py-4 rounded-full font-extrabold tracking-wider uppercase text-xs sm:text-sm font-sans flex items-center justify-center gap-1.5 transition-all shadow-md select-none cursor-pointer border-2 ${
                  step9Checked 
                    ? "bg-white/10 border-white text-white hover:bg-white/20 active:scale-95" 
                    : "bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-40"
                }`}
              >
                <Printer className="w-4 h-4 fill-current" />
                <span>Print {ticketQuantity > 1 ? `(${ticketQuantity} Copies)` : "Postcard"}</span>
              </button>
            </div>
          </div>
        )}

        {/* =======================================================
            SCREEN 2 (brandStep === 10): "THANKS! YOUR POSTCARD IS BEING PRINTED" + 5-STAR RATING + QR CODE + "PRINT"
            ======================================================= */}
        {brandStep === 10 && (
          <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-[32px] p-6 sm:p-8 md:p-10 shadow-2xl scale-98 animate-fade-in flex flex-col gap-6 text-center text-white max-h-[85vh] overflow-y-auto">
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[10px] text-white/70 font-mono uppercase tracking-[0.25em] font-extrabold animate-pulse">Printing Postcard...</span>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
                Thanks! Your postcard is being printed.
              </h2>
            </div>

            <p className="text-xs text-white/85 leading-normal font-sans max-w-sm mx-auto">
              While you wait, please rate your physical experience to help us reach new heights in virtual aviation simulation!
            </p>

            {/* Interactive 5 Star Widget */}
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const isFilled = starIdx <= (hoveredStar || userRating);
                  return (
                    <button
                      key={starIdx}
                      type="button"
                      onMouseEnter={() => setHoveredStar(starIdx)}
                      onMouseLeave={() => setHoveredStar(0)}
                      onClick={() => setUserRating(starIdx)}
                      className="p-1 cursor-pointer transition-transform hover:scale-120 active:scale-90"
                    >
                      <Star 
                        className={`w-8 h-8 ${
                          isFilled 
                            ? "fill-white text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
                            : "text-white/30 fill-transparent"
                        } transition-colors`} 
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-white/80 h-3.5">
                {userRating === 5 ? "Supersonic Glide!" : 
                 userRating === 4 ? "Excellent Descent Plan" :
                 userRating === 3 ? "Comfortable Canopy Glide" :
                 userRating === 2 ? "Hard Landing Zone" :
                 userRating === 1 ? "Brace impact emergency!" : "Select Rating Stars"}
              </span>
            </div>

            {/* Souvenir postcard dispatch box with live API QR Code image */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center gap-2 max-w-[280px] mx-auto w-full pointer-events-auto">
              <span className="text-[9px] font-mono text-white/70 uppercase tracking-widest leading-none">Scanning ticket info</span>
              
              <div className="w-32 h-32 bg-white rounded-lg p-2 flex items-center justify-center shadow-md">
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.novonordisk.com"
                  alt="QR Code verification scanner redirect"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-white font-mono font-extrabold tracking-wider">TICKET ID: OZM-1481</span>
                <span className="text-[8.5px] text-white/70 font-sans leading-none">Collect at Munich Main Souvenir center</span>
              </div>
            </div>

            {/* Final restart and fly again print/control trigger */}
            <div className="flex justify-center w-full mt-2">
              <button
                onClick={() => {
                  setStep1Checked(false);
                  setStep9Checked(false);
                  setCapturedPhotoUrl(null);
                  setUserRating(0);
                  setTicketQuantity(1);
                  
                  // Trigger Simulation Restart to start again!
                  onRestart();
                  setBrandStep(1); // Return to terms page
                }}
                className="w-full max-w-[240px] py-4 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border-2 border-white text-white font-extrabold uppercase tracking-wider text-xs sm:text-sm font-sans flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 stroke-[2px]" />
                <span>Print</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* FOOTER AREA */}
      <BrandFooter />

      {/* RENDER DISCLAIMER POPUP MODAL DIALOG */}
      {showDisclaimerPopup && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-stone-900 border border-white/20 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-left scale-98 animate-fade-in relative text-white">
            <button
              onClick={() => setShowDisclaimerPopup(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-full p-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-extrabold text-base text-white tracking-tight flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-400" />
              <span>Prescribing Disclaimer Notice</span>
            </h3>

            <div className="text-xs text-white/85 leading-relaxed max-h-[200px] overflow-y-auto pr-1 flex flex-col gap-2 font-sans">
              <p>
                This application represents a photorealistic model for amusement, sensory testing, and promotional visual rendering of physical environments in Munich. It is designated strictly for presentation to non-US licensed Healthcare Professionals (HCPs) at registered training forums and promotional events.
              </p>
              <p>
                Products name such as Ozempic® and respective injection dosage descriptions are registered trademarks of Novo Nordisk A/S. This tool is not country-specific; actual local labels might vary significantly. Always read the local Summary of Product Characteristics (SmPC) prior to any prescription decisions.
              </p>
            </div>

            <div className="bg-white/5 p-3 rounded-lg flex items-center gap-2.5 border border-white/10 mt-1 font-mono text-[9px] text-white/60">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Regulatory compliance code: IT26OZM00027</span>
            </div>

            <button
              onClick={() => setShowDisclaimerPopup(false)}
              className="w-full py-3 bg-white hover:bg-white/90 text-stone-900 font-extrabold uppercase rounded-full transition-all cursor-pointer text-xs"
            >
              Acknowledge and Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
