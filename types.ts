
export interface Point {
  x: number;
  y: number;
  intensity: number;
  color: string;
}

export interface HandData {
  x: number;
  y: number;
  z: number;
  isDetected: boolean;
  fingersExtended: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export type ShapeType = 'sphere' | 'cone' | 'model3D' | 'none';

export interface Orb {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  shape: ShapeType;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  color: string;
  type: 'flake' | 'star';
}

export type Theme = 'midnight' | 'solstice' | 'aurora';
export type FilterMode = 'clean' | 'mystical';

export interface DetectionSettings {
  threshold: number;
  sensitivity: number;
  particleCount: number;
  gravity: number;
  theme: Theme;
  filterMode: FilterMode;
}
