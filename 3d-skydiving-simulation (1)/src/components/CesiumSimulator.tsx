/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { SkydivingState, ThemeProfile, SimulationStats, DropConfig } from "../types";
import { gameAudio } from "../utils/audio";

declare const Cesium: any;

interface CesiumSimulatorProps {
  gameState: SkydivingState;
  setGameState: (state: SkydivingState) => void;
  dropConfig: DropConfig;
  onUpdateStats: (update: Partial<SimulationStats>) => void;
  onFrame: (altitude: number, speed: number, gForce: number, heading: number) => void;
  ionToken: string;
}

export default function CesiumSimulator({
  gameState,
  setGameState,
  dropConfig,
  onUpdateStats,
  onFrame,
  ionToken,
}: CesiumSimulatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasFallbackRef = useRef<HTMLCanvasElement>(null);
  const [cesiumLoaded, setCesiumLoaded] = useState<boolean>(false);
  const [cesiumError, setCesiumError] = useState<boolean>(false);
  const [cloudVideoOpacity, setCloudVideoOpacity] = useState<number>(0);
  const cloudVideoRef = useRef<HTMLVideoElement>(null);
  const lastCloudOpacityRef = useRef<number>(0);

  // Simulation variables stored in refs to bypass rerender overhead
  const simStateRef = useRef<SkydivingState>(gameState);
  const altitudeRef = useRef<number>(dropConfig.altitudeStart);
  const speedRef = useRef<number>(0);
  const gForceRef = useRef<number>(1.0);
  const lastTimeRef = useRef<number>(0);
  const totalTimeRef = useRef<number>(0);
  const peakSpeedRef = useRef<number>(0);
  const parachuteTriggeredAltRef = useRef<number>(0);

  // Camera looking offsets (heading, pitch, roll in degrees)
  const userYawRef = useRef<number>(0);
  const userPitchRef = useRef<number>(0);
  const targetUserYawRef = useRef<number>(0);
  const targetUserPitchRef = useRef<number>(0);

  // Device orientation capture
  const deviceYawRef = useRef<number>(0);
  const devicePitchRef = useRef<number>(0);
  const deviceRollRef = useRef<number>(0);

  // Touch and Drag handlers
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragYawStartRef = useRef<number>(0);
  const dragPitchStartRef = useRef<number>(0);

  // Track cursor position for infinite fluid look-around mouse-slide controls
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Cesium Viewer Ref
  const viewerRef = useRef<any>(null);
  const marienplatzEntitiesRef = useRef<any[]>([]);
  const cloudsEntitiesRef = useRef<any[]>([]);
  const cloudsPrimitiveRef = useRef<any>(null);
  const splatPrimitiveRef = useRef<any>(null);
  const customSplatRef = useRef<any>(null);

  // Coordinates Constants
  const MUNICH_MARIENPLATZ = {
    lon: 11.575448,
    lat: 48.137393,
    elevation: 0.0, // Munich base imagery elevation (0.0 ellipsoid level)
  };

  // Trajectory start offset (gives a epic forward glide trajectory)
  const trajectoryStartOffset = {
    lon: 0.006, 
    lat: 0.009,
  };

  // Sync state ref
  useEffect(() => {
    simStateRef.current = gameState;
  }, [gameState]);

  // Sync config/restart
  useEffect(() => {
    if (gameState === SkydivingState.FREEFALL) {
      altitudeRef.current = dropConfig.altitudeStart;
      speedRef.current = 0;
      gForceRef.current = 1.0;
      totalTimeRef.current = 0;
      peakSpeedRef.current = 0;
      parachuteTriggeredAltRef.current = 0;
      userYawRef.current = 0;
      userPitchRef.current = 0;
      targetUserYawRef.current = 0;
      targetUserPitchRef.current = 0;
      lastMousePosRef.current = null;
    }
  }, [gameState, dropConfig]);

  // Handle Gyroscope / DeviceOrientation Events
  useEffect(() => {
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha !== null && e.beta !== null && e.gamma !== null) {
        // Map beta to pitch, gamma to roll / heading tilt
        // Offset beta by ~45 degrees to allow looking straight while holding phone naturally
        const rawPitch = -(e.beta - 45); 
        const rawYaw = -e.alpha;
        const rawRoll = e.gamma;

        // Smooth orientation updates via target reference
        devicePitchRef.current = rawPitch * 0.8;
        deviceYawRef.current = rawYaw * 1.0;
        deviceRollRef.current = rawRoll * 0.5;
      }
    };

    window.addEventListener("deviceorientation", handleDeviceOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    };
  }, []);

  // Double tap dynamic recenter
  const handleRecenter = () => {
    targetUserYawRef.current = 0;
    targetUserPitchRef.current = 0;
    userYawRef.current = 0;
    userPitchRef.current = 0;
    deviceYawRef.current = 0;
    devicePitchRef.current = 0;
    deviceRollRef.current = 0;
  };

  // Touch/Mouse drag tracking
  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY };
    dragYawStartRef.current = targetUserYawRef.current;
    dragPitchStartRef.current = targetUserPitchRef.current;
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;

    // Drag multipliers for organic looking speed
    const yawSens = 0.25;
    const pitchSens = 0.25;

    targetUserYawRef.current = dragYawStartRef.current - dx * yawSens;
    targetUserPitchRef.current = Math.min(
      Math.max(dragPitchStartRef.current + dy * pitchSens, -110),
      170
    );
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  // Setup Cesium JS
  useEffect(() => {
    if (typeof Cesium === "undefined") {
      setCesiumError(true);
      return;
    }

    setCesiumError(false);

    // Apply Access Token if present
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    } else {
      // Default placeholder token for sandbox environments
      Cesium.Ion.defaultAccessToken = "";
    }

    try {
      const container = containerRef.current;
      if (!container) return;

      // Clean old viewer if restarting
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }

      // Initialize Cesium with high resolution and quality rendering switches
      const viewer = new Cesium.Viewer(container, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        scene3DOnly: true,
        shadows: false,
        terrainProvider: cesiumLoaded ? undefined : new Cesium.EllipsoidTerrainProvider(),
      });

      // Set render resolution scale to capture high-DPI (Retina) screen pin-sharpness
      viewer.resolutionScale = Math.min(window.devicePixelRatio || 1.0, 2.0);

      // Maximize map tileset resolution and satellite detail quality
      if (viewer.scene && viewer.scene.globe) {
        viewer.scene.globe.maximumScreenSpaceError = 1.0; // lowers tile loading error boundary, dramatically sharpening layout details (default is 2)
        viewer.scene.globe.tileCacheSize = 400; // cache more tiles to prevent pop-in and flickering
        viewer.scene.globe.enableLighting = true; // render high-quality lighting accents
      }

      // Enable fast-approximate anti-aliasing (FXAA) for buttery smooth edges
      if (viewer.scene && viewer.scene.postProcessStages) {
        viewer.scene.postProcessStages.fxaa.enabled = true;
      }

      // Hide standard widget components to keep simulation immersive
      if (viewer.cesiumWidget.creditContainer) {
        viewer.cesiumWidget.creditContainer.style.display = "none";
      }

      // Configure atmospheric properties based on drop profile selection
      configureAtmosphere(viewer, dropConfig.profile);

      // Procedural Marienplatz & Munich custom buildings
      buildProceduralMarienplatz(viewer);

      // Create fake clouds billboard layers
      buildCloudsLayer(viewer, dropConfig.cloudsDensity);

      viewerRef.current = viewer;
      setCesiumLoaded(true);
    } catch (err) {
      console.error("Cesium instantiation fail:", err);
      setCesiumError(true);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [ionToken, dropConfig.profile, dropConfig.cloudsDensity]);

  // Adjust scene time, lighting and background for matching Drops profile
  const configureAtmosphere = (viewer: any, profile: ThemeProfile) => {
    const scene = viewer.scene;
    scene.fog.enabled = true;
    scene.fog.density = 0.00055; // Slightly denser mist for realistic look-through depth!

    // Clear standard space skybox to let beautiful solid/gradient atmosphere colors shine through when looking up!
    scene.skyBox = undefined;

    let timeString = "2026-06-22T10:00:00Z"; // Default Noon

    switch (profile) {
      case "CLEAR_DAY":
        scene.fog.color = new Cesium.Color(0.53, 0.74, 0.94, 1.0);
        scene.backgroundColor = new Cesium.Color(0.48, 0.69, 0.93, 1.0); // Vibrant, stunning celestial sky blue!
        timeString = "2026-06-22T12:00:00Z";
        break;
      case "CYBER_SUNSET":
        scene.fog.color = new Cesium.Color(0.85, 0.35, 0.6, 1.0); 
        scene.backgroundColor = new Cesium.Color(0.55, 0.15, 0.42, 1.0); // Cosmic magenta sunset sky
        timeString = "2026-06-22T19:30:00Z";
        break;
      case "ALPINE_DAWN":
        scene.fog.color = new Cesium.Color(0.95, 0.65, 0.4, 1.0);
        scene.backgroundColor = new Cesium.Color(0.82, 0.48, 0.28, 1.0); // Warm dawn morning sky
        timeString = "2026-06-22T05:40:00Z";
        break;
      case "MIDNIGHT_NEON":
        scene.fog.color = new Cesium.Color(0.04, 0.06, 0.12, 1.0);
        scene.backgroundColor = new Cesium.Color(0.02, 0.03, 0.07, 1.0); // Stealthy glowing tactical midnight
        timeString = "2026-06-22T23:45:00Z";
        scene.skyAtmosphere.show = false; // Dark alpine sky
        break;
    }

    viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(timeString);
    viewer.clock.shouldAnimate = false; // Stay fixed timezone
  };

  // Generate gorgeous glowing 3D structures and target pad in Munich centre
  const buildProceduralMarienplatz = (viewer: any) => {
    // Empty old records
    marienplatzEntitiesRef.current = [];

    const entities = viewer.entities;
    const center = MUNICH_MARIENPLATZ;

    // Outer Glow Ring (Cesium Cylinder representation)
    const landingPadRingOuter = entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, center.elevation + 0.5),
      cylinder: {
        length: 0.1,
        topRadius: 35.0,
        bottomRadius: 35.0,
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(1.0, 0.45, 0.0, 0.15)),
        outline: true,
        outlineColor: new Cesium.Color(1.0, 0.7, 0.0, 0.8),
        outlineWidth: 3.0,
      }
    });
    marienplatzEntitiesRef.current.push(landingPadRingOuter);

    // Inner Bullseye Target
    const landingPadBullseye = entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, center.elevation + 0.8),
      cylinder: {
        length: 0.2,
        topRadius: 8.0,
        bottomRadius: 8.0,
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(1.0, 0.2, 0.2, 0.45)),
        outline: true,
        outlineColor: new Cesium.Color(1.0, 1.0, 0.9, 0.9),
        outlineWidth: 4.0,
      }
    });
    marienplatzEntitiesRef.current.push(landingPadBullseye);

    // Grid polygon square for visual landing pad feedback
    const plazaSquare = entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat, center.elevation + 0.1),
      box: {
        dimensions: new Cesium.Cartesian3(120.0, 80.0, 0.2),
        material: new Cesium.Color(0.12, 0.15, 0.18, 0.5),
        outline: true,
        outlineColor: new Cesium.Color(1.0, 0.7, 0.0, 0.4),
      }
    });
    marienplatzEntitiesRef.current.push(plazaSquare);

    // Procedural Neues Rathaus (Munich Neo-gothic Town Hall!)
    const rathausBox = entities.add({
      // Offset slightly to the north
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat + 0.00035, center.elevation + 18.0),
      box: {
        dimensions: new Cesium.Cartesian3(110.0, 24.0, 36.0), // 110m long, 24m wide, 36m height
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.25, 0.23, 0.21, 0.98)),
        outline: true,
        outlineColor: new Cesium.Color(0.9, 0.7, 0.4, 0.5),
      }
    });
    marienplatzEntitiesRef.current.push(rathausBox);

    // Rathaus clock tower
    const rathausTower = entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat + 0.00035, center.elevation + 40.0),
      box: {
        dimensions: new Cesium.Cartesian3(14.0, 14.0, 80.0), // Majestic 80m high tower
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.2, 0.18, 0.16, 1.0)),
        outline: true,
        outlineColor: new Cesium.Color(0.95, 0.75, 0.2, 0.6),
      }
    });
    marienplatzEntitiesRef.current.push(rathausTower);

    // Neon spire tip for aesthetic tension
    const rathausSpireTip = entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat + 0.00035, center.elevation + 82.0),
      cylinder: {
        length: 8.0,
        topRadius: 0.1,
        bottomRadius: 3.0,
        material: new Cesium.Color(1.0, 0.5, 0.0, 0.95),
      }
    });
    marienplatzEntitiesRef.current.push(rathausSpireTip);

    // Mariensäule (Column of Mary) in the center of square
    const columnOfMary = entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon - 0.00005, center.lat - 0.0001, center.elevation + 6.0),
      cylinder: {
        length: 12.0,
        topRadius: 1.0,
        bottomRadius: 1.5,
        material: new Cesium.Color(0.35, 0.35, 0.32, 1.0),
        outline: true,
        outlineColor: new Cesium.Color(0.4, 0.4, 0.4, 0.5),
      }
    });
    marienplatzEntitiesRef.current.push(columnOfMary);

    const statueMaryGold = entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.lon - 0.00005, center.lat - 0.0001, center.elevation + 12.5),
      ellipsoid: {
        radii: new Cesium.Cartesian3(1.0, 1.0, 1.0),
        material: new Cesium.Color(1.0, 0.85, 0.0, 1.0), // Shining gold body
      }
    });
    marienplatzEntitiesRef.current.push(statueMaryGold);

    // Surrounding stylized Munich bento architectural grid
    const buildingOffsets = [
      { dLon: -0.0008, dLat: 0.0003, lx: 60, ly: 30, h: 25, col: [0.18, 0.18, 0.2] },
      { dLon: -0.0007, dLat: -0.0004, lx: 50, ly: 40, h: 20, col: [0.22, 0.2, 0.2] },
      { dLon: 0.0008, dLat: 0.0002, lx: 75, ly: 35, h: 28, col: [0.24, 0.22, 0.2] },
      { dLon: 0.0007, dLat: -0.0005, lx: 45, ly: 45, h: 24, col: [0.16, 0.16, 0.18] },
    ];

    buildingOffsets.forEach((b, i) => {
      const genericBuilding = entities.add({
        position: Cesium.Cartesian3.fromDegrees(center.lon + b.dLon, center.lat + b.dLat, center.elevation + b.h / 2),
        box: {
          dimensions: new Cesium.Cartesian3(b.lx, b.ly, b.h),
          material: new Cesium.Color(b.col[0], b.col[1], b.col[2], 0.95),
          outline: true,
          outlineColor: new Cesium.Color(b.col[0] * 1.5, b.col[1] * 1.5, b.col[2] * 1.5, 0.4),
        }
      });
      marienplatzEntitiesRef.current.push(genericBuilding);
    });

    // Make surrounding elements initially active
    updateMarienplatzVisibilities(8500);
  };

  // Live fade-in based on height. Below 2,000m they start drawing, under 1,000m they fully materialize
  const updateMarienplatzVisibilities = (relativeAltitude: number) => {
    const ratio = Math.min(Math.max((2000 - relativeAltitude) / 1000, 0), 1);
    
    marienplatzEntitiesRef.current.forEach((ent) => {
      // Scale visual parameters slightly
      if (ent.box) {
        ent.box.material = Cesium.Color.fromCssColorString(
          `rgba(${Math.floor(ent.box.material.color.getValue().red * 255)}, ${Math.floor(
            ent.box.material.color.getValue().green * 255
          )}, ${Math.floor(ent.box.material.color.getValue().blue * 255)}, ${ratio})`
        );
      }
      if (ent.cylinder) {
        ent.cylinder.material = Cesium.Color.fromCssColorString(
          `rgba(${Math.floor(ent.cylinder.material.color.getValue().red * 255)}, ${Math.floor(
            ent.cylinder.material.color.getValue().green * 255
          )}, ${Math.floor(ent.cylinder.material.color.getValue().blue * 255)}, ${ratio})`
        );
      }
    });
  };

  // Create fake floating cloud billboards distributed in sky
  const buildCloudsLayer = (viewer: any, density: "NONE" | "LOW" | "HEAVY") => {
    cloudsEntitiesRef.current = [];
    if (cloudsPrimitiveRef.current) {
      viewer.scene.primitives.remove(cloudsPrimitiveRef.current);
      cloudsPrimitiveRef.current = null;
    }
    if (density === "NONE") return;

    const center = MUNICH_MARIENPLATZ;
    const profile = dropConfig.profile;

    // A. TRY CHERRY-PICKING NATIVE VOLUMETRIC CLOUDS (supported in CesiumJS 1.115+)
    try {
      if (typeof Cesium !== "undefined" && Cesium.CloudCollection) {
        const cloudsCollection = viewer.scene.primitives.add(new Cesium.CloudCollection());
        cloudsPrimitiveRef.current = cloudsCollection;

        const count = density === "LOW" ? 15 : 35;
        let cloudColor = new Cesium.Color(0.98, 0.98, 1.0, 1.0);
        if (profile === "CYBER_SUNSET") {
          cloudColor = new Cesium.Color(0.98, 0.58, 0.72, 1.0);
        } else if (profile === "ALPINE_DAWN") {
          cloudColor = new Cesium.Color(0.95, 0.75, 0.58, 1.0);
        } else if (profile === "MIDNIGHT_NEON") {
          cloudColor = new Cesium.Color(0.18, 0.20, 0.35, 1.0);
        }

        for (let i = 0; i < count; i++) {
          const orbitRadius = 0.045; // ~4.5km bounds
          const angle = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * orbitRadius;
          
          const cloudLon = center.lon + r * Math.cos(angle);
          const cloudLat = center.lat + r * Math.sin(angle);
          const cloudAlt = center.elevation + 3300 + Math.random() * 1200; // Cloud deck height

          const cloudSizeX = 1600 + Math.random() * 1800;
          const cloudSizeY = 1200 + Math.random() * 1000;
          const cloudSizeZ = 700 + Math.random() * 700;

          cloudsCollection.add({
            position: Cesium.Cartesian3.fromDegrees(cloudLon, cloudLat, cloudAlt),
            scale: new Cesium.Cartesian2(cloudSizeX, cloudSizeY),
            maximumSize: new Cesium.Cartesian3(cloudSizeX, cloudSizeY, cloudSizeZ),
            slice: 0.0,
            brightness: profile === "CLEAR_DAY" ? 1.0 : profile === "CYBER_SUNSET" ? 0.75 : 0.35,
            color: cloudColor
          });
        }
        return; // Successfully spawned native volumetric clouds! No billboard needed.
      }
    } catch (e) {
      console.warn("Native volumetric CloudCollection crashed. Falling back to multi-lobed compound clouds:", e);
    }

    // B. MULTI-LOBED COMPOUND 3D COMPOSITE PUFFS FALLBACK
    const entities = viewer.entities;
    const count = density === "LOW" ? 12 : 28;

    // Soft organic nested SVG shapes to create dynamic cloud fluff depth!
    const puff1 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><radialGradient id="g" cx="50%" cy="35%" r="50%"><stop offset="0%" stop-color="white" stop-opacity="0.8"/><stop offset="45%" stop-color="white" stop-opacity="0.5"/><stop offset="100%" stop-color="white" stop-opacity="0"/></radialGradient><circle cx="128" cy="128" r="128" fill="url(%23g)"/></svg>`;
    const puff2 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><radialGradient id="g" cx="35%" cy="30%" r="55%"><stop offset="0%" stop-color="white" stop-opacity="0.75"/><stop offset="50%" stop-color="%23f5f5f5" stop-opacity="0.45"/><stop offset="100%" stop-color="%23e0e0e0" stop-opacity="0"/></radialGradient><circle cx="128" cy="128" r="128" fill="url(%23g)"/></svg>`;
    const puff3 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%23fdfdfd" stop-opacity="0.78"/><stop offset="60%" stop-color="%23e5e5e5" stop-opacity="0.35"/><stop offset="100%" stop-color="%23cccccc" stop-opacity="0"/></radialGradient><circle cx="128" cy="128" r="128" fill="url(%23g)"/></svg>`;
    const puffs = [puff1, puff2, puff3];

    for (let i = 0; i < count; i++) {
      const orbitRadius = 0.045;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * orbitRadius;
      
      const clusterLon = center.lon + r * Math.cos(angle);
      const clusterLat = center.lat + r * Math.sin(angle);
      const clusterAlt = center.elevation + 3300 + Math.random() * 1200;

      // Spawn 5 volumetric sub-lopes offset in X, Y, and Z so they have massive parallax!
      const clusterPuffCount = 5;
      for (let j = 0; j < clusterPuffCount; j++) {
        const dx = (Math.random() - 0.5) * 0.0035;
        const dy = (Math.random() - 0.5) * 0.0035;
        const dz = (Math.random() - 0.5) * 160;

        const cloudLon = clusterLon + dx;
        const cloudLat = clusterLat + dy;
        const cloudAlt = clusterAlt + dz;

        const cloudScale = 900 + Math.random() * 1300;
        const opacity = 0.22 + Math.random() * 0.28;
        const puffImage = puffs[j % puffs.length];

        let cloudColor = new Cesium.Color(1, 1, 1, opacity);
        if (profile === "CYBER_SUNSET") {
          cloudColor = new Cesium.Color(1.0, 0.58, 0.72, opacity * 1.15);
        } else if (profile === "ALPINE_DAWN") {
          cloudColor = new Cesium.Color(0.98, 0.76, 0.60, opacity * 1.15);
        } else if (profile === "MIDNIGHT_NEON") {
          cloudColor = new Cesium.Color(0.20, 0.22, 0.38, opacity * 0.65);
        }

        const cloudEnt = entities.add({
          position: Cesium.Cartesian3.fromDegrees(cloudLon, cloudLat, cloudAlt),
          billboard: {
            image: puffImage,
            width: cloudScale * 1.6,
            height: cloudScale,
            color: cloudColor,
            heightReference: Cesium.HeightReference.NONE,
          }
        });

        cloudsEntitiesRef.current.push(cloudEnt);
      }
    }
  };

  // Hot-reload or load custom Gaussian Splat & Ground Point-cloud Reconstruction Demo upon landing
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // A. CLEAR OLD SPLATS
    if (splatPrimitiveRef.current) {
      try {
        viewer.scene.primitives.remove(splatPrimitiveRef.current);
      } catch (err) {}
      splatPrimitiveRef.current = null;
    }
    if (customSplatRef.current) {
      try {
        if (customSplatRef.current.id) {
          viewer.entities.remove(customSplatRef.current);
        } else {
          viewer.scene.primitives.remove(customSplatRef.current);
        }
      } catch (err) {}
      customSplatRef.current = null;
    }

    // B. LOAD UPON REACHING LANDING IMMINENCE/COMPLETE
    if (gameState === SkydivingState.LANDING || gameState === SkydivingState.COMPLETE) {
      
      // 1. Load custom Gaussian Splat / 3D Tileset / GLTF Model of the square if URL is supplied
      if (dropConfig.gaussianSplatUrl && dropConfig.gaussianSplatUrl.trim() !== "") {
        const urlStr = dropConfig.gaussianSplatUrl.trim();
        try {
          if (urlStr.endsWith(".json") || urlStr.includes("tileset") || urlStr.includes("api/v1/assets")) {
            // Load custom 3D Tileset (natively handles Gaussian Splats tiles and 3D point cloud tiles)
            Cesium.Cesium3DTileset.fromUrl(urlStr, {
              backFaceCulling: false,
              maximumScreenSpaceError: 16
            }).then((tileset: any) => {
              viewer.scene.primitives.add(tileset);
              customSplatRef.current = tileset;
              
              tileset.readyPromise?.then(() => {
                const centerCartesian = Cesium.Cartesian3.fromDegrees(
                  MUNICH_MARIENPLATZ.lon,
                  MUNICH_MARIENPLATZ.lat,
                  MUNICH_MARIENPLATZ.elevation
                );
                tileset.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(centerCartesian);
              }).catch(() => {});
            }).catch((err: any) => {
              console.error("Cesium3DTileset.fromUrl load failed:", err);
            });
          } else if (urlStr.endsWith(".gltf") || urlStr.endsWith(".glb")) {
            // Load custom GLTF model representing the 3D splat
            const modelEntity = viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(
                MUNICH_MARIENPLATZ.lon,
                MUNICH_MARIENPLATZ.lat,
                MUNICH_MARIENPLATZ.elevation
              ),
              model: {
                uri: urlStr,
                minimumPixelSize: 128,
                maximumScale: 20000,
              }
            });
            customSplatRef.current = modelEntity;
          }
        } catch (e) {
          console.error("Error setting up custom Gaussian Splat URL:", e);
        }
      }

      // 2. Load built-in high-fidelity 3D Volumetric Gaussian Splatting Reconstruction Demo (Disabled)
    }
  }, [gameState, dropConfig.gaussianSplatUrl, dropConfig.enableSplattingDemo]);

  // Handle Keyboard looking controls (Arrow keys + WASD keys) and custom Look Events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === SkydivingState.COMPLETE && totalTimeRef.current === 0) return;
      
      const step = 8; // degrees per keystroke
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          targetUserPitchRef.current = Math.min(targetUserPitchRef.current + step, 170);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          targetUserPitchRef.current = Math.max(targetUserPitchRef.current - step, -110);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          targetUserYawRef.current -= step;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          targetUserYawRef.current += step;
          break;
        case "r":
        case "R":
          handleRecenter();
          break;
      }
    };

    const handleShiftLook = (e: any) => {
      const dir = e.detail;
      const step = 20; 
      if (dir === "UP") {
        targetUserPitchRef.current = Math.min(targetUserPitchRef.current + step, 170);
      } else if (dir === "DOWN") {
        targetUserPitchRef.current = Math.max(targetUserPitchRef.current - step, -110);
      } else if (dir === "LEFT") {
        targetUserYawRef.current -= step;
      } else if (dir === "RIGHT") {
        targetUserYawRef.current += step;
      } else if (dir === "CENTER") {
        handleRecenter();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("skydive-look", handleShiftLook);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("skydive-look", handleShiftLook);
    };
  }, [gameState]);

  // Master cursor hover-tracking looking handler for extreme fluid look-around - behaves like keyboard controls!
  const handleMouseMoveLook = (clientX: number, clientY: number) => {
    if (isDraggingRef.current) return;
    
    if (lastMousePosRef.current === null) {
      lastMousePosRef.current = { x: clientX, y: clientY };
      return;
    }
    
    const dx = clientX - lastMousePosRef.current.x;
    const dy = clientY - lastMousePosRef.current.y;
    
    lastMousePosRef.current = { x: clientX, y: clientY };
    
    // Smooth damp lookup speed matching keyboard arrows controls
    const sensitivity = 0.4;
    
    targetUserYawRef.current += dx * sensitivity;
    targetUserPitchRef.current = Math.min(
      Math.max(targetUserPitchRef.current - dy * sensitivity, -85),
      85
    );
  };

  const handleMouseMoveCombined = (clientX: number, clientY: number) => {
    if (isDraggingRef.current) {
      handleDragMove(clientX, clientY);
    } else {
      handleMouseMoveLook(clientX, clientY);
    }
  };

  const handleMouseLeaveCombined = () => {
    handleDragEnd();
    lastMousePosRef.current = null;
  };

  // Continuous frame updating rendering loops
  useEffect(() => {
    let animationId: number;

    const setupSimulatorTick = () => {
      lastTimeRef.current = performance.now();

      const runLoop = (timestamp: number) => {
        const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1); // Guard against giant delta spikes
        lastTimeRef.current = timestamp;

        if (
          simStateRef.current === SkydivingState.FREEFALL ||
          simStateRef.current === SkydivingState.PARACHUTE_OPEN ||
          simStateRef.current === SkydivingState.PARACHUTE_DESCENT ||
          simStateRef.current === SkydivingState.LANDING ||
          simStateRef.current === SkydivingState.COMPLETE // Keep updating view relative to eye level when complete!
        ) {
          
          if (simStateRef.current !== SkydivingState.COMPLETE) {
            totalTimeRef.current += dt;
          }

          // Force master parachute transition at 11s if clicked early in UI
          if (simStateRef.current === SkydivingState.PARACHUTE_OPEN && totalTimeRef.current < 11.0) {
            totalTimeRef.current = 11.0;
          }

          const t = totalTimeRef.current;

          // Integrated 20-second master flight progression timeline
          if (simStateRef.current !== SkydivingState.COMPLETE) {
            if (t < 11.0) {
              // state is FREEFALL (takes exactly 11 seconds)
              if (simStateRef.current !== SkydivingState.FREEFALL) {
                setGameState(SkydivingState.FREEFALL);
              }
              const progress = t / 11.0;
              // Accelerating cubic fall curve from 8500m to 1800m
              altitudeRef.current = 8500 - (8500 - 1800) * progress * progress;
              
              // Smooth supersonic speeds peaking up to 2400 km/h!
              speedRef.current = Math.min(t * 220, 2400);
              gForceRef.current = 1.0 + (speedRef.current / 2400) * 0.65 + (Math.random() - 0.5) * 0.12;

              gameAudio.updateWind(speedRef.current, false);
              gameAudio.triggerBeepAlarm(altitudeRef.current);
            } 
            else if (t < 13.0) {
              // state is PARACHUTE_OPEN - Shock Decel (lasts exactly 2 seconds)
              if (simStateRef.current !== SkydivingState.PARACHUTE_OPEN) {
                setGameState(SkydivingState.PARACHUTE_OPEN);
                onUpdateStats({ parachuteDeployAltitude: Math.round(altitudeRef.current) });
                gameAudio.playWhoosh();
              }
              const progress = (t - 11.0) / 2.0;
              altitudeRef.current = 1800 - (1800 - 1000) * progress;
              
              // Decelerate rapidly from 2400 down to 100 km/h scenic speed
              speedRef.current = 2400 - (2400 - 100) * (1 - Math.cos(progress * Math.PI / 2));
              gForceRef.current = 1.0 + Math.sin(progress * Math.PI) * 5.8; // Peak 6.8G deceleration shock!

              gameAudio.updateWind(speedRef.current, true);
            }
            else if (t < 18.0) {
              // state is PARACHUTE_DESCENT - Scenic Canopy Glide (lasts exactly 5 seconds)
              if (simStateRef.current !== SkydivingState.PARACHUTE_DESCENT) {
                setGameState(SkydivingState.PARACHUTE_DESCENT);
              }
              const progress = (t - 13.0) / 5.0;
              altitudeRef.current = 1000 - (1000 - 30) * progress;
              speedRef.current = 100 - (100 - 45) * progress;
              gForceRef.current = 1.0 + (Math.random() - 0.5) * 0.04;

              gameAudio.updateWind(speedRef.current, true);
            }
            else if (t < 20.0) {
              // state is LANDING - Flare and Touchdown (lasts exactly 2 seconds)
              if (simStateRef.current !== SkydivingState.LANDING) {
                setGameState(SkydivingState.LANDING);
              }
              const progress = (t - 18.0) / 2.0;
              altitudeRef.current = Math.max(30 - 30 * progress, 0);
              speedRef.current = 45 * (1 - progress);
              gForceRef.current = 1.0;
            }
            else {
              // state reaches t >= 20.0, Touchdown COMPLETE!
              altitudeRef.current = 0;
              speedRef.current = 0;
              gForceRef.current = 1.0;
              gameAudio.playLandingThud();
              setGameState(SkydivingState.COMPLETE);

              // Accuracies mapped to how accurately user positioned looking index
              const lookInaccuracy = Math.round(
                Math.abs(userYawRef.current % 360) * 0.15 + Math.abs(userPitchRef.current) * 0.2
              );
              const accuracyPct = Math.max(100 - lookInaccuracy, 82);

              onUpdateStats({
                peakVelocityKmh: 2400,
                totalDescentTimeSec: 20,
                landingAccuracyPct: accuracyPct,
                gForceMax: 6.8,
              });
            }
          } else {
            // Touchdown secured! Lock height/speed to steady ground state values
            altitudeRef.current = 0;
            speedRef.current = 0;
            gForceRef.current = 1.0;
          }

          // Dynamic Depth of Field Speed Blur - toned down for subtle realism (less blurry)
          const container = containerRef.current;
          if (container) {
            let blurVal = 0;
            if (altitudeRef.current > 1500) {
              const ratio = Math.min((altitudeRef.current - 1500) / (dropConfig.altitudeStart - 1500), 1);
              blurVal = ratio * 1.5; // toned down from 5.0px to 1.5px for crisp realism
            }
            container.style.filter = blurVal > 0.05 ? `blur(${blurVal.toFixed(2)}px)` : "none";
          }

          // 1. Calculate realistic cloud opacity based on altitude bell-curve
          let computedCloudOpacity = 0;
          if (dropConfig.cloudsDensity !== "NONE") {
            const basePeakOpacity = dropConfig.cloudsDensity === "HEAVY" ? 0.95 : 0.65;
            const currentAlt = altitudeRef.current;
            
            if (currentAlt > 6000) {
              const t = (8500 - currentAlt) / 2500;
              computedCloudOpacity = Math.max(t * 0.25, 0); 
            } else if (currentAlt >= 2000 && currentAlt <= 6000) {
              const x = Math.abs(currentAlt - 3500) / 1500;
              computedCloudOpacity = basePeakOpacity * (1.0 - Math.min(x, 0.85));
            } else {
              const t = Math.max(currentAlt - 500, 0) / 1500;
              computedCloudOpacity = t * 0.12; 
            }
          }
          
          // Throttled React state update to completely eliminate visual layout recalculation lag
          const newRoundedOpacity = Math.round(computedCloudOpacity * 100) / 100;
          if (Math.abs(lastCloudOpacityRef.current - newRoundedOpacity) > 0.02) {
            lastCloudOpacityRef.current = newRoundedOpacity;
            setCloudVideoOpacity(newRoundedOpacity);
          }

          // 2. Adjust cloud video playback tempo - 100% timed with descent speed/tempo!
          if (cloudVideoRef.current) {
            // Freefall speed yields ~3.2x tempo, decel slows to ~1.4x, gliding slows to ~0.6x tempo
            const targetPlaybackRate = Math.min(Math.max((speedRef.current / 120) * 1.5, 0.45), 3.5);
            // Smoothly interpolate playback rate
            const currentRate = cloudVideoRef.current.playbackRate || 1.0;
            cloudVideoRef.current.playbackRate = currentRate * 0.92 + targetPlaybackRate * 0.08;
          }

          // Distribute frame variables to DOM HUD
          onFrame(
            Math.max(altitudeRef.current, 0),
            Math.round(speedRef.current),
            Math.round(gForceRef.current * 10) / 10,
            Math.round(userYawRef.current)
          );

          // Update Live Camera Position in actual Cesium Scene
          if (viewerRef.current) {
            updateCesiumViewerCamera(dt);
          } else {
            // If Cesium is disabled, draw beautiful wireframe fallback on Canvas
            renderVectorCanvasFallback(dt);
          }
        }

        animationId = requestAnimationFrame(runLoop);
      };

      animationId = requestAnimationFrame(runLoop);
    };

    setupSimulatorTick();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [cesiumLoaded, dropConfig.profile, gameState]);

  // Smooth looking interpolation algorithm
  const updateCesiumViewerCamera = (dt: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Apply viewport bounds interpolation (gentle damping for cinematic fluidness)
    userYawRef.current = userYawRef.current + (targetUserYawRef.current - userYawRef.current) * (1 - Math.exp(-6.0 * dt));
    userPitchRef.current = userPitchRef.current + (targetUserPitchRef.current - userPitchRef.current) * (1 - Math.exp(-6.0 * dt));

    // Combine manual drags/hover coordinates with device gyroscopes offsets
    const finalYaw = userYawRef.current + deviceYawRef.current;
    // Base pitch tilts based on flight path height level
    // High up = looks straight down (-85 deg), landing = looks neutral (-10 deg)
    const basePitchRatio = Math.max(altitudeRef.current / dropConfig.altitudeStart, 0);
    const basePitch = -85 * basePitchRatio - 12 * (1 - basePitchRatio);
    const finalPitch = Math.min(Math.max(basePitch + userPitchRef.current + devicePitchRef.current, -89), 89);

    // Apply organic tilt-roll physically
    const finalRoll = deviceRollRef.current;

    // Calculate flight path offset (gliding down towards Marienplatz center point)
    const progress = Math.max(0, Math.min((dropConfig.altitudeStart - altitudeRef.current) / dropConfig.altitudeStart, 1));
    const smoothProgress = Math.sin(progress * Math.PI / 2); // easing curve

    const currentLon = MUNICH_MARIENPLATZ.lon + trajectoryStartOffset.lon * (1 - smoothProgress);
    const currentLat = MUNICH_MARIENPLATZ.lat + trajectoryStartOffset.lat * (1 - smoothProgress);
    
    // Ensure the camera height leaves a minimum clearances of 2.5m human standing eyes height relative to Marienplatz!
    const absoluteHeight = MUNICH_MARIENPLATZ.elevation + Math.max(altitudeRef.current, 2.5);

    // Set Cesium Position
    const eyeCartesian = Cesium.Cartesian3.fromDegrees(currentLon, currentLat, absoluteHeight);

    // Track simulated bearing
    const defaultBearing = 315; // Northwest swoop

    viewer.camera.setView({
      destination: eyeCartesian,
      orientation: {
        heading: Cesium.Math.toRadians(defaultBearing + finalYaw),
        pitch: Cesium.Math.toRadians(finalPitch),
        roll: Cesium.Math.toRadians(finalRoll),
      },
    });

    // Update opacity/appearance of procedural meshes based on height
    updateMarienplatzVisibilities(altitudeRef.current);
  };

  // High performance Canvas wireframe vector simulator fallback
  const renderVectorCanvasFallback = (dt: number) => {
    const canvas = canvasFallbackRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width = canvas.getBoundingClientRect().width;
    const h = canvas.height = canvas.getBoundingClientRect().height;

    // Clear Canvas and fill dark tactical neon viewport
    ctx.fillStyle = dropConfig.profile === "MIDNIGHT_NEON" ? "#04060c" : "#0d131a";
    ctx.fillRect(0, 0, w, h);

    // Grid details
    ctx.strokeStyle = "rgba(40, 150, 255, 0.12)";
    ctx.lineWidth = 1;
    
    // Draw running spatial neon lines
    const gridSpacing = 40;
    const scrollOffset = (altitudeRef.current * 0.1) % gridSpacing;
    for (let x = 0; x < w; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = scrollOffset; y < h; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Dynamic pitch/yaw calculations
    userYawRef.current = userYawRef.current + (targetUserYawRef.current - userYawRef.current) * (1 - Math.exp(-12.0 * dt));
    userPitchRef.current = userPitchRef.current + (targetUserPitchRef.current - userPitchRef.current) * (1 - Math.exp(-12.0 * dt));

    const finalYaw = (userYawRef.current + deviceYawRef.current) % 360;
    const finalPitch = userPitchRef.current + devicePitchRef.current;

    // Tactical Radar UI Fallback
    ctx.save();
    ctx.translate(w / 2, h / 2);

    // Crosshairs
    ctx.strokeStyle = "rgba(255, 176, 0, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Center ring
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-100, 0); ctx.lineTo(-20, 0);
    ctx.moveTo(20, 0); ctx.lineTo(100, 0);
    ctx.moveTo(0, -100); ctx.lineTo(0, -20);
    ctx.moveTo(0, 20); ctx.lineTo(0, 100);
    ctx.stroke();

    // Flight horizon ladder
    ctx.strokeStyle = "rgba(0, 255, 180, 0.65)";
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(0, 255, 180, 0.85)";
    
    const countLadders = 3;
    for (let i = -countLadders; i <= countLadders; i++) {
      const stepPitch = i * 20 - (finalPitch % 20);
      const relativeY = stepPitch * 4;
      ctx.beginPath();
      ctx.moveTo(-40, relativeY);
      ctx.lineTo(40, relativeY);
      ctx.stroke();
      ctx.fillText(`${Math.round(finalPitch + stepPitch)}°`, 45, relativeY + 3);
    }

    // Centered drop zone pointer showing we are gliding towards target latitude
    const progress = (dropConfig.altitudeStart - altitudeRef.current) / dropConfig.altitudeStart;
    const targetIndicatorX = -finalYaw * 2;
    const targetIndicatorY = 150 - progress * 150;

    ctx.fillStyle = "rgba(255, 120, 0, 0.8)";
    ctx.beginPath();
    ctx.arc(targetIndicatorX, targetIndicatorY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 9px 'JetBrains Mono'";
    ctx.fillText("MARIENPLATZ ZONE", targetIndicatorX + 14, targetIndicatorY + 3);

    ctx.restore();

    // Side compass tape
    ctx.fillStyle = "rgba(10, 15, 20, 0.65)";
    ctx.fillRect(0, 50, w, 30);
    ctx.strokeStyle = "rgba(40, 150, 255, 0.3)";
    ctx.strokeRect(0, 50, w, 30);

    const headingTapeStep = 20;
    const compassOffset = (finalYaw * 1.5) % w;
    ctx.fillStyle = "rgba(255, 230, 180, 0.8)";
    ctx.font = "9px monospace";
    for (let c = 0; c < w * 2; c += headingTapeStep) {
      const lineX = (c - compassOffset + w) % w;
      ctx.beginPath();
      ctx.moveTo(lineX, 50);
      ctx.lineTo(lineX, 58);
      ctx.stroke();
      const degLabel = Math.round((c * (360 / w)) % 360);
      ctx.fillText(`${degLabel}°`, lineX - 6, 74);
    }
  };

  return (
    <div
      id="simulatorContainer"
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing select-none outline-none overflow-hidden"
      onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMouseMoveCombined(e.clientX, e.clientY)}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleMouseLeaveCombined}
      onTouchStart={(e) => {
        if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchMove={(e) => {
        if (e.touches[0]) handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchEnd={handleDragEnd}
      onDoubleClick={handleRecenter}
    >
      {/* 3D Rendering Canvas */}
      {!cesiumError ? (
        <div ref={containerRef} className="w-full h-full select-none" />
      ) : (
        <canvas ref={canvasFallbackRef} className="w-full h-full" />
      )}

      {/* Dynamic Realistic Video Cloud Overlay with speed tempo synchronization */}
      {dropConfig.cloudsDensity !== "NONE" && gameState !== SkydivingState.COMPLETE && (
        <div 
          className="absolute inset-0 pointer-events-none mix-blend-screen overflow-hidden transition-opacity duration-1000"
          style={{
            opacity: cloudVideoOpacity,
          }}
        >
          <video
            ref={cloudVideoRef}
            src={dropConfig.cloudVideoUrl || "https://assets.mixkit.co/videos/preview/mixkit-flying-through-clouds-under-a-blue-sky-40097-large.mp4"}
            loop
            muted
            playsInline
            autoPlay
            className="w-full h-full object-cover scale-110 blur-[0.5px]"
            style={{
              filter: `contrast(1.05) brightness(${dropConfig.profile === 'MIDNIGHT_NEON' ? '0.25' : dropConfig.profile === 'CYBER_SUNSET' ? '0.75' : '1.0'})`,
            }}
          />
        </div>
      )}

      {/* Touch instruction HUD */}
      <div className="absolute bottom-6 right-6 z-10 bg-white/10 backdrop-blur-xl border border-white/20 px-4 py-2 rounded-full pointer-events-none text-xs text-white/95 font-mono flex items-center gap-2 shadow-2xl">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Drag to PAN Orbit | Double-Tap to Recenter</span>
      </div>
    </div>
  );
}
