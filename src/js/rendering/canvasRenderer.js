/**
 * Canvas renderer: draws the skeleton, landmarks, labels, and gesture indicators
 * on top of the camera preview.
 */

import {
  FINGER_INFO,
  FINGER_ORDER,
  HAND_CONNECTIONS,
  HAND_LANDMARKS,
  GESTURES,
} from '../utils/constants.js';
import { getDevicePixelRatio } from '../utils/helpers.js';

const DEFAULT_THEME = {
  skeleton: 'rgba(110, 200, 255, 0.85)',
  skeletonShadow: 'rgba(0,0,0,0.5)',
  landmark: '#ffffff',
  landmarkStroke: 'rgba(0,0,0,0.6)',
  wrist: '#ffce5e',
  fingertipHalo: 'rgba(255,255,255,0.25)',
  label: '#ffffff',
  labelBg: 'rgba(8, 14, 24, 0.78)',
  cursor: '#5ec8ff',
  cursorRing: 'rgba(94, 200, 255, 0.45)',
  pinchActive: '#ff5e7e',
  gestureBg: 'rgba(124, 255, 178, 0.18)',
  gestureBorder: 'rgba(124, 255, 178, 0.6)',
};

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = { ...DEFAULT_THEME };
    this.cursor = { x: 0.5, y: 0.5, active: false, pinching: false, visible: false };
  }

  resize(width, height) {
    if (!this.canvas) return;
    const dpr = getDevicePixelRatio();
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.logicalWidth = width;
    this.logicalHeight = height;
  }

  clear() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.logicalWidth || this.canvas.width, this.logicalHeight || this.canvas.height);
  }

  setCursor({ x, y, active, pinching, visible }) {
    if (typeof x === 'number') this.cursor.x = x;
    if (typeof y === 'number') this.cursor.y = y;
    if (typeof active === 'boolean') this.cursor.active = active;
    if (typeof pinching === 'boolean') this.cursor.pinching = pinching;
    if (typeof visible === 'boolean') this.cursor.visible = visible;
  }

  /**
   * Draw the full tracking overlay.
   * @param {Object} ctx
   * @param {Array} hands smoothed landmarks
   * @param {Array} handedness MediaPipe handedness info
   * @param {Object} options
   */
  draw(hands, handedness, options) {
    const {
      mode = 'hand',
      showLandmarks = true,
      showSkeleton = true,
      showLabels = true,
      showCoordinates = true,
      mirror = true,
    } = options || {};
    this.clear();
    if (!hands?.length) {
      this.drawCursor();
      return;
    }
    hands.forEach((hand, idx) => {
      const handLabel = handedness?.[idx]?.displayName || handedness?.[idx]?.categoryName || `Hand ${idx + 1}`;
      // In 'finger' mode, skip the palm/wrist dot and emphasise the finger lines
      const emphasizeFingers = mode === 'finger';
      if (showSkeleton) this.drawSkeleton(hand, mirror, { emphasizeFingers });
      if (showLandmarks) this.drawLandmarks(hand, mirror, { emphasizeFingers });
      if (showLabels) this.drawFingerLabels(hand, handLabel, mirror);
    });
    this.drawGestureBadge(options);
    this.drawCursor();
    if (showCoordinates) this.drawCoordinatesPanel(hands, handedness, mode);
  }

  // Map a normalized landmark (0..1) to canvas pixel coordinates.
  project(lm, mirror = true) {
    const w = this.logicalWidth || this.canvas.clientWidth;
    const h = this.logicalHeight || this.canvas.clientHeight;
    const x = mirror ? (1 - lm.x) * w : lm.x * w;
    const y = lm.y * h;
    return { x, y };
  }

  drawSkeleton(hand, mirror, opts = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = this.theme.skeletonShadow;
    ctx.shadowBlur = 6;

    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = this.project(hand[a], mirror);
      const pb = this.project(hand[b], mirror);
      // In finger mode, fade out the palm-to-finger base connections
      const isPalmLink = a === 0 || b === 0;
      const baseAlpha = opts.emphasizeFingers && isPalmLink ? 0.35 : 0.95;
      ctx.globalAlpha = baseAlpha;
      // Colour the connection by the "destination" finger
      const color = this.skeletonColorForConnection(a, b);
      ctx.strokeStyle = color;
      ctx.lineWidth = opts.emphasizeFingers ? 5 : 4;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  skeletonColorForConnection(a, b) {
    // The "child" landmark (further from wrist) determines the finger color
    const child = a > b ? a : b;
    for (const fk of FINGER_ORDER) {
      const info = FINGER_INFO[fk];
      if (info.tipIndex === child || (child >= info.tipIndex - 3 && child <= info.tipIndex)) {
        return this.colorWithAlpha(info.color, 0.95);
      }
    }
    return this.theme.skeleton;
  }

  drawLandmarks(hand, mirror, opts = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    for (const fingerKey of FINGER_ORDER) {
      const info = FINGER_INFO[fingerKey];
      const indices = this.indicesForFinger(fingerKey);
      for (const i of indices) {
        const p = this.project(hand[i], mirror);
        const isTip = i === info.tipIndex;
        const radius = isTip ? (opts.emphasizeFingers ? 9 : 7) : 4.5;
        // halo
        if (isTip) {
          ctx.beginPath();
          ctx.fillStyle = this.colorWithAlpha(info.color, 0.3);
          ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.fillStyle = info.color;
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        // outline
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (!opts.emphasizeFingers) {
      // Wrist dot
      const wrist = this.project(hand[HAND_LANDMARKS.WRIST], mirror);
      ctx.beginPath();
      ctx.fillStyle = this.theme.wrist;
      ctx.arc(wrist.x, wrist.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  indicesForFinger(name) {
    switch (name) {
      case 'thumb': return [1, 2, 3, 4];
      case 'index': return [5, 6, 7, 8];
      case 'middle': return [9, 10, 11, 12];
      case 'ring': return [13, 14, 15, 16];
      case 'pinky': return [17, 18, 19, 20];
      default: return [];
    }
  }

  drawFingerLabels(hand, handLabel, mirror) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.save();
    ctx.font = '600 12px "Inter", "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const fingerKey of FINGER_ORDER) {
      const info = FINGER_INFO[fingerKey];
      const tipIndex = info.tipIndex;
      const tip = hand[tipIndex];
      const p = this.project(tip, mirror);
      const label = info.label;
      const w = ctx.measureText(label).width + 14;
      const h = 20;
      const offsetX = -w / 2;
      const offsetY = -34;
      const x = p.x + offsetX;
      const y = p.y + offsetY;
      this.roundRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = this.colorWithAlpha(info.color, 0.18);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.colorWithAlpha(info.color, 0.7);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(label, p.x, y + h / 2);
    }
    // Hand label
    if (handLabel) {
      const wrist = this.project(hand[HAND_LANDMARKS.WRIST], mirror);
      const txt = `${handLabel} hand`;
      const w = ctx.measureText(txt).width + 16;
      const h = 22;
      const x = wrist.x - w / 2;
      const y = wrist.y + 18;
      this.roundRect(ctx, x, y, w, h, 11);
      ctx.fillStyle = 'rgba(10,18,30,0.75)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(txt, wrist.x, y + h / 2);
    }
    ctx.restore();
  }

  drawCoordinatesPanel(hands, handedness, mode) {
    const ctx = this.ctx;
    if (!ctx || !hands?.length) return;
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const padding = 12;
    const lineHeight = 18;
    const headersHeight = 22;
    const tipLines = [];
    hands.forEach((hand, idx) => {
      const handName = handedness?.[idx]?.displayName || handedness?.[idx]?.categoryName || `Hand ${idx + 1}`;
      for (const fingerKey of FINGER_ORDER) {
        const info = FINGER_INFO[fingerKey];
        const tip = hand[info.tipIndex];
        if (!tip) continue;
        const displayX = (1 - tip.x).toFixed(3);
        const displayY = tip.y.toFixed(3);
        tipLines.push({
          label: `${info.label} (${handName})`,
          x: displayX,
          y: displayY,
          color: info.color,
        });
      }
    });
    if (!tipLines.length) return;
    ctx.save();
    ctx.font = '12px "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace';
    const maxLabelW = Math.max(...tipLines.map((l) => ctx.measureText(l.label).width));
    const maxValW = Math.max(...tipLines.map((l) => ctx.measureText(`${l.x}, ${l.y}`).width));
    const panelW = Math.ceil(maxLabelW + maxValW + 32);
    const panelH = headersHeight + tipLines.length * lineHeight + padding * 2;
    const x = padding;
    const y = h - panelH - padding;
    this.roundRect(ctx, x, y, panelW, panelH, 12);
    ctx.fillStyle = 'rgba(8,14,24,0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '600 11px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('FINGERTIP COORDINATES', x + 12, y + 8);
    ctx.font = '12px "JetBrains Mono", ui-monospace, monospace';
    tipLines.forEach((line, i) => {
      const rowY = y + headersHeight + i * lineHeight + padding - 4;
      ctx.fillStyle = line.color;
      ctx.fillRect(x + 12, rowY + 5, 6, 6);
      ctx.fillStyle = '#e8eef7';
      ctx.fillText(line.label, x + 24, rowY);
      ctx.fillStyle = '#9fb1c7';
      const valX = x + 24 + ctx.measureText(line.label).width + 8;
      ctx.fillText(`${line.x}, ${line.y}`, valX, rowY);
    });
    ctx.restore();
  }

  drawCursor() {
    const ctx = this.ctx;
    if (!ctx || !this.cursor.visible) return;
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    const x = this.cursor.x * w;
    const y = this.cursor.y * h;
    ctx.save();
    const color = this.cursor.pinching ? this.theme.pinchActive : this.theme.cursor;
    // Outer ring
    ctx.beginPath();
    ctx.strokeStyle = this.colorWithAlpha(color, this.cursor.pinching ? 0.95 : 0.55);
    ctx.lineWidth = 2;
    ctx.arc(x, y, this.cursor.pinching ? 22 : 28, 0, Math.PI * 2);
    ctx.stroke();
    // Soft halo
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 60);
    grad.addColorStop(0, this.colorWithAlpha(color, 0.35));
    grad.addColorStop(1, this.colorWithAlpha(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 60, 0, Math.PI * 2);
    ctx.fill();
    // Center dot
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, this.cursor.pinching ? 5 : 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawGestureBadge(options) {
    const ctx = this.ctx;
    if (!ctx) return;
    const gesture = options?.currentGesture;
    if (!gesture || gesture === GESTURES.NONE) return;
    const w = this.logicalWidth;
    ctx.save();
    ctx.font = '600 13px "Inter", system-ui, sans-serif';
    const text = `✋ ${gesture}`;
    const tw = ctx.measureText(text).width + 24;
    const x = w - tw - 12;
    const y = 12;
    const h = 30;
    this.roundRect(ctx, x, y, tw, h, 15);
    ctx.fillStyle = this.theme.gestureBg;
    ctx.fill();
    ctx.strokeStyle = this.theme.gestureBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#eafff3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + tw / 2, y + h / 2);
    ctx.restore();
  }

  roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  colorWithAlpha(hex, alpha) {
    if (hex.startsWith('rgba') || hex.startsWith('rgb(')) return hex;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
