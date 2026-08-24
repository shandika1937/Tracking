/**
 * Main orchestrator for the Finger Tracking Studio.
 * Wires together camera, tracker, smoother, gesture detector, renderer, demo, and UI.
 */

import { CameraManager } from './camera/cameraManager.js';
import { HandTracker } from './tracking/handTracker.js';
import { LandmarkSmoother } from './tracking/smoother.js';
import { GestureDetector } from './gestures/gestureDetector.js';
import { CanvasRenderer } from './rendering/canvasRenderer.js';
import { DemoArea } from './ui/demoArea.js';
import { errorManager } from './utils/errors.js';
import {
  DEFAULT_SETTINGS,
  GESTURES,
  HAND_LANDMARKS,
  FINGER_INFO,
  FINGER_ORDER,
  QUALITY_PRESETS,
} from './utils/constants.js';
import { clamp, createMovingAverage, isMobile } from './utils/helpers.js';

export class Studio {
  constructor(refs) {
    this.refs = refs;
    this.settings = { ...DEFAULT_SETTINGS };
    this.camera = new CameraManager(refs.video);
    this.tracker = new HandTracker();
    this.smoother = new LandmarkSmoother(this.settings.smoothing);
    this.gestureDetector = new GestureDetector();
    this.renderer = new CanvasRenderer(refs.canvas);
    this.demo = new DemoArea(refs.demoCanvas);

    this.camera.onStateChange = (state) => this.onCameraStateChange(state);

    this.running = false;
    this.animFrame = null;
    this.lastFrameTime = 0;
    this.fps = 0;
    this.processingMs = 0;
    this.fpsAvg = createMovingAverage(15);
    this.processingAvg = createMovingAverage(15);
    this.lastResults = null;
    this.smoothedHands = [];
    this.gestureInfo = { perHand: [], primary: GESTURES.NONE };
    this.pinchState = { active: false, distance: null, lastChange: 0 };
    this.cursor = { x: 0.5, y: 0.5 };
    this.mode = 'hand';
    this.trackingEnabled = true;
    this.demoActive = false;
    this.errorUnsubscribe = null;
    this.lastVideoSize = { width: 0, height: 0 };
  }

