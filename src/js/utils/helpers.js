/**
 * Small helper utilities used across the studio.
 */

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const distance2D = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const distance3D = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const formatNumber = (n, digits = 2) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '--';
  return Number(n).toFixed(digits);
};

export const debounce = (fn, wait = 200) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

export const throttle = (fn, wait = 100) => {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
};

export const createMovingAverage = (size = 8) => {
  const samples = [];
  return {
    push(value) {
      samples.push(value);
      if (samples.length > size) samples.shift();
      const sum = samples.reduce((a, b) => a + b, 0);
      return sum / samples.length;
    },
    reset() {
      samples.length = 0;
    },
  };
};

export const safeRequestAnimationFrame = (() => {
  return (cb) => {
    if (typeof window === 'undefined') return null;
    return window.requestAnimationFrame(cb);
  };
})();

export const getDevicePixelRatio = () => {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, 2.5);
};

export const isMobile = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isSecureContext = () => {
  if (typeof window === 'undefined') return false;
  // localhost is considered secure for development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return true;
  return Boolean(window.isSecureContext);
};
