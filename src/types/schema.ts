/**
 * Repswell Core Schema Contracts
 * All modules (video, tracking, rep counting, summary, UI) communicate strictly through these interfaces.
 */

export type PersonTrack = {
  person_id: string;
  bbox_timeline: {
    t: number; // timestamp in seconds
    x: number; // normalized coordinate 0..1 (top-left x)
    y: number; // normalized coordinate 0..1 (top-left y)
    w: number; // normalized width 0..1
    h: number; // normalized height 0..1
  }[];
};

export type ExerciseSession = {
  person_id: string;
  exercise_id: string;
  exercise_name: string;
  start_time: number; // timestamp in seconds
  end_time: number;   // timestamp in seconds
  rep_count: number;
  rep_timestamps: number[]; // timestamps in seconds for each completed rep
};

export type WorkoutSummary = {
  person_id: string;
  total_duration_s: number;
  sessions: ExerciseSession[];
  total_reps: number;
};

// === Biomechanical Keypoints & Pose Schema ===

export interface Keypoint2D {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  score?: number; // confidence 0..1
  name?: string;
}

export type PoseLandmarkName =
  | 'nose'
  | 'left_eye'
  | 'right_eye'
  | 'left_ear'
  | 'right_ear'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee'
  | 'left_ankle'
  | 'right_ankle';

export type PoseSkeleton = {
  [K in PoseLandmarkName]?: Keypoint2D;
};

export interface DetectionSnapshot {
  person_id: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
  exercise_name: string;
  exercise_id: string;
  current_reps: number;
  current_phase: 'concentric' | 'eccentric' | 'inflection' | 'lockout' | 'idle';
  primary_angle: {
    joint: string;
    angle: number; // in degrees
    min: number;
    max: number;
  };
  skeleton?: PoseSkeleton;
}

export interface PersonInfo {
  person_id: string;
  display_label: string; // e.g. "Person 1"
  anonymous_tag: string; // e.g. "MEMBER #P-8421"
  zone: string;          // e.g. "Squat Rack 1"
  current_exercise: string;
  accent_color: string;
}

export interface ScenarioMetadata {
  id: string;
  title: string;
  camera_tag: string; // e.g. "CAM 01 - SQUAT RACK"
  location: string;   // e.g. "Powerlifting Area"
  video_url: string;  // path to mp4 or simulated
  duration_s: number;
  persons: PersonInfo[];
  description: string;
}
