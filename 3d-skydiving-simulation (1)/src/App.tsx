/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { SkydivingState, DropConfig, SimulationStats } from "./types";
import { gameAudio } from "./utils/audio";
import CesiumSimulator from "./components/CesiumSimulator";
import SimulationUI from "./components/SimulationUI";
import BrandExperience from "./components/BrandExperience";

export default function App() {
  // Define main Simulation state machine
  // We initialize in SkydivingState.COMPLETE with 0 airtime to show the Dashboard Start launcher
  const [gameState, setGameState] = useState<SkydivingState>(SkydivingState.COMPLETE);

  // Brand experience current phase (1 to 10). Renders screen overlay.
  const [brandStep, setBrandStep] = useState<number>(1);
  const [showMasterControls, setShowMasterControls] = useState<boolean>(false);

  // Drop configurations
  const [dropConfig, setDropConfig] = useState<DropConfig>({
    profile: "CLEAR_DAY",
    altitudeStart: 8500,
    windSpeedMultiplier: 1.0,
    cloudsDensity: "LOW",
    gaussianSplatUrl: "",
    cloudVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-flying-through-clouds-under-a-blue-sky-40097-large.mp4",
    enableSplattingDemo: true,
  });

  // End drop tactical results
  const [stats, setStats] = useState<SimulationStats>({
    peakVelocityKmh: 0,
    totalDescentTimeSec: 0,
    landingAccuracyPct: 0,
    parachuteDeployAltitude: 0,
    gForceMax: 1.0,
  });

  // Real-time HUD telemetry hook values (frame-updated)
  const [altitude, setAltitude] = useState<number>(dropConfig.altitudeStart);
  const [speed, setSpeed] = useState<number>(0);
  const [gForce, setGForce] = useState<number>(1.0);
  const [heading, setHeading] = useState<number>(0);

  // Audio mute tracker
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Default fallback Cesium Ion Access Token provided by user
  const DEFAULT_ION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNmFhMzZkYS1hZTkyLTQ2NjEtOGRjYy05M2JhYWY4NTU1MzYiLCJpZCI6NDQ3NDU4LCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODIxMTIyNjF9.SBtWswryVhCu282SInnsPYD3E_dDJPFp_hinQmugCsI";

  // Persist Cesium Ion Access Token safely across updates
  const [ionToken, setIonToken] = useState<string>(() => {
    return localStorage.getItem("cesium_ion_token") || DEFAULT_ION_TOKEN;
  });

  useEffect(() => {
    localStorage.setItem("cesium_ion_token", ionToken);
  }, [ionToken]);

  // Motion Sensor permissions management
  const [gyroStatus, setGyroStatus] = useState<"idle" | "granted" | "denied">(() => {
    if (typeof DeviceOrientationEvent === "undefined") return "granted"; // Desktop default
    return "idle";
  });

  const requestGyroPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === "granted") {
          setGyroStatus("granted");
        } else {
          setGyroStatus("denied");
        }
      } catch (err) {
        console.warn("Motion sensors setup denied:", err);
        setGyroStatus("denied");
      }
    } else {
      setGyroStatus("granted");
    }
  };

  // Launch simulator action
  const handleLaunch = () => {
    // Initialise and start Web Audio Synth on user gesture (bypasses browser lock)
    gameAudio.init();
    
    // Clear old Stats and reset telemetry
    setStats({
      peakVelocityKmh: 0,
      totalDescentTimeSec: 0,
      landingAccuracyPct: 0,
      parachuteDeployAltitude: 0,
      gForceMax: 1.0,
    });
    setAltitude(dropConfig.altitudeStart);
    setSpeed(0);
    setGForce(1.0);

    // Switch state to trigger fall cinematic descent!
    setGameState(SkydivingState.FREEFALL);
    setBrandStep(0); // Set to active jump state (hides initial brand overlays)
  };

  // Trigger Selfie UI (Step 4) when landing is fully completed after touchdown look-around
  useEffect(() => {
    if (gameState === SkydivingState.COMPLETE && stats.totalDescentTimeSec > 0) {
      const timer = setTimeout(() => {
        setBrandStep(4);
      }, 3000); // 3 seconds deceleration / touchdown look-around landing buffer
      return () => clearTimeout(timer);
    } else if (gameState === SkydivingState.COMPLETE && stats.totalDescentTimeSec === 0) {
      setBrandStep(1); // Back on screen 1 terms notice
    } else {
      setBrandStep(0); // Active jump
    }
  }, [gameState, stats.totalDescentTimeSec]);

  const handleRestart = () => {
    // Stop loops and return to launch panel
    setGameState(SkydivingState.COMPLETE);
    setStats({
      peakVelocityKmh: 0,
      totalDescentTimeSec: 0,
      landingAccuracyPct: 0,
      parachuteDeployAltitude: 0,
      gForceMax: 1.0,
    });
    setBrandStep(1); // Restart brand sequence from Step 1
  };

  // Sound synthesizer mute toggling
  const handleMuteToggle = () => {
    const muted = gameAudio.toggleMute();
    setIsMuted(muted);
  };

  // Frame telemetries dispatcher
  const handleFrameTick = (
    currentAltitude: number,
    currentSpeed: number,
    currentGForce: number,
    currentHeading: number
  ) => {
    setAltitude(currentAltitude);
    setSpeed(currentSpeed);
    setGForce(currentGForce);
    setHeading(currentHeading);
  };

  // Direct stats state merge updates
  const handleUpdateStats = (newStats: Partial<SimulationStats>) => {
    setStats((prev) => ({ ...prev, ...newStats }));
  };

  return (
    <main className="relative w-screen h-screen bg-[#07090e] text-white flex items-center justify-center overflow-hidden">
      {/* 3D simulator viewport */}
      <CesiumSimulator
        gameState={gameState}
        setGameState={setGameState}
        dropConfig={dropConfig}
        onUpdateStats={handleUpdateStats}
        onFrame={handleFrameTick}
        ionToken={ionToken}
      />

      {/* Futuristic mission HUD & Control overlayers */}
      <SimulationUI
        gameState={gameState}
        setGameState={setGameState}
        dropConfig={dropConfig}
        setDropConfig={setDropConfig}
        stats={stats}
        altitude={altitude}
        speed={speed}
        gForce={gForce}
        heading={heading}
        onLaunch={handleLaunch}
        reqGyroPermission={requestGyroPermission}
        gyroStatus={gyroStatus}
        onMuteToggle={handleMuteToggle}
        isMuted={isMuted}
        ionToken={ionToken}
        setIonToken={setIonToken}
        onRestart={handleRestart}
        brandStep={brandStep}
        setBrandStep={setBrandStep}
        showMasterControls={showMasterControls}
        setShowMasterControls={setShowMasterControls}
      />

      {/* Ozempic Brand Experience Overlay Steps 1-10 */}
      <BrandExperience
        gameState={gameState}
        setGameState={setGameState}
        brandStep={brandStep}
        setBrandStep={setBrandStep}
        onLaunch={handleLaunch}
        onRestart={handleRestart}
        stats={stats}
        showMasterControls={showMasterControls}
        setShowMasterControls={setShowMasterControls}
      />
    </main>
  );
}
