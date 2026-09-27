/**
 * Repswell - Automatic Gym Workout Tracker & Rep Counter
 * Base application connecting scenario selection, edge tracking, live biomechanical rep counter,
 * and post-session workout analytics.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Cpu,
  Dumbbell,
  Eye,
  Layers,
  Maximize,
  Minimize,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { CONFIG } from './config';
import { SCENARIOS } from './mocks/scenarios';
import { ScenarioMetadata, WorkoutSummary as WorkoutSummaryType } from './types/schema';
import { getTrackingProvider } from './services/tracking';
import { summaryService } from './services/summary';
import { ScenarioPicker } from './components/ScenarioPicker';
import { PersonPicker } from './components/PersonPicker';
import { VideoOverlay } from './components/VideoOverlay';
import { RepCounterBadge } from './components/RepCounterBadge';
import { WorkoutSummary } from './components/WorkoutSummary';
import { HowItWorks } from './components/HowItWorks';

export default function App() {
  const [scenarios] = useState<ScenarioMetadata[]>(SCENARIOS);
  const [currentScenarioId, setCurrentScenarioId] = useState<string>(SCENARIOS[0].id);
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    SCENARIOS[0].persons[0].person_id
  );

  // Playback & simulation state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);

  // View state: 'tracking' | 'summary'
  const [currentView, setCurrentView] = useState<'tracking' | 'summary'>('tracking');
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);
  const [useMockData, setUseMockData] = useState<boolean>(CONFIG.USE_MOCK_DATA);

  const scenario = scenarios.find((s) => s.id === currentScenarioId) || scenarios[0];
  const duration = scenario.duration_s;

  const trackingProvider = getTrackingProvider();
  const detections = trackingProvider.getDetectionsAtTime(scenario.id, currentTime);
  const selectedDetection =
    detections.find((d) => d.person_id === selectedPersonId) || detections[0];
  const selectedPerson =
    scenario.persons.find((p) => p.person_id === selectedPersonId) || scenario.persons[0];

  // Map of active reps across all people for person picker badges
  const activeReps = detections.reduce((acc, d) => {
    acc[d.person_id] = d.current_reps;
    return acc;
  }, {} as Record<string, number>);

  // Reset timestamps when scenario changes
  const handleSelectScenario = (scenarioId: string) => {
    setCurrentScenarioId(scenarioId);
    const newScenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
    setSelectedPersonId(newScenario.persons[0].person_id);
    setCurrentTime(0);
    setIsPlaying(false);
    setCurrentView('tracking');
    setCustomVideoUrl(null);
  };

  // Custom Video File Upload
  const handleCustomVideoLoaded = (file: File) => {
    const url = URL.createObjectURL(file);
    setCustomVideoUrl(url);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Simulation playback loop
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const updateSimulation = useCallback(() => {
    const now = performance.now();
    const deltaSeconds = ((now - lastTimeRef.current) / 1000) * playbackSpeed;
    lastTimeRef.current = now;

    setCurrentTime((prev) => {
      const next = prev + deltaSeconds;
      if (next >= duration) {
        setIsPlaying(false);
        // Prompt or transition to summary when workout video completes
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

  // Keyboard shortcut listener (Space to play/pause, R to reset)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'KeyR') {
        setCurrentTime(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleEndSession = () => {
    setIsPlaying(false);
    setCurrentView('summary');
  };

  // Compile current workout summary
  const currentSummary: WorkoutSummaryType = summaryService.getScenarioSummary(
    scenario.id,
    selectedPersonId,
    Math.max(currentTime, 1)
  );
  // Override with live counted reps if session was ended midway
  if (selectedDetection) {
    const primarySession = currentSummary.sessions.find(
      (s) => s.exercise_id === selectedDetection.exercise_id
    );
    if (primarySession) {
      primarySession.rep_count = selectedDetection.current_reps;
      currentSummary.total_reps = selectedDetection.current_reps;
      currentSummary.total_duration_s = Math.max(1, Math.round(currentTime));
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* ========================================================================= */}
      {/* HEADER / NAVIGATION BAR                                                  */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-zinc-950/85 border-b border-zinc-800/80 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-400 text-zinc-950 shadow-md shadow-emerald-500/20">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-white uppercase">
                  Repswell
                </span>
                <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400 border border-emerald-500/30">
                  EDGE AI
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono hidden sm:block">
                CCTV-Powered Computer Vision Rep Counter
              </p>
            </div>
          </div>

          {/* Right Status Badges & Quick Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Edge Processor Pill */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>RPi 5 TPU: 31ms</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Mock Flag Toggle */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono">
              <span className="text-zinc-400">DATA:</span>
              <button
                onClick={() => setUseMockData(!useMockData)}
                className={`font-bold uppercase px-1.5 py-0.5 rounded transition-colors ${
                  useMockData
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
                title="Toggle between mock datasets and real provider stub"
              >
                {useMockData ? 'Mock JSON' : 'Live Vision'}
              </button>
            </div>

            {/* View Switcher: Live Tracking vs Workout Summary */}
            <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
              <button
                onClick={() => setCurrentView('tracking')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                  currentView === 'tracking'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Live View</span>
              </button>
              <button
                onClick={() => setCurrentView('summary')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                  currentView === 'summary'
                    ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Summary</span>
              </button>
            </div>

            {/* Projector Mode button */}
            <button
              onClick={() => setIsProjectorMode(!isProjectorMode)}
              title="Projector Mode (Big numbers for demo presentations)"
              className={`p-2 rounded-xl border transition-colors ${
                isProjectorMode
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
              }`}
            >
              {isProjectorMode ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {currentView === 'tracking' ? (
          <>
            {/* Top Selection Row: Scenario (Camera) Picker & Person Picker */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7">
                <ScenarioPicker
                  scenarios={scenarios}
                  selectedScenarioId={currentScenarioId}
                  onSelectScenario={handleSelectScenario}
                  onCustomVideoLoaded={handleCustomVideoLoaded}
                />
              </div>
              <div className="lg:col-span-5">
                <PersonPicker
                  persons={scenario.persons}
                  selectedPersonId={selectedPersonId}
                  onSelectPerson={(pid) => setSelectedPersonId(pid)}
                  activeReps={activeReps}
                />
              </div>
            </div>

            {/* Centerpiece: Projector-Optimized Rep Counter Card */}
            <RepCounterBadge
              repCount={selectedDetection?.current_reps ?? 0}
              exerciseName={selectedDetection?.exercise_name ?? selectedPerson.current_exercise}
              phase={selectedDetection?.current_phase ?? 'idle'}
              jointAngle={selectedDetection?.primary_angle}
              accentColor={selectedPerson.accent_color}
              isProjectorMode={isProjectorMode}
            />

            {/* Live Video with Tactical Canvas Overlay */}
            <VideoOverlay
              scenario={scenario}
              selectedPersonId={selectedPersonId}
              detections={detections}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onSeek={handleSeek}
              onReset={handleReset}
              onEndSession={handleEndSession}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={(s) => setPlaybackSpeed(s)}
              customVideoUrl={customVideoUrl}
            />

            {/* "How It Works" Section */}
            <HowItWorks />
          </>
        ) : (
          /* WORKOUT SUMMARY VIEW */
          <WorkoutSummary
            summary={currentSummary}
            anonymousTag={selectedPerson.anonymous_tag}
            onRestart={handleReset}
            onBackToLive={() => setCurrentView('tracking')}
          />
        )}
      </main>

      {/* ========================================================================= */}
      {/* FOOTER                                                                    */}
      {/* ========================================================================= */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-4 px-6 text-center text-xs text-zinc-400 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Repswell • Hackathon Prototype (React + TS + Tailwind)</span>
          <span className="text-zinc-400">
            Edge: RPi 5 + Camera Vision • V1 Rep Counter
          </span>
        </div>
      </footer>
    </div>
  );
}
