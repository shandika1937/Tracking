/**
 * Entry point. Collects DOM references and starts the studio.
 */

import { Studio } from './js/studio.js';
import { isMobile } from './js/utils/helpers.js';

const refs = {
  video: document.getElementById('camera'),
  canvas: document.getElementById('overlay'),
  demoCanvas: document.getElementById('demo-canvas'),
  stage: document.getElementById('stage'),
  demoPanel: document.getElementById('demo-panel'),

  // Control buttons
  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  switchBtn: document.getElementById('switch-btn'),
  mirrorBtn: document.getElementById('mirror-btn'),
  fullscreenBtn: document.getElementById('fullscreen-btn'),
  trackingBtn: document.getElementById('tracking-btn'),

  // Mode buttons
  modeButtons: Array.from(document.querySelectorAll('.mode-btn')),

  // Toggles & sliders
  toggleLandmarks: document.getElementById('toggle-landmarks'),
  toggleSkeleton: document.getElementById('toggle-skeleton'),
  toggleLabels: document.getElementById('toggle-labels'),
  toggleCoords: document.getElementById('toggle-coords'),
  toggleSmoothing: document.getElementById('toggle-smoothing'),
  smoothingSlider: document.getElementById('smoothing-slider'),
  smoothingValue: document.getElementById('smoothing-value'),
  pinchSlider: document.getElementById('pinch-slider'),
  pinchValue: document.getElementById('pinch-value'),
  cursorSlider: document.getElementById('cursor-slider'),
  cursorValue: document.getElementById('cursor-value'),
  handsSelect: document.getElementById('hands-select'),
  qualitySelect: document.getElementById('quality-select'),
  debugToggle: document.getElementById('debug-toggle'),

  // Debug panel
  debugPanel: document.getElementById('debug-panel'),

  // Stats
  statusText: document.getElementById('status-text'),
  fpsValue: document.getElementById('fps-value'),
  fpsValueSide: document.getElementById('fps-value-side'),
  processingValue: document.getElementById('processing-value'),
  handsValue: document.getElementById('hands-value'),
  confidenceValue: document.getElementById('confidence-value'),
  gestureValue: document.getElementById('gesture-value'),
  pinchStatusValue: document.getElementById('pinch-status-value'),
  pinchDistValue: document.getElementById('pinch-distance-value'),
  pinchThresholdValue: document.getElementById('pinch-threshold-value'),
  resolutionValue: document.getElementById('resolution-value'),
  fingerRows: document.getElementById('finger-rows'),

  // Error banner
  errorBanner: document.getElementById('error-banner'),
  errorTitle: document.getElementById('error-title'),
  errorMessage: document.getElementById('error-message'),
  errorHint: document.getElementById('error-hint'),
  errorClose: document.getElementById('error-close'),

  // Empty state
  stageEmpty: document.getElementById('stage-empty'),
};

const studio = new Studio(refs);
window.studio = studio; // for debugging
studio.init().catch((err) => {
  console.error('Studio init failed', err);
});

// If on mobile, suggest landscape for best experience
if (isMobile()) {
  document.body.classList.add('is-mobile');
}