  async init() {
    this.bindUI();
    this.subscribeErrors();
    this.applySettingsToUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.onVisibilityChange());
    this.setStatus('Idle. Click "Start Camera" to begin.');
    this.setFpsDisplay(0);
  }

  onVisibilityChange() {
    if (document.hidden) {
      // Pause render loop to save CPU
      if (this.animFrame) {
        cancelAnimationFrame(this.animFrame);
        this.animFrame = null;
      }
    } else if (this.running) {
      this.lastFrameTime = performance.now();
      this.loop();
    }
  }

  bindUI() {
    const r = this.refs;
    r.startBtn.addEventListener('click', () => this.start());
    r.stopBtn.addEventListener('click', () => this.stop());
    r.switchBtn.addEventListener('click', () => this.switchCamera());
    r.mirrorBtn.addEventListener('click', () => this.toggleMirror());
    r.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    r.trackingBtn.addEventListener('click', () => this.toggleTracking());

    r.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    });

    r.toggleLandmarks.addEventListener('change', (e) => { this.settings.showLandmarks = e.target.checked; });
    r.toggleSkeleton.addEventListener('change', (e) => { this.settings.showSkeleton = e.target.checked; });
    r.toggleLabels.addEventListener('change', (e) => { this.settings.showLabels = e.target.checked; });
    r.toggleCoords.addEventListener('change', (e) => { this.settings.showCoordinates = e.target.checked; });
    r.toggleSmoothing.addEventListener('change', (e) => {
      this.settings.smoothing = e.target.checked ? 0.6 : 0.0;
      this.smoother.setStrength(this.settings.smoothing);
    });
    r.smoothingSlider.addEventListener('input', (e) => {
      this.settings.smoothing = Number(e.target.value) / 100;
      this.smoother.setStrength(this.settings.smoothing);
      r.smoothingValue.textContent = `${e.target.value}%`;
    });
    r.pinchSlider.addEventListener('input', (e) => {
      this.settings.pinchThreshold = Number(e.target.value) / 1000;
      r.pinchValue.textContent = this.settings.pinchThreshold.toFixed(3);
    });
    r.cursorSlider.addEventListener('input', (e) => {
      this.settings.cursorSensitivity = Number(e.target.value) / 100;
      r.cursorValue.textContent = `${e.target.value}%`;
    });
    r.handsSelect.addEventListener('change', async (e) => {
      this.settings.numHands = Number(e.target.value);
      await this.applyTrackerOptions();
    });
    r.qualitySelect.addEventListener('change', async (e) => {
      const preset = QUALITY_PRESETS[e.target.value] || QUALITY_PRESETS.balanced;
      Object.assign(this.settings, preset);
      this.applySettingsToUI();
      await this.applyTrackerOptions();
    });
    r.debugToggle.addEventListener('click', () => {
      // The toggle is the panel head; toggle the parent panel's collapsed class
      const panel = r.debugPanel.closest('.panel');
      if (panel) panel.classList.toggle('collapsed');
    });
  }

  applySettingsToUI() {
    const r = this.refs;
    r.toggleLandmarks.checked = this.settings.showLandmarks;
    r.toggleSkeleton.checked = this.settings.showSkeleton;
    r.toggleLabels.checked = this.settings.showLabels;
    r.toggleCoords.checked = this.settings.showCoordinates;
    r.toggleSmoothing.checked = this.settings.smoothing > 0;
    r.smoothingSlider.value = Math.round(this.settings.smoothing * 100);
    r.smoothingValue.textContent = `${Math.round(this.settings.smoothing * 100)}%`;
    r.pinchSlider.value = Math.round(this.settings.pinchThreshold * 1000);
    r.pinchValue.textContent = this.settings.pinchThreshold.toFixed(3);
    r.cursorSlider.value = Math.round(this.settings.cursorSensitivity * 100);
    r.cursorValue.textContent = `${Math.round(this.settings.cursorSensitivity * 100)}%`;
    r.handsSelect.value = String(this.settings.numHands);
    this.setMode(this.mode);
  }

  subscribeErrors() {
    this.errorUnsubscribe = errorManager.onChange((err) => {
      const r = this.refs;
      if (!err) {
        r.errorBanner.classList.remove('visible');
        return;
      }
      r.errorBanner.classList.add('visible', `level-${err.level}`);
      r.errorTitle.textContent = err.title;
      r.errorMessage.textContent = err.message;
      r.errorHint.textContent = err.hint || '';
      r.errorHint.style.display = err.hint ? 'block' : 'none';
    });
    this.refs.errorClose.addEventListener('click', () => errorManager.clear());
  }

  async applyTrackerOptions() {
    if (!this.tracker.loaded) return;
    this.tracker.applyOptions({
      numHands: this.settings.numHands,
      modelComplexity: this.settings.modelComplexity,
      minDetectionConfidence: this.settings.minDetectionConfidence,
      minTrackingConfidence: this.settings.minTrackingConfidence,
    });
  }

  onCameraStateChange(state) {
    if (state === 'started') {
      this.refs.startBtn.disabled = true;
      this.refs.stopBtn.disabled = false;
      this.refs.switchBtn.disabled = !this.camera.hasMultipleCameras();
      this.setStatus('Camera live. Tracking your hand...');
      if (this.refs.stageEmpty) this.refs.stageEmpty.classList.add('hidden');
    } else {
      this.refs.startBtn.disabled = false;
      this.refs.stopBtn.disabled = true;
      this.refs.switchBtn.disabled = true;
      this.setStatus('Camera stopped. Click "Start Camera" to begin.');
      if (this.refs.stageEmpty) this.refs.stageEmpty.classList.remove('hidden');
    }
  }

  setStatus(text) {
    this.refs.statusText.textContent = text;
  }

  setFpsDisplay(fps) {
    const text = fps && fps > 0 ? Math.round(fps) : '--';
    this.refs.fpsValue.textContent = text;
    if (this.refs.fpsValueSide) {
      this.refs.fpsValueSide.textContent = text;
    }
  }

  resize() {
    const stage = this.refs.stage;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.renderer.resize(rect.width, rect.height);
    this.demo.resize(rect.width, rect.height);
    this.lastVideoSize = { width: rect.width, height: rect.height };
  }

  resizeOnVideoLoad() {
    // Once the video starts producing frames, ensure the stage has the right aspect
    const v = this.refs.video;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const aspect = v.videoWidth / v.videoHeight;
    const stage = this.refs.stage;
    if (!stage) return;
    const parent = stage.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    // Cap height; the CSS also uses max-height. We only adjust the width if useful.
    const targetHeight = Math.min(parentRect.width / aspect, parentRect.height * 0.85);
    const targetWidth = targetHeight * aspect;
    if (targetWidth > 0 && targetHeight > 0) {
      stage.style.maxWidth = `${Math.floor(targetWidth)}px`;
      stage.style.maxHeight = `${Math.floor(targetHeight)}px`;
    }
    requestAnimationFrame(() => this.resize());
  }

  setMode(mode) {
    this.mode = mode;
    this.settings.mode = mode;
    this.refs.modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    // Demo area is shown for gesture, cursor, and full demo modes
    this.demoActive = mode === 'multi' || mode === 'gesture' || mode === 'cursor';
    this.refs.demoPanel.classList.toggle('active', this.demoActive);
  }

  toggleMirror() {
    this.settings.mirror = !this.settings.mirror;
    this.refs.video.style.transform = this.settings.mirror ? 'scaleX(-1)' : 'scaleX(1)';
    this.refs.mirrorBtn.classList.toggle('active', this.settings.mirror);
  }

  toggleTracking() {
    this.trackingEnabled = !this.trackingEnabled;
    this.refs.trackingBtn.classList.toggle('active', this.trackingEnabled);
    this.refs.trackingBtn.textContent = this.trackingEnabled ? 'Tracking: On' : 'Tracking: Off';
    if (!this.trackingEnabled) {
      this.smoothedHands = [];
      this.smoother.reset();
    }
  }

  async toggleFullscreen() {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (err) {
      console.warn('Fullscreen toggle failed', err);
    }
  }

  async start() {
    this.setStatus('Requesting camera access...');
    try {
      const result = await this.camera.start();
      const { width, height } = result.settings || {};
      this.refs.video.style.transform = this.settings.mirror ? 'scaleX(-1)' : 'scaleX(1)';
      if (width && height) {
        this.refs.resolutionValue.textContent = `${width}×${height}`;
      }
      // Resize stage to match video aspect ratio
      this.refs.video.addEventListener('loadedmetadata', () => this.resizeOnVideoLoad(), { once: true });
      this.setStatus('Loading tracking model...');
      await this.tracker.load({
        numHands: this.settings.numHands,
        modelComplexity: this.settings.modelComplexity,
        minDetectionConfidence: this.settings.minDetectionConfidence,
        minTrackingConfidence: this.settings.minTrackingConfidence,
      });
      this.setStatus('Tracking active. Show your hand to the camera.');
      this.running = true;
      this.lastFrameTime = performance.now();
      this.loop();
    } catch (err) {
      this.running = false;
    }
  }

  stop() {
    this.running = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.animFrame = null;
    this.camera.stop();
    this.smoothedHands = [];
    this.smoother.reset();
    this.renderer.clear();
    this.setFpsDisplay(0);
  }

  async switchCamera() {
    if (!this.camera.running) return;
    try {
      this.setStatus('Switching camera...');
      const result = await this.camera.switchCamera();
      if (result?.settings?.width) {
        this.refs.resolutionValue.textContent = `${result.settings.width}×${result.settings.height}`;
      }
      this.setStatus('Camera live. Tracking your hand...');
    } catch (err) {
      // already handled
    }
  }

  loop() {
    if (!this.running) return;
    this.animFrame = requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    const fps = 1000 / Math.max(dt, 1);
    this.fps = this.fpsAvg.push(fps);
    this.setFpsDisplay(this.fps);

    const t0 = performance.now();
    let results = null;
    if (this.trackingEnabled) {
      results = this.tracker.predict(this.refs.video);
    }
    this.lastResults = results;
    const rawHands = results?.landmarks || [];
    const handedness = results?.handednesses || [];

    // If we lost the hand (was tracking before, now zero), reset smoother to avoid drift
    if (this.hadHandLastFrame && rawHands.length === 0) {
      this.smoother.reset();
    }
    this.hadHandLastFrame = rawHands.length > 0;

    // Smoothing
    this.smoothedHands = this.smoother.smooth(rawHands);

    // Gesture detection
    this.gestureInfo = this.gestureDetector.detect(this.smoothedHands, handedness);

    // Pinch detection (using the first hand)
    const pinchDist = this.smoothedHands[0]
      ? this.gestureDetector.pinchDistance(this.smoothedHands[0])
      : null;
    const prevPinch = this.pinchState.active;
    if (pinchDist !== null) {
      const isPinching = pinchDist < this.settings.pinchThreshold;
      if (isPinching !== prevPinch) {
        this.pinchState.active = isPinching;
        this.pinchState.lastChange = now;
      }
      this.pinchState.distance = pinchDist;
    } else {
      this.pinchState.active = false;
      this.pinchState.distance = null;
    }

    // Cursor: index fingertip of the first hand
    if (this.smoothedHands[0]) {
      const indexTip = this.smoothedHands[0][HAND_LANDMARKS.INDEX.TIP];
      // Mirror the cursor to match selfie view
      const cx = 1 - indexTip.x;
      const cy = indexTip.y;
      // Apply sensitivity (1.0 = direct mapping)
      const sx = (cx - 0.5) * this.settings.cursorSensitivity + 0.5;
      const sy = (cy - 0.5) * this.settings.cursorSensitivity + 0.5;
      this.cursor.x = clamp(sx, 0, 1);
      this.cursor.y = clamp(sy, 0, 1);
    }

    // Draw overlay
    this.renderer.setCursor({
      x: this.cursor.x,
      y: this.cursor.y,
      active: this.mode === 'cursor' || this.mode === 'multi',
      pinching: this.pinchState.active,
      visible: this.mode === 'cursor' || this.mode === 'multi' || this.mode === 'gesture',
    });
    this.renderer.draw(this.smoothedHands, handedness, {
      mode: this.mode,
      showLandmarks: this.settings.showLandmarks,
      showSkeleton: this.settings.showSkeleton,
      showLabels: this.settings.showLabels,
      showCoordinates: this.settings.showCoordinates,
      mirror: this.settings.mirror,
      currentGesture: this.gestureInfo.primary,
    });

    // Update demo
    if (this.demoActive) {
      this.demo.setCursor(this.cursor.x, this.cursor.y);
      this.demo.setPinch(this.pinchState.active);
      this.demo.setGesture(this.gestureInfo.primary);
      this.demo.update();
      this.demo.draw();
    } else {
      // Clear demo
      this.demo.ctx.clearRect(0, 0, this.demo.logicalWidth, this.demo.logicalHeight);
    }

    this.processingMs = this.processingAvg.push(performance.now() - t0);

    // Update side panels
    this.updateStats({
      fps: this.fps,
      processingMs: this.processingMs,
      hands: this.smoothedHands,
      handedness,
      gesture: this.gestureInfo,
      pinch: this.pinchState,
    });
  }

  updateStats({ fps, processingMs, hands, handedness, gesture, pinch }) {
    const r = this.refs;
    r.fpsValue.textContent = fps ? Math.round(fps) : '--';
    r.processingValue.textContent = `${processingMs.toFixed(1)} ms`;
    r.handsValue.textContent = String(hands.length);
    const conf = hands.length
      ? Math.round((handedness?.[0]?.score ?? 0) * 100)
      : 0;
    r.confidenceValue.textContent = `${conf}%`;
    r.gestureValue.textContent = gesture.primary;
    r.pinchStatusValue.textContent = pinch.active ? 'TRUE' : 'FALSE';
    r.pinchStatusValue.dataset.active = pinch.active ? 'true' : 'false';
    r.pinchDistValue.textContent = pinch.distance !== null ? pinch.distance.toFixed(4) : '--';
    r.pinchThresholdValue.textContent = this.settings.pinchThreshold.toFixed(3);

    // Finger coordinate table
    const rows = r.fingerRows;
    rows.innerHTML = '';
    if (!hands.length) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="6" class="empty">No hand detected</td>`;
      rows.appendChild(row);
    } else {
      hands.forEach((hand, idx) => {
        const handName = handedness?.[idx]?.displayName || handedness?.[idx]?.categoryName || `Hand ${idx + 1}`;
        for (const fKey of FINGER_ORDER) {
          const info = FINGER_INFO[fKey];
          const tip = hand[info.tipIndex];
          const pip = hand[info.tipIndex - 2];
          const row = document.createElement('tr');
          const state = this.fingerBentState(hand, fKey);
          row.innerHTML = `
            <td><span class="finger-color" style="background:${info.color}"></span>${info.label}</td>
            <td>${handName}</td>
            <td>${(1 - tip.x).toFixed(3)}</td>
            <td>${tip.y.toFixed(3)}</td>
            <td>${(tip.x - (pip?.x || 0)).toFixed(3)}</td>
            <td><span class="state-pill ${state === 'Open' ? 'open' : 'bent'}">${state}</span></td>
          `;
          rows.appendChild(row);
        }
      });
    }
  }

  fingerBentState(hand, fingerKey) {
    const tip = hand[FINGER_INFO[fingerKey].tipIndex];
    const pip = hand[FINGER_INFO[fingerKey].tipIndex - 2];
    if (fingerKey === 'thumb') {
      const indexMcp = hand[HAND_LANDMARKS.INDEX.MCP];
      const d1 = Math.hypot(tip.x - indexMcp.x, tip.y - indexMcp.y);
      const d2 = Math.hypot(pip.x - indexMcp.x, pip.y - indexMcp.y);
      return d1 > d2 * 1.05 ? 'Open' : 'Bent';
    }
    return tip.y < pip.y - 0.02 ? 'Open' : 'Bent';
  }
}
