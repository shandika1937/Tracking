/**
 * Gesture detection: classifies a hand landmark array into named gestures.
 * Based on relative positions of fingertips vs PIP joints and finger orientation.
 */

import { GESTURES, HAND_LANDMARKS } from '../utils/constants.js';
import { distance2D, distance3D } from '../utils/helpers.js';

const FINGERS = [
  { name: 'thumb', tip: 4, pip: 3, mcp: 2 },
  { name: 'index', tip: 8, pip: 6, mcp: 5 },
  { name: 'middle', tip: 12, pip: 10, mcp: 9 },
  { name: 'ring', tip: 16, pip: 14, mcp: 13 },
  { name: 'pinky', tip: 20, pip: 18, mcp: 17 },
];

/**
 * Returns true if finger is extended (open).
 * Uses the relation between tip and PIP/MCP joints along the y axis (in mirrored view).
 * Also handles the thumb separately by comparing x distance to index MCP.
 */
function isFingerExtended(hand, finger) {
  if (finger.name === 'thumb') {
    const tip = hand[finger.tip];
    const ip = hand[finger.pip];
    const mcp = hand[finger.mcp];
    const indexMcp = hand[HAND_LANDMARKS.INDEX.MCP];
    // Thumb is considered extended if it's far from the index MCP horizontally
    const tipToIndex = distance2D(tip, indexMcp);
    const ipToIndex = distance2D(ip, indexMcp);
    return tipToIndex > ipToIndex * 1.05;
  }
  const tip = hand[finger.tip];
  const pip = hand[finger.pip];
  const mcp = hand[finger.mcp];
  // For non-thumb fingers, the tip should be farther from the wrist than the PIP joint.
  // y axis points downward in normalized image coords.
  return tip.y < pip.y - 0.02;
}

function getExtendedFingers(hand) {
  return FINGERS.map((f) => ({ ...f, extended: isFingerExtended(hand, f) }));
}

function fingerVector(hand, finger) {
  const tip = hand[finger.tip];
  const mcp = hand[finger.mcp];
  return { x: tip.x - mcp.x, y: tip.y - mcp.y };
}

function classifyHand(hand) {
  if (!hand || hand.length < 21) return GESTURES.NONE;
  const extended = getExtendedFingers(hand);
  const ext = Object.fromEntries(extended.map((f) => [f.name, f.extended]));
  const totalExtended = extended.filter((f) => f.extended).length;

  // Pinch: thumb tip very close to index tip, AND other fingers are extended
  // (otherwise it just looks like a fist)
  const pinchDist = distance3D(hand[HAND_LANDMARKS.THUMB.TIP], hand[HAND_LANDMARKS.INDEX.TIP]);
  const middleTip = hand[HAND_LANDMARKS.MIDDLE.TIP];
  const middlePip = hand[HAND_LANDMARKS.MIDDLE.PIP];
  const middleExtended = middleTip.y < middlePip.y - 0.02;
  if (pinchDist < 0.05 && middleExtended) {
    return GESTURES.OK;
  }

  // Fist: no fingers extended
  if (totalExtended === 0) return GESTURES.FIST;

  // Thumbs up: only thumb extended, and it points upward
  if (ext.thumb && !ext.index && !ext.middle && !ext.ring && !ext.pinky) {
    const thumbVec = fingerVector(hand, FINGERS[0]);
    if (thumbVec.y < -0.1) return GESTURES.THUMBS_UP;
  }

  // Pointing: only index extended
  if (ext.index && !ext.middle && !ext.ring && !ext.pinky && !ext.thumb) {
    return GESTURES.POINTING;
  }

  // Peace: index and middle extended, others closed
  if (ext.index && ext.middle && !ext.ring && !ext.pinky) {
    const indexVec = fingerVector(hand, FINGERS[1]);
    const middleVec = fingerVector(hand, FINGERS[2]);
    const indexMiddleDist = distance2D(hand[8], hand[12]);
    if (indexMiddleDist > 0.04) return GESTURES.PEACE;
  }

  // Open palm: all fingers extended
  if (totalExtended >= 4 && ext.index && ext.middle && ext.ring && ext.pinky) {
    return GESTURES.OPEN_PALM;
  }

  return GESTURES.NONE;
}

function classifyHandedness(hand, handednessLabel) {
  // MediaPipe returns "Left" / "Right" as the hand as seen by the camera.
  // We flip the interpretation when the video is mirrored (selfie view).
  return handednessLabel || 'Unknown';
}

export class GestureDetector {
  constructor() {
    this.lastGestures = []; // per-hand last gesture
  }

  reset() {
    this.lastGestures = [];
  }

  /**
   * @param {Array<Array<{x,y,z}>>} smoothedHands
   * @param {Array<{displayName:string, score:number}>} handedness
   * @returns {{perHand: Array<{name:string, hand:string, fingers:Array}>, primary:string}}
   */
  detect(smoothedHands, handedness) {
    if (!smoothedHands?.length) {
      this.lastGestures = [];
      return { perHand: [], primary: GESTURES.NONE };
    }
    const perHand = smoothedHands.map((hand, idx) => {
      const info = handedness?.[idx] || {};
      const fingers = FINGERS.map((f) => ({
        name: f.name,
        extended: isFingerExtended(hand, f),
      }));
      const gesture = classifyHand(hand);
      return {
        name: gesture,
        hand: classifyHandedness(hand, info.displayName || info.categoryName),
        confidence: info.score ?? 1,
        fingers,
      };
    });
    this.lastGestures = perHand;
    // Pick the most informative gesture across hands (priority order)
    const priority = [
      GESTURES.OK,
      GESTURES.PINCH,
      GESTURES.OPEN_PALM,
      GESTURES.PEACE,
      GESTURES.POINTING,
      GESTURES.THUMBS_UP,
      GESTURES.FIST,
    ];
    let primary = GESTURES.NONE;
    for (const g of priority) {
      if (perHand.some((p) => p.name === g)) {
        primary = g;
        break;
      }
    }
    return { perHand, primary };
  }

  /**
   * Pinch distance: thumb tip <-> index tip. Returns normalised value.
   */
  pinchDistance(hand) {
    if (!hand) return null;
    return distance3D(hand[HAND_LANDMARKS.THUMB.TIP], hand[HAND_LANDMARKS.INDEX.TIP]);
  }
}
