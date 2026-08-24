/**
 * Centralised error reporter for user-facing issues.
 */

class ErrorManager {
  constructor() {
    this.listeners = new Set();
    this.current = null;
  }

  onChange(cb) {
    this.listeners.add(cb);
    if (this.current) cb(this.current);
    return () => this.listeners.delete(cb);
  }

  show(message, level = 'error', options = {}) {
    this.current = {
      message,
      level,
      title: options.title || this.defaultTitle(level),
      hint: options.hint || null,
      timestamp: Date.now(),
    };
    this.listeners.forEach((cb) => cb(this.current));
  }

  clear() {
    if (!this.current) return;
    this.current = null;
    this.listeners.forEach((cb) => cb(null));
  }

  defaultTitle(level) {
    switch (level) {
      case 'warning': return 'Heads up';
      case 'info': return 'Info';
      case 'success': return 'Success';
      default: return 'Something went wrong';
    }
  }
}

export const errorManager = new ErrorManager();

// Friendly descriptions for getUserMedia / MediaPipe errors
export function describeMediaError(err) {
  if (!err) return { title: 'Unknown error', message: 'An unknown error occurred.' };
  const name = err.name || '';
  const message = err.message || String(err);

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      title: 'Camera access denied',
      message: 'You blocked camera access. Please allow it in your browser settings and try again.',
      hint: 'Click the camera icon in the address bar to grant permission.',
    };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      title: 'No camera found',
      message: 'No camera device was detected. Connect a camera and try again.',
    };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      title: 'Camera in use',
      message: 'Another application may be using the camera. Close it and try again.',
    };
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return {
      title: 'Camera settings unsupported',
      message: 'The selected camera configuration is not supported. Try switching cameras or lowering resolution.',
    };
  }
  if (name === 'SecurityError') {
    return {
      title: 'HTTPS required',
      message: 'Camera access requires a secure context. Use HTTPS or http://localhost for development.',
    };
  }
  if (name === 'AbortError') {
    return {
      title: 'Camera start aborted',
      message: 'Camera start was aborted. Please try again.',
    };
  }
  return { title: 'Camera error', message: message || 'An unknown error occurred while accessing the camera.' };
}
