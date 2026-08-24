/**
 * CameraManager handles getUserMedia, device enumeration, and camera switching.
 */

import { describeMediaError, errorManager } from '../utils/errors.js';
import { isSecureContext } from '../utils/helpers.js';

const DEFAULT_RESOLUTION = { width: { ideal: 1280 }, height: { ideal: 720 } };

export class CameraManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.currentDeviceId = null;
    this.devices = [];
    this.facingMode = 'user';
    this.running = false;
    this.onStateChange = null;
  }

  isSupported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async ensurePermissions() {
    if (!this.isSupported()) {
      throw Object.assign(new Error('Camera API not supported in this browser'), { name: 'NotSupportedError' });
    }
    if (!isSecureContext()) {
      throw Object.assign(new Error('Camera access requires HTTPS or localhost'), { name: 'SecurityError' });
    }
  }

  async refreshDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      this.devices = list.filter((d) => d.kind === 'videoinput');
      return this.devices;
    } catch (err) {
      console.warn('enumerateDevices failed', err);
      return [];
    }
  }

  async start({ deviceId, facingMode, resolution = DEFAULT_RESOLUTION } = {}) {
    await this.ensurePermissions();

    if (this.stream) this.stop();

    if (facingMode) this.facingMode = facingMode;
    if (deviceId) this.currentDeviceId = deviceId;

    const constraints = {
      audio: false,
      video: {
        ...resolution,
        ...(this.currentDeviceId
          ? { deviceId: { exact: this.currentDeviceId } }
          : { facingMode: this.facingMode }),
      },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        if (settings.deviceId) this.currentDeviceId = settings.deviceId;
      }

      this.video.srcObject = stream;
      this.video.setAttribute('playsinline', 'true');
      this.video.muted = true;

      await new Promise((resolve, reject) => {
        const onLoaded = () => {
          this.video.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        const onError = (e) => {
          this.video.removeEventListener('error', onError);
          reject(e);
        };
        this.video.addEventListener('loadedmetadata', onLoaded);
        this.video.addEventListener('error', onError);
        // Trigger play in case the browser is being weird
        this.video.play().catch(() => {});
      });

      // Refresh device list now that we have permission (labels become available)
      await this.refreshDevices();
      this.running = true;
      this.onStateChange?.('started');
      errorManager.clear();
      return { stream, deviceId: this.currentDeviceId, settings: track?.getSettings?.() };
    } catch (err) {
      const friendly = describeMediaError(err);
      errorManager.show(friendly.message, 'error', { title: friendly.title, hint: friendly.hint });
      this.running = false;
      throw err;
    }
  }

  async switchCamera() {
    if (!this.devices.length) await this.refreshDevices();
    if (this.devices.length < 2) {
      // Fall back to toggling facingMode
      const next = this.facingMode === 'user' ? 'environment' : 'user';
      return this.start({ facingMode: next });
    }
    const currentIndex = this.devices.findIndex((d) => d.deviceId === this.currentDeviceId);
    const next = this.devices[(currentIndex + 1) % this.devices.length];
    return this.start({ deviceId: next.deviceId });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.running = false;
    this.onStateChange?.('stopped');
  }

  getResolution() {
    if (!this.stream) return null;
    const track = this.stream.getVideoTracks()[0];
    const s = track?.getSettings?.() || {};
    return { width: s.width, height: s.height };
  }

  hasMultipleCameras() {
    return this.devices.length > 1;
  }
}
