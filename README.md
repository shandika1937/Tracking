# 👋 Finger Tracking Studio

A browser-based studio that performs real-time hand and finger tracking directly on your device using [MediaPipe Tasks Vision](https://developers.google.com/mediapipe). No frames ever leave your browser.

![Made with MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks%20Vision-5ec8ff) ![Runs locally](https://img.shields.io/badge/Processing-Local-7cffb2) ![No upload](https://img.shields.io/badge/Video-No%20Upload-c97cff)

## ✨ Features

- **Realtime hand tracking** — full 21-landmark skeleton per hand, supports up to 2 hands.
- **Per-finger tracking** — separate visualization for thumb, index, middle, ring, and pinky with their own color and label.
- **Cursor mode** — the index fingertip becomes a smooth virtual cursor with configurable sensitivity.
- **Gesture detection** — open palm, fist, pointing, peace / V sign, thumbs up, OK.
- **Pinch detection** — distance between thumb tip and index tip with adjustable threshold.
- **Interactive demo area** — pinch to grab a virtual orb, hover and click virtual buttons, open palm for particle burst, fist to clear.
- **Smoothing** — per-landmark exponential smoothing, resets when a hand is lost.
- **Multi-hand support** — left and right hands are labeled separately.
- **Mobile friendly** — front/back camera switching, responsive layout, touch interactions, compact controls.
- **Modern dark UI** — clean panel layout, FPS counter, processing time, hand count, confidence, gesture, resolution.

## 🧠 Tech

- **Vite** for the dev server / build.
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`) for the hand landmark model — loaded from a CDN.
- Plain ES modules, no framework, no JSX, no build steps required at runtime.

## 📁 Project layout

```
Tracking/
├── index.html
├── package.json
├── vite.config.js
├── public/
└── src/
    ├── main.js                       # Entry point, wires up the studio
    ├── js/
    │   ├── studio.js                 # Main orchestrator (camera + tracker + renderer + UI)
    │   ├── camera/
    │   │   └── cameraManager.js      # getUserMedia, device enumeration, switch
    │   ├── tracking/
    │   │   ├── handTracker.js        # MediaPipe HandLandmarker wrapper
    │   │   └── smoother.js           # Exponential smoothing of landmarks
    │   ├── gestures/
    │   │   └── gestureDetector.js    # Gesture + pinch classification
    │   ├── rendering/
    │   │   └── canvasRenderer.js     # Skeleton, landmarks, labels, cursor overlay
    │   ├── ui/
    │   │   └── demoArea.js           # Interactive demo (orb, buttons, particles)
    │   └── utils/
    │       ├── constants.js          # Landmark indices, gestures, settings
    │       ├── helpers.js            # Math helpers, FPS, mobile detection
    │       └── errors.js             # Centralised friendly error reporting
    └── styles/
        └── main.css                  # All styles (dark theme)
```

## 🚀 Running

Requires **Node.js 18+** (Node 20+ recommended).

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`. Grant camera permission when prompted. The model is loaded lazily the first time you start the camera.

### Production build

```bash
npm run build
npm run preview
```

### Important: HTTPS for camera

Browsers only allow `getUserMedia` in a **secure context**. For local development:
- `http://localhost` is treated as secure.
- `http://127.0.0.1` is also treated as secure.

For deployment you **must** use HTTPS (or localhost). The studio checks for this and shows a clear error if not.

## 🎮 Modes

1. **Hand** — full skeleton, all 21 landmarks, finger labels.
2. **Fingers** — emphasises the five fingers with their own color and a larger tip halo; the palm links are dimmed.
3. **Cursor** — index fingertip drives a smooth virtual cursor. Sensitivity is configurable.
4. **Gesture** — focuses on gesture recognition. The detected gesture name floats above the stage.
5. **Demo** — full interactive demo area. Point to hover virtual buttons, pinch to click them, pinch on the orb to grab and drag it, open palm for a particle burst, fist to clear button states.

## 🔧 Controls

- **Start Camera** / **Stop** — control the camera stream.
- **⇄ Switch** — cycle through available cameras (front / back / external).
- **⇌ Mirror** — flip the preview horizontally.
- **⛶ Fullscreen** — toggle fullscreen on the whole app.
- **Tracking: On/Off** — pause processing but keep the camera preview.

### Debug panel

- Show / hide landmarks, skeleton, labels, coordinates.
- Toggle smoothing, plus a manual strength slider.
- Cursor sensitivity.
- Pinch threshold.
- Number of hands and quality preset (Low / Balanced / High).

## 🧪 Privacy

- Camera frames stay in the browser. The model runs via MediaPipe on-device (WebAssembly + WebGL).
- The only external requests are the MediaPipe model file and the JS/WASM bundle loaded from `cdn.jsdelivr.net` and `storage.googleapis.com`. Once cached, the studio can run without further network access.
- A live "Camera processing: Local" indicator in the top bar reminds you of this.

## 🛠 Error handling

The studio reports errors through a banner at the top of the page. Friendly messages cover:

- Camera permission denied.
- No camera found.
- Camera in use by another app.
- HTTPS required.
- Model load failure.
- Browser does not support `getUserMedia`.

## ⚙️ Performance

- Uses `requestAnimationFrame` for the render loop.
- Smoothing avoids jitter without adding latency.
- Render loop pauses when the tab is hidden.
- The model only re-runs on new frames (`video.currentTime` change).
- Quality presets reduce model complexity / number of hands on lower-end devices.

## 📦 Dependencies

```json
{
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.18"
  },
  "devDependencies": {
    "vite": "^5.4.10"
  }
}
```

The MediaPipe model and WASM files are loaded from CDN at runtime; they are not bundled.

## License

MIT
