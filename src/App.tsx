/**
 * Repswell - Gym Member Experience
 * Apple-style light design for gym members to view auto-logged workouts, weekly plan,
 * muscle recovery readiness, volume progress, and live session replay.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, TabId } from './components/Navigation';
import { TodayTab } from './components/TodayTab';
import { PlanTab } from './components/PlanTab';
import { RecoveryTab } from './components/RecoveryTab';
import { ProgressTab } from './components/ProgressTab';
import { WorkoutsTab } from './components/WorkoutsTab';
import { ReplayModal } from './components/ReplayModal';
import { MOCK_SESSIONS, SCENARIOS } from './mocks/scenarios';
import { PAST_WORKOUTS } from './mocks/memberData';
import { PastWorkout, ScenarioMetadata, TrainingPlan, WorkoutSummary } from './types/schema';
import { getTrackingProvider } from './services/tracking';
import { summaryService } from './services/summary';
import { loadTrainingPlan, saveTrainingPlan } from './services/planService';
import { DEMO_SCENARIOS, getDemoSessions, isDemoScenario, loadDemoOverlay } from './services/demoData';
import { CONFIG } from './config';

const INITIAL_SCENARIOS =
  CONFIG.USE_DEMO_DATA && DEMO_SCENARIOS.length > 0 ? DEMO_SCENARIOS : SCENARIOS;

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('today');
  const [isReplayOpen, setIsReplayOpen] = useState<boolean>(false);

  // Training Plan state (persisted with localStorage)
  const [plan, setPlan] = useState<TrainingPlan>(() => loadTrainingPlan());

  // Scenarios and Tracking
  const [scenarios] = useState<ScenarioMetadata[]>(INITIAL_SCENARIOS);
  const [currentScenarioId, setCurrentScenarioId] = useState<string>(INITIAL_SCENARIOS[0].id);
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    INITIAL_SCENARIOS[0].persons[0]?.person_id ?? ''
  );

  // Real clips: the <video> in the replay is the playback clock, so skeletons stay in sync with it
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Bumped when a scenario's skeleton overlay finishes loading, to redraw while paused
  const [, setOverlayVersion] = useState(0);

  // Playback & simulation state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Dynamic latest workout for Today tab
  const [latestWorkout, setLatestWorkout] = useState<PastWorkout>(PAST_WORKOUTS[0]);
  const [aiRecap, setAiRecap] = useState<string>('');

  const scenario = scenarios.find((s) => s.id === currentScenarioId) || scenarios[0];
  const duration = scenario.duration_s;

  const trackingProvider = getTrackingProvider();
  const detections = trackingProvider.getDetectionsAtTime(scenario.id, currentTime);
  const sessions = isDemoScenario(scenario.id)
    ? getDemoSessions(scenario.id)
    : MOCK_SESSIONS[scenario.id] ?? [];

  useEffect(() => {
    if (!isDemoScenario(currentScenarioId)) return;
    let cancelled = false;
    loadDemoOverlay(currentScenarioId).then(() => {
      if (!cancelled) setOverlayVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [currentScenarioId]);

  // Handle plan update
  const handleUpdatePlan = (updatedPlan: TrainingPlan) => {
    setPlan(updatedPlan);
    saveTrainingPlan(updatedPlan);
  };

  // Handle scenario switch
  const handleSelectScenario = (scenarioId: string) => {
    setCurrentScenarioId(scenarioId);
    const newScenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
    setSelectedPersonId(newScenario.persons[0]?.person_id ?? '');
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Simulation playback loop
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const updateSimulation = useCallback(() => {
    const now = performance.now();
    const deltaSeconds = ((now - lastTimeRef.current) / 1000) * playbackSpeed;
    lastTimeRef.current = now;

    const video = videoRef.current;
    const videoClock = video && video.src && !video.error && video.readyState >= 2;

    setCurrentTime((prev) => {
      const next = videoClock ? video.currentTime : prev + deltaSeconds;
      if (next >= duration || (videoClock && video.ended)) {
        setIsPlaying(false);
        return duration;
      }
      return next;
    });

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updateSimulation);
    }
  }, [isPlaying, duration, playbackSpeed]);

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(updateSimulation);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, updateSimulation]);

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  // When session completes or user taps "View summary" in Replay View:
  const handleApplySessionToSummary = (summary: WorkoutSummary) => {
    const primarySession = summary.sessions[0];
    const updatedWorkout: PastWorkout = {
      ...latestWorkout,
      total_reps: summary.total_reps,
      duration_minutes: Math.max(1, Math.round(summary.total_duration_s / 60) || 1),
      display_date: 'Today, Just now',
      exercises: [
        {
          name: primarySession?.exercise_name || 'Barbell back squat',
          exercise_id: primarySession?.exercise_id || 'squat',
          sets: 1,
          reps_per_set: [summary.total_reps],
          total_reps: summary.total_reps,
        },
        ...latestWorkout.exercises.slice(1),
      ],
    };

    setLatestWorkout(updatedWorkout);

    // Generate fresh smart recap
    summaryService.generateRecap(summary).then((text) => {
      setAiRecap(text);
    });

    setCurrentTab('today');
  };

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F] flex flex-col font-sans selection:bg-[#34C759]/20 selection:text-[#1D1D1F]">
      {/* Navigation Top Bar & Mobile Bottom Bar */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenReplay={() => setIsReplayOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-6 py-8">
        {currentTab === 'today' && (
          <TodayTab
            latestWorkout={latestWorkout}
            plan={plan}
            onWatchReplay={() => setIsReplayOpen(true)}
            onNavigateToPlan={() => setCurrentTab('plan')}
            aiRecap={aiRecap}
          />
        )}

        {currentTab === 'plan' && (
          <PlanTab
            plan={plan}
            onUpdatePlan={handleUpdatePlan}
          />
        )}

        {currentTab === 'recovery' && (
          <RecoveryTab plan={plan} />
        )}

        {currentTab === 'progress' && (
          <ProgressTab />
        )}

        {currentTab === 'workouts' && (
          <WorkoutsTab />
        )}
      </main>

      {/* Replay View Modal */}
      <ReplayModal
        isOpen={isReplayOpen}
        onClose={() => setIsReplayOpen(false)}
        scenarios={scenarios}
        currentScenarioId={currentScenarioId}
        onSelectScenario={handleSelectScenario}
        selectedPersonId={selectedPersonId}
        onSelectPerson={(pid) => setSelectedPersonId(pid)}
        detections={detections}
        sessions={sessions}
        videoRef={videoRef}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onReset={handleReset}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={(spd) => setPlaybackSpeed(spd)}
        onApplySessionToSummary={handleApplySessionToSummary}
      />
    </div>
  );
}
