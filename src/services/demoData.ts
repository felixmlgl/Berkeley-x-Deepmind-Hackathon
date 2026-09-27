/**
 * Demo Data Service
 * Reads the vision pipeline output committed under demo-data/<clip>/ (see backend/README.md) and the
 * matching browser-safe clip in videosCorrect/<clip>.mp4, and exposes them through the same schema the
 * mock scenarios use: ScenarioMetadata, ExerciseSession and per-frame DetectionSnapshots.
 *
 * session.json (a few KB) is bundled eagerly; overlay.json (skeletons at 15 fps, ~1 MB) is code-split and
 * loaded when its scenario is opened.
 */

import {
  DetectionSnapshot,
  ExerciseSession,
  PersonInfo,
  PersonTrack,
  PoseLandmarkName,
  PoseSkeleton,
  ScenarioMetadata,
} from '../types/schema';
import { calculateJointAngle } from './repCounter';

// === session.json / overlay.json contracts (produced by backend/vision/run.py) ===

interface DemoSet {
  exercise: string;
  equipment?: string;
  start_s: number;
  end_s: number;
  reps: number;
  rep_times_s: number[]; // rep completed -> counter +1
  rep_peak_s: number[];  // furthest point of each rep
  rep_rest_s: number[];  // rest position before each rep
}

interface DemoPerson {
  id: number;
  first_seen_s: number;
  last_seen_s: number;
  total_reps: number;
  sets: DemoSet[];
}

interface DemoSession {
  video: string;
  duration_s: number;
  width: number;
  height: number;
  people: DemoPerson[];
}

interface DemoOverlay {
  fps: number;
  width: number;
  height: number;
  // frames[i].p = [[person_id, x1, y1, x2, y2, kx0, ky0, ... kx16, ky16], ...] in video pixels, -1 = hidden
  frames: { t: number; p: number[][] }[];
}

const sessionFiles = import.meta.glob<DemoSession>('/demo-data/*/session.json', {
  eager: true,
  import: 'default',
});
const overlayFiles = import.meta.glob<DemoOverlay>('/demo-data/*/overlay.json', { import: 'default' });
// Converted clips only; the raw VideoEx* recordings kept next to them are not meant for the browser
const videoFiles = import.meta.glob<string>(['/videosCorrect/*.mp4', '!/videosCorrect/VideoEx*'], {
  eager: true,
  query: '?url',
  import: 'default',
});

// COCO-17 keypoint order used by the pose model
const COCO_KEYPOINTS: PoseLandmarkName[] = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
  'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
];

const ACCENT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#06B6D4', '#EF4444'];
const MAX_LISTED_PERSONS = 6;
const LEG_EXERCISES = new Set(['squat', 'lunge', 'leg_press', 'deadlift', 'romanian_deadlift', 'hip_thrust']);

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function exerciseName(set: DemoSet): string {
  const name = titleCase(set.exercise);
  const equipment = set.equipment && !['bodyweight', 'none', 'unknown'].includes(set.equipment)
    ? ` (${titleCase(set.equipment).toLowerCase()})`
    : '';
  return name + equipment;
}

// Backend ids are snake_case ("bicep_curl"); the frontend muscle map uses kebab-case ("bicep-curl").
const exerciseId = (set: DemoSet) => set.exercise.replace(/_/g, '-');
const personId = (id: number) => `person-${id}`;

// === Scenario registry ===

interface DemoClip {
  id: string;
  session: DemoSession;
  metadata: ScenarioMetadata;
  sessions: ExerciseSession[];
}

function buildClip(path: string, session: DemoSession, index: number): DemoClip {
  const id = path.split('/')[2]; // /demo-data/<id>/session.json
  const active = session.people.filter((p) => p.sets.length > 0).sort((a, b) => b.total_reps - a.total_reps);
  const idle = session.people
    .filter((p) => p.sets.length === 0)
    .sort((a, b) => (b.last_seen_s - b.first_seen_s) - (a.last_seen_s - a.first_seen_s));
  const listed = [...active, ...idle].slice(0, MAX_LISTED_PERSONS);

  const persons: PersonInfo[] = listed.map((p, i) => ({
    person_id: personId(p.id),
    display_label: `Person ${p.id}`,
    anonymous_tag: `#P-${String(p.id).padStart(3, '0')}`,
    zone: `In view ${Math.round(p.first_seen_s)}–${Math.round(p.last_seen_s)}s`,
    current_exercise: p.sets.length ? exerciseName(p.sets[0]) : 'No sets detected',
    accent_color: ACCENT_COLORS[i % ACCENT_COLORS.length],
  }));

  const sessions: ExerciseSession[] = session.people.flatMap((p) =>
    p.sets.map((s) => ({
      person_id: personId(p.id),
      exercise_id: exerciseId(s),
      exercise_name: exerciseName(s),
      start_time: s.start_s,
      end_time: s.end_s,
      rep_count: s.reps,
      rep_timestamps: s.rep_times_s,
    }))
  );

  const main = active[0]?.sets[0];
  const metadata: ScenarioMetadata = {
    id,
    title: main ? titleCase(main.exercise) : 'Busy gym floor',
    camera_tag: `CAM ${String(index + 1).padStart(2, '0')}`,
    location: 'Recorded demo clip',
    video_url: videoFiles[`/videosCorrect/${session.video}`] ?? '',
    duration_s: session.duration_s,
    width: session.width,
    height: session.height,
    persons,
    description: `${session.people.length} people tracked, ${active.length} with counted sets.`,
  };

  return { id, session, metadata, sessions };
}

