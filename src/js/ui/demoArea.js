/**
 * Interactive demo area: uses real hand landmark positions to drive virtual objects.
 * - Index fingertip controls a cursor.
 * - Pinch (thumb tip ↔ index tip) lets you grab and drag a virtual orb.
 * - Open palm emits a particle burst.
 * - Fist changes the demo background color.
 */

import { GESTURES, HAND_LANDMARKS } from '../utils/constants.js';
import { distance3D, getDevicePixelRatio } from '../utils/helpers.js';

const PARTICLE_COUNT = 40;

export class DemoArea {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cursor = { x: 0.5, y: 0.5 };
    this.pinching = false;
    this.grabbed = false;
    this.orb = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
    this.buttons = this.buildButtons();
    this.particles = [];
    this.bgColor = 'rgba(20, 30, 50, 0.6)';
    this.bgTarget = 'rgba(20, 30, 50, 0.6)';
    this.gesture = GESTURES.NONE;
    this.hint = 'Move your hand in front of the camera. Point, pinch, open, and fist to interact.';
    this.dpr = 1;
    this.logicalWidth = 0;
    this.logicalHeight = 0;
  }

  resize(width, height) {
    this.dpr = getDevicePixelRatio();
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.logicalWidth = width;
    this.logicalHeight = height;
    // Keep orb inside bounds
    this.orb.x = Math.min(0.9, Math.max(0.1, this.orb.x));
    this.orb.y = Math.min(0.9, Math.max(0.1, this.orb.y));
  }

  buildButtons() {
    // Each button: normalized position + size + label + state
    return [
      { id: 'red', label: 'Red', x: 0.15, y: 0.18, w: 0.18, h: 0.16, color: '#ff5e7e', state: false },
      { id: 'green', label: 'Green', x: 0.41, y: 0.18, w: 0.18, h: 0.16, color: '#7cffb2', state: false },
      { id: 'blue', label: 'Blue', x: 0.67, y: 0.18, w: 0.18, h: 0.16, color: '#5ec8ff', state: false },
      { id: 'reset', label: 'Reset', x: 0.35, y: 0.78, w: 0.3, h: 0.12, color: '#ffd95e', state: false },
    ];
  }

  setCursor(x, y) {
    this.cursor.x = x;
    this.cursor.y = y;
    // hover state for buttons
    for (const b of this.buttons) {
      b.hover = this.pointInButton(x, y, b);
    }
  }

  setPinch(pinching) {
    if (pinching && !this.pinching) {
      this.onPinchStart();
    } else if (!pinching && this.pinching) {
      this.onPinchEnd();
    }
    this.pinching = pinching;
  }

  setGesture(gesture) {
    const previous = this.gesture;
    this.gesture = gesture;
    if (gesture === GESTURES.OPEN_PALM && previous !== GESTURES.OPEN_PALM) {
      this.spawnBurst();
      this.bgTarget = 'rgba(40, 70, 50, 0.55)';
    } else if (gesture === GESTURES.FIST && previous !== GESTURES.FIST) {
      this.bgTarget = 'rgba(70, 40, 50, 0.55)';
      this.buttons.forEach((b) => (b.state = false));
    } else if (gesture === GESTURES.PEACE) {
      this.bgTarget = 'rgba(50, 40, 70, 0.55)';
    } else if (gesture === GESTURES.POINTING) {
      this.bgTarget = 'rgba(20, 30, 50, 0.6)';
    } else if (gesture === GESTURES.THUMBS_UP) {
      this.bgTarget = 'rgba(50, 70, 40, 0.55)';
    } else if (gesture === GESTURES.OK) {
      this.bgTarget = 'rgba(70, 50, 20, 0.55)';
    } else {
      this.bgTarget = 'rgba(20, 30, 50, 0.6)';
    }
  }

  pointInButton(x, y, b) {
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  onPinchStart() {
    // If grabbing a button, toggle it
    for (const b of this.buttons) {
      if (this.pointInButton(this.cursor.x, this.cursor.y, b)) {
        if (b.id === 'reset') {
          b.state = false;
          this.orb.x = 0.5;
          this.orb.y = 0.5;
        } else {
          b.state = !b.state;
        }
        return;
      }
    }
    // Otherwise grab the orb
    this.grabbed = true;
  }

  onPinchEnd() {
    this.grabbed = false;
  }

  spawnBurst() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 0.4 + Math.random() * 0.4;
      this.particles.push({
        x: this.cursor.x,
        y: this.cursor.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        size: 3 + Math.random() * 4,
        color: ['#ff5e7e', '#5ec8ff', '#7cffb2', '#ffd95e', '#c97cff'][i % 5],
      });
    }
  }

  update() {
    // Smoothly interpolate background
    this.bgColor = lerpColor(this.bgColor, this.bgTarget, 0.05);
    // Orb physics
    if (this.grabbed) {
      this.orb.x = lerp(this.orb.x, this.cursor.x, 0.35);
      this.orb.y = lerp(this.orb.y, this.cursor.y, 0.35);
    } else {
      // Gentle gravity + drift
      this.orb.vy += 0.15 / 60;
      this.orb.vx *= 0.99;
      this.orb.vy *= 0.99;
      this.orb.x += this.orb.vx / 60;
      this.orb.y += this.orb.vy / 60;
      if (this.orb.x < 0.05) { this.orb.x = 0.05; this.orb.vx *= -0.5; }
      if (this.orb.x > 0.95) { this.orb.x = 0.95; this.orb.vx *= -0.5; }
      if (this.orb.y > 0.95) { this.orb.y = 0.95; this.orb.vy *= -0.5; }
    }
    // Particles
    this.particles = this.particles.filter((p) => {
      p.x += p.vx / 60;
      p.y += p.vy / 60;
      p.vy += 0.4 / 60;
      p.life -= 0.02;
      return p.life > 0;
    });
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.logicalWidth;
    const h = this.logicalHeight;
    ctx.clearRect(0, 0, w, h);
    // Background panel
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    // Buttons
    for (const b of this.buttons) {
      const bx = b.x * w;
      const by = b.y * h;
      const bw = b.w * w;
      const bh = b.h * h;
      ctx.save();
      ctx.fillStyle = b.state ? b.color : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = b.hover ? b.color : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = b.hover ? 2 : 1;
      roundRectPath(ctx, bx, by, bw, bh, 12);
      ctx.fill();
      ctx.stroke();
      // Glow when hovered or active
      if (b.hover) {
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 18;
        roundRectPath(ctx, bx, by, bw, bh, 12);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // Label
      ctx.fillStyle = b.state ? '#0b0f17' : '#e6eef9';
      ctx.font = '600 14px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, bx + bw / 2, by + bh / 2);
      ctx.restore();
    }

    // Orb
    const ox = this.orb.x * w;
    const oy = this.orb.y * h;
    const activeColor = this.grabbed ? '#ff5e7e' : '#7cffb2';
    ctx.save();
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, 60);
    grad.addColorStop(0, activeColor);
    grad.addColorStop(1, 'rgba(124,255,178,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ox, oy, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = activeColor;
    ctx.arc(ox, oy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    ctx.restore();

    // Particles
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Cursor reticle
    const cx = this.cursor.x * w;
    const cy = this.cursor.y * h;
    ctx.save();
    ctx.strokeStyle = this.pinching ? '#ff5e7e' : '#5ec8ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 8);
    ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 20);
    ctx.stroke();
    ctx.restore();

    // Hint
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,24,0.55)';
    const hint = `Gesture: ${this.gesture}${this.pinching ? '  •  Pinching' : ''}${this.grabbed ? '  •  Holding orb' : ''}`;
    ctx.font = '500 12px "Inter", system-ui, sans-serif';
    const tw = ctx.measureText(hint).width + 24;
    const tx = (w - tw) / 2;
    const ty = h - 28;
    roundRectPath(ctx, tx, ty, tw, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#e6eef9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hint, w / 2, ty + 11);
    ctx.restore();
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(a, b, t) {
  // Expect rgba strings "rgba(r,g,b,a)"; lerp components
  const parse = (s) => {
    const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!m) return [20, 30, 50, 0.6];
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : 1];
  };
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  const al = lerp(ca[3], cb[3], t).toFixed(3);
  return `rgba(${r},${g},${bl},${al})`;
}
