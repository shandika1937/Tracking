/**
 * Constants and configuration for the Finger Tracking Studio.
 */

// MediaPipe hand landmark indices (21 keypoints per hand)
export const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB: { CMC: 1, MCP: 2, IP: 3, TIP: 4 },
  INDEX: { MCP: 5, PIP: 6, DIP: 7, TIP: 8 },
  MIDDLE: { MCP: 9, PIP: 10, DIP: 11, TIP: 12 },
  RING: { MCP: 13, PIP: 14, DIP: 15, TIP: 16 },
  PINKY: { MCP: 17, PIP: 18, DIP: 19, TIP: 20 },
};

// Skeleton connections: pairs of landmark indices that should be linked
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

// Human-readable finger labels and their color theme
export const FINGER_INFO = {
  thumb: { id: 0, label: 'Thumb', color: '#ff5e7e', tipIndex: 4 },
  index: { id: 1, label: 'Index', color: '#5ec8ff', tipIndex: 8 },
  middle: { id: 2, label: 'Middle', color: '#7cffb2', tipIndex: 12 },
  ring: { id: 3, label: 'Ring', color: '#ffd95e', tipIndex: 16 },
  pinky: { id: 4, label: 'Pinky', color: '#c97cff', tipIndex: 20 },
};

export const FINGER_ORDER = ['thumb', 'index', 'middle', 'ring', 'pinky'];

// Each finger's joint landmark indices (excluding the tip) for label rendering
export const FINGER_JOINTS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

// Gesture identifiers
export const GESTURES = {
  NONE: 'None',
  OPEN_PALM: 'Open Palm',
  FIST: 'Fist',
  POINTING: 'Pointing',
  PEACE: 'Peace / V Sign',
  THUMBS_UP: 'Thumbs Up',
  OK: 'OK Sign',
  PINCH: 'Pinch',
};

// Default settings
export const DEFAULT_SETTINGS = {
  mode: 'hand', // 'hand' | 'finger' | 'cursor' | 'gesture' | 'multi'
  mirror: true,
  showLandmarks: true,
  showSkeleton: true,
  showLabels: true,
  showCoordinates: true,
  showFps: true,
  smoothing: 0.5, // 0 = no smoothing, 0.95 = heavy smoothing
  cursorSensitivity: 1.0,
  pinchThreshold: 0.06, // normalized distance
  numHands: 2,
  modelComplexity: 1, // 0 lite, 1 full
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

// Performance / quality presets
export const QUALITY_PRESETS = {
  low: { numHands: 1, modelComplexity: 0, minDetectionConfidence: 0.4, minTrackingConfidence: 0.4 },
  balanced: { numHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 },
  high: { numHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 },
};
