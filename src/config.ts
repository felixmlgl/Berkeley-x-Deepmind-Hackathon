/**
 * Repswell Runtime Configuration
 * Teammates can flip USE_MOCK_DATA to switch between mock replay and real inference.
 */

export const CONFIG = {
  // When true, the replay shows the recorded clips in videosCorrect/ with the vision pipeline output
  // from demo-data/ (real skeletons and rep counts). Takes precedence over USE_MOCK_DATA.
  USE_DEMO_DATA: true,

  // Master flag: when true, uses pre-recorded mock tracks & timelines.
  // When false, mounts real browser/edge MediaPipe Pose Landmarker.
  USE_MOCK_DATA: true,

  // Demo display preferences
  DISPLAY: {
    SHOW_SKELETON: true,
    SHOW_BOUNDING_BOX: true,
    SHOW_ANGLE_ARC: true,
    SHOW_CCTV_HUD: true,
    SOUND_EFFECTS: true,
  },

  // Edge processor specifications displayed in UI
  EDGE_SYSTEM: {
    DEVICE: "Raspberry Pi 5 (8GB) + Coral Edge TPU",
    RESOLUTION: "1080p @ 30 FPS",
    PROTOCOL: "RTSP / ONVIF IP Camera",
    LATENCY_MS: 32,
    PRIVACY_MODE: "Local Edge-Only (No raw video leaves premises)",
  },
};
