/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SkydivingState {
  FREEFALL = "FREEFALL",
  PARACHUTE_OPEN = "PARACHUTE_OPEN",
  PARACHUTE_DESCENT = "PARACHUTE_DESCENT",
  LANDING = "LANDING",
  COMPLETE = "COMPLETE"
}

export type ThemeProfile = "CLEAR_DAY" | "CYBER_SUNSET" | "ALPINE_DAWN" | "MIDNIGHT_NEON";

export interface DropConfig {
  profile: ThemeProfile;
  altitudeStart: number; // e.g. 8500
  windSpeedMultiplier: number;
  cloudsDensity: "NONE" | "LOW" | "HEAVY";
  gaussianSplatUrl?: string; // custom gaussian splat url
  cloudVideoUrl?: string; // custom cloud video url for realistic transparent overlay
  enableSplattingDemo?: boolean; // toggle beautiful volumetric ground photogrammetry
}

export interface SimulationStats {
  peakVelocityKmh: number;
  totalDescentTimeSec: number;
  landingAccuracyPct: number; // distance from center of Marienplatz Column
  parachuteDeployAltitude: number;
  gForceMax: number;
}
