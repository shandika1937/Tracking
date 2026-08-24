/**
 * HandLandmarker wrapper using MediaPipe Tasks Vision.
 * Loads the model lazily and exposes a predict(videoElement) -> results method.
 */

import { errorManager } from '../utils/errors.js';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.runningMode = 'VIDEO';
    this.lastVideoTime = -1;
    this.loading = false;
    this.loaded = false;
    this.lastResults = null;
  }

  async load({ numHands = 2, modelComplexity = 1, minDetectionConfidence = 0.5, minTrackingConfidence = 0.5 } = {}) {
    if (this.loaded) {
      this.applyOptions({ numHands, modelComplexity, minDetectionConfidence, minTrackingConfidence });
      return;
    }
    if (this.loading) {
      await this.waitUntilLoaded();
      this.applyOptions({ numHands, modelComplexity, minDetectionConfidence, minTrackingConfidence });
      return;
    }
    this.loading = true;
    try {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: this.runningMode,
        numHands,
        modelComplexity,
        minHandDetectionConfidence: minDetectionConfidence,
        minHandPresenceConfidence: minDetectionConfidence,
        minTrackingConfidence: minTrackingConfidence,
      });
      this.loaded = true;
    } catch (err) {
      console.error('Failed to load MediaPipe HandLandmarker', err);
      errorManager.show(
        'Failed to load the hand tracking model. Check your internet connection and reload the page.',
        'error',
        { title: 'Model load failed' },
      );
      throw err;
    } finally {
      this.loading = false;
    }
  }

  waitUntilLoaded() {
    return new Promise((resolve) => {
      const check = () => {
        if (this.loaded) resolve();
        else setTimeout(check, 80);
      };
      check();
    });
  }

  applyOptions({ numHands, modelComplexity, minDetectionConfidence, minTrackingConfidence }) {
    if (!this.landmarker) return;
    try {
      this.landmarker.setOptions({
        numHands,
        modelComplexity,
        minHandDetectionConfidence: minDetectionConfidence,
        minHandPresenceConfidence: minDetectionConfidence,
        minTrackingConfidence: minTrackingConfidence,
      });
    } catch (err) {
      console.warn('Failed to update tracker options', err);
    }
  }

  predict(video) {
    if (!this.landmarker || !video || video.readyState < 2) return null;
    const now = video.currentTime;
    if (now === this.lastVideoTime) return this.lastResults;
    this.lastVideoTime = now;
    try {
      const results = this.landmarker.detectForVideo(video, performance.now());
      this.lastResults = results;
      return results;
    } catch (err) {
      console.error('HandLandmarker.detectForVideo error', err);
      return null;
    }
  }

  dispose() {
    try {
      this.landmarker?.close?.();
    } catch {}
    this.landmarker = null;
    this.loaded = false;
    this.lastResults = null;
  }
}