// Clips with counted sets first, so the default scenario shows the rep counter.
const CLIPS: DemoClip[] = Object.entries(sessionFiles)
  .sort(([a, sa], [b, sb]) => {
    const reps = (s: DemoSession) => s.people.reduce((n, p) => n + p.total_reps, 0);
    return reps(sb) - reps(sa) || a.localeCompare(b);
  })
  .map(([path, session], i) => buildClip(path, session, i));

const clipById = new Map(CLIPS.map((c) => [c.id, c]));

export const DEMO_SCENARIOS: ScenarioMetadata[] = CLIPS.map((c) => c.metadata);

export function isDemoScenario(scenarioId: string): boolean {
  return clipById.has(scenarioId);
}

export function getDemoSessions(scenarioId: string): ExerciseSession[] {
  return clipById.get(scenarioId)?.sessions ?? [];
}

// === Overlay loading ===

const overlayCache = new Map<string, DemoOverlay>();

export async function loadDemoOverlay(scenarioId: string): Promise<void> {
  if (overlayCache.has(scenarioId)) return;
  const load = overlayFiles[`/demo-data/${scenarioId}/overlay.json`];
  if (load) overlayCache.set(scenarioId, await load());
}

function frameAt(overlay: DemoOverlay, t: number) {
  const frames = overlay.frames;
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo];
}

// === Per-frame detections ===

function phaseAt(set: DemoSet | undefined, t: number): DetectionSnapshot['current_phase'] {
  if (!set) return 'idle';
  for (let i = 0; i < set.rep_times_s.length; i++) {
    const rest = set.rep_rest_s[i];
    const peak = set.rep_peak_s[i];
    const done = set.rep_times_s[i];
    if (t < rest || t > done + 0.3) continue;
    if (Math.abs(t - peak) < 0.15) return 'inflection';
    return t < peak ? 'eccentric' : 'concentric';
  }
  return 'lockout';
}

function primaryAngle(skeleton: PoseSkeleton, exercise: string | undefined): DetectionSnapshot['primary_angle'] {
  const legs = exercise !== undefined && LEG_EXERCISES.has(exercise);
  const [a, b, c]: PoseLandmarkName[][] = legs
    ? [['left_hip', 'right_hip'], ['left_knee', 'right_knee'], ['left_ankle', 'right_ankle']]
    : [['left_shoulder', 'right_shoulder'], ['left_elbow', 'right_elbow'], ['left_wrist', 'right_wrist']];
  // Use whichever side has all three joints visible
  for (const side of [1, 0]) {
    const pa = skeleton[a[side]];
    const pb = skeleton[b[side]];
    const pc = skeleton[c[side]];
    if (pa && pb && pc) {
      const angle = Math.round(calculateJointAngle(pa, pb, pc));
      return legs
        ? { joint: 'Knee Angle', angle, min: 70, max: 170 }
        : { joint: 'Elbow Angle', angle, min: 50, max: 170 };
    }
  }
  return { joint: legs ? 'Knee Angle' : 'Elbow Angle', angle: 0, min: 0, max: 180 };
}

export function getDemoDetectionsAtTime(scenarioId: string, t: number): DetectionSnapshot[] {
  const clip = clipById.get(scenarioId);
  const overlay = overlayCache.get(scenarioId);
  if (!clip || !overlay || overlay.frames.length === 0) return [];

  const { width: W, height: H } = overlay;
  const people = new Map(clip.session.people.map((p) => [p.id, p]));

  return frameAt(overlay, t).p.map((row) => {
    const [id, x1, y1, x2, y2] = row;
    const person = people.get(id);
    const sets = person?.sets ?? [];
    // Current set (with a little context either side), else the last one finished, else the upcoming one
    const set =
      sets.find((s) => t >= s.start_s - 1 && t <= s.end_s + 1) ??
      [...sets].reverse().find((s) => s.end_s < t) ??
      sets[0];

    const skeleton: PoseSkeleton = {};
    COCO_KEYPOINTS.forEach((name, k) => {
      const kx = row[5 + 2 * k];
      const ky = row[6 + 2 * k];
      if (kx >= 0 && ky >= 0) skeleton[name] = { x: kx / W, y: ky / H, score: 1 };
    });

    return {
      person_id: personId(id),
      bbox: { x: x1 / W, y: y1 / H, w: (x2 - x1) / W, h: (y2 - y1) / H },
      confidence: 0.9,
      exercise_name: set ? exerciseName(set) : 'No sets detected',
      exercise_id: set ? exerciseId(set) : 'none',
      current_reps: sets.reduce((n, s) => n + s.rep_times_s.filter((rt) => rt <= t).length, 0),
      current_phase: set && t >= set.start_s - 1 && t <= set.end_s + 1 ? phaseAt(set, t) : 'idle',
      primary_angle: primaryAngle(skeleton, set?.exercise),
      skeleton,
    };
  });
}

export function getDemoPersonTrack(scenarioId: string, pid: string): PersonTrack | undefined {
  const overlay = overlayCache.get(scenarioId);
  if (!overlay) return undefined;
  const { width: W, height: H } = overlay;
  const bbox_timeline: PersonTrack['bbox_timeline'] = [];
  for (const frame of overlay.frames) {
    const row = frame.p.find((r) => personId(r[0]) === pid);
    if (row) {
      const [, x1, y1, x2, y2] = row;
      bbox_timeline.push({ t: frame.t, x: x1 / W, y: y1 / H, w: (x2 - x1) / W, h: (y2 - y1) / H });
    }
  }
  return { person_id: pid, bbox_timeline };
}
