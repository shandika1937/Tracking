/**
 * Exponential smoothing utilities for landmarks.
 * Each landmark is stored as {x, y, z}; smoother blends previous frame with new sample.
 */

import { HAND_LANDMARKS } from '../utils/constants.js';

const NUM_LANDMARKS = 21;

const createLandmark = () => ({ x: 0, y: 0, z: 0 });

export class LandmarkSmoother {
  constructor(strength = 0.5) {
    this.strength = strength;
    this.hands = []; // array of 21-landmark buffers
  }

  setStrength(v) {
    this.strength = Math.max(0, Math.min(0.95, v));
  }

  reset() {
    this.hands = [];
  }

  /**
   * Process results from MediaPipe and return smoothed landmarks per hand.
   * @param {Array<Array<{x,y,z}>>} hands raw landmarks from MediaPipe (one array per hand)
   * @returns {Array<Array<{x,y,z,smoothed:boolean}>>}
   */
  smooth(hands) {
    if (!hands || !hands.length) {
      this.hands = [];
      return [];
    }
    if (this.hands.length !== hands.length) {
      // reset if hand count changed
      this.hands = hands.map((hand) => hand.map((lm) => ({ ...lm })));
      return this.hands.map((hand) => hand.map((lm) => ({ ...lm, smoothed: false })));
    }
    const t = 1 - this.strength; // alpha: how much new sample contributes
    for (let h = 0; h < hands.length; h++) {
      const prev = this.hands[h];
      const cur = hands[h];
      for (let i = 0; i < NUM_LANDMARKS; i++) {
        const p = prev[i] || createLandmark();
        const c = cur[i] || createLandmark();
        const x = p.x + (c.x - p.x) * t;
        const y = p.y + (c.y - p.y) * t;
        const z = p.z + (c.z - p.z) * t;
        prev[i] = { x, y, z };
      }
    }
    return this.hands.map((hand) => hand.map((lm) => ({ ...lm, smoothed: true })));
  }
}
