import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, X, Check, ArrowLeft } from 'lucide-react';
import {
  DetectionSnapshot,
  PersonInfo,
  PoseSkeleton,
  ScenarioMetadata,
  WorkoutSummary as WorkoutSummaryType,
} from '../types/schema';
import { videoSourceService } from '../services/videoSource';

interface ReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: ScenarioMetadata[];
  currentScenarioId: string;
  onSelectScenario: (id: string) => void;
  selectedPersonId: string;
  onSelectPerson: (id: string) => void;
  detections: DetectionSnapshot[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onReset: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  onApplySessionToSummary: (summary: WorkoutSummaryType) => void;
}

export const ReplayModal: React.FC<ReplayModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  currentScenarioId,
  onSelectScenario,
  selectedPersonId,
  onSelectPerson,
  detections,
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  onReset,
  playbackSpeed,
  onChangeSpeed,
  onApplySessionToSummary,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scenario = scenarios.find((s) => s.id === currentScenarioId) || scenarios[0];
  const selectedDetection = detections.find((d) => d.person_id === selectedPersonId) || detections[0];
  const selectedPerson = scenario.persons.find((p) => p.person_id === selectedPersonId) || scenario.persons[0];

  const [hasFinished, setHasFinished] = useState(false);

  useEffect(() => {
    if (currentTime >= duration && duration > 0) {
      setHasFinished(true);
    } else {
      setHasFinished(false);
    }
  }, [currentTime, duration]);

  // Clean minimal canvas renderer (dark background ONLY inside the canvas)
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Render underlying gym simulation or background
    videoSourceService.renderSimulatedCCTVFrame(ctx, w, h, scenario.id, currentTime);

    // Minimal overlay: thin white/green lines only
    detections.forEach((det) => {
      const isSelected = det.person_id === selectedPersonId;
      const bx = det.bbox.x * w;
      const by = det.bbox.y * h;
      const bw = det.bbox.w * w;
      const bh = det.bbox.h * h;

      if (isSelected) {
        // Thin green bounding box
        ctx.strokeStyle = '#34C759';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        // Minimal person tag
        ctx.fillStyle = 'rgba(29, 29, 31, 0.85)';
        const tagText = `${det.exercise_name} &bull; ${det.current_reps} reps`;
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        const tw = ctx.measureText(tagText).width;
        ctx.fillRect(bx, by - 22, tw + 14, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(tagText, bx + 7, by - 8);
      } else {
        // Subtle outline for secondary person
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
      }

      // Minimal skeleton: thin clean white/green lines
      if (det.skeleton && isSelected) {
        const s = det.skeleton;
        const bones: [keyof PoseSkeleton, keyof PoseSkeleton][] = [
          ['left_shoulder', 'right_shoulder'],
          ['left_shoulder', 'left_hip'],
          ['right_shoulder', 'right_hip'],
          ['left_hip', 'right_hip'],
          ['left_shoulder', 'left_elbow'],
          ['left_elbow', 'left_wrist'],
          ['right_shoulder', 'right_elbow'],
          ['right_elbow', 'right_wrist'],
          ['left_hip', 'left_knee'],
          ['left_knee', 'left_ankle'],
          ['right_hip', 'right_knee'],
          ['right_knee', 'right_ankle'],
        ];

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.75;

        bones.forEach(([jointA, jointB]) => {
          const ptA = s[jointA];
          const ptB = s[jointB];
          if (ptA && ptB) {
            ctx.beginPath();
            ctx.moveTo(ptA.x * w, ptA.y * h);
            ctx.lineTo(ptB.x * w, ptB.y * h);
            ctx.stroke();
          }
        });

        // Small circular joints
        Object.values(s).forEach((pt) => {
          if (!pt) return;
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#34C759';
          ctx.fill();
        });
      }
    });
  }, [scenario, selectedPersonId, detections, currentTime]);

  useEffect(() => {
    let animId: number;
    const render = () => {
      drawFrame();
      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [drawFrame]);

  if (!isOpen) return null;

  const handleFinishAndApply = () => {
    const summary: WorkoutSummaryType = {
      person_id: selectedPersonId,
      total_duration_s: Math.max(1, Math.round(currentTime)),
      total_reps: selectedDetection?.current_reps || 8,
      sessions: [
        {
          person_id: selectedPersonId,
          exercise_id: selectedDetection?.exercise_id || 'exercise',
          exercise_name: selectedDetection?.exercise_name || selectedPerson.current_exercise,
          start_time: 0,
          end_time: Math.max(1, Math.round(currentTime)),
          rep_count: selectedDetection?.current_reps || 8,
          rep_timestamps: [3.5, 6.4, 9.6, 12.8, 16.0, 19.3, 22.5, 25.8],
        },
      ],
    };
    onApplySessionToSummary(summary);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto animate-in fade-in duration-200">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#1D1D1F] hover:text-black cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Done</span>
          </button>
          <span className="text-sm font-semibold text-[#1D1D1F]">
            Session replay
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#6E6E73] hover:text-[#1D1D1F] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Area (Dark background ONLY inside this video container) */}
        <div className="w-full aspect-video rounded-[24px] overflow-hidden bg-black relative shadow-lg">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="w-full h-full object-contain pointer-events-none select-none"
          />

          {/* Minimal Live Indicator inside video */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
            <span>{scenario.title}</span>
          </div>
        </div>

        {/* Scrubber Bar */}
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-[#6E6E73] font-medium w-8 text-right">
            {Math.floor(currentTime)}s
          </span>
          <input
            type="range"
            min={0}
            max={duration || 30}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#E5E5EA] rounded-full appearance-none cursor-pointer accent-[#34C759] focus:outline-none"
          />
          <span className="text-xs text-[#6E6E73] font-medium w-8">
            {Math.floor(duration || 30)}s
          </span>
        </div>

        {/* Hero Rep Counter & Controls Section */}
        <div className="bg-[#F5F5F7] rounded-[24px] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Big Number & Exercise */}
          <div className="flex items-baseline gap-4">
            <span className="text-6xl sm:text-7xl font-extrabold tracking-tight text-[#34C759]">
              {selectedDetection?.current_reps ?? 0}
            </span>
            <div>
              <p className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wide">
                Live reps counted
              </p>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
                {selectedDetection?.exercise_name ?? selectedPerson.current_exercise}
              </h2>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={onTogglePlay}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-sm font-medium transition-transform duration-150 active:scale-95 cursor-pointer shadow-sm"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              onClick={onReset}
              className="p-2.5 rounded-full bg-white hover:bg-[#E8E8ED] text-[#1D1D1F] transition-colors cursor-pointer"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed Pills */}
            <div className="flex items-center p-1 bg-white rounded-full">
              {[1, 2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onChangeSpeed(spd)}
                  className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                    playbackSpeed === spd
                      ? 'bg-[#1D1D1F] text-white'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  {spd}&times;
                </button>
              ))}
            </div>

            {/* View Summary Button */}
            <button
              onClick={handleFinishAndApply}
              className="px-4 py-2.5 rounded-full bg-[#34C759] hover:bg-[#2FB34F] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              View summary
            </button>
          </div>
        </div>

        {/* Clean Pill Selectors: Camera & Person */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Camera Selector */}
          <div className="bg-[#F5F5F7] rounded-[24px] p-5 flex flex-col gap-3">
            <span className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wide">
              Camera view
            </span>
            <div className="flex flex-wrap gap-2">
              {scenarios.map((sc) => {
                const isSelected = sc.id === currentScenarioId;
                return (
                  <button
                    key={sc.id}
                    onClick={() => onSelectScenario(sc.id)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1D1D1F] text-white shadow-xs'
                        : 'bg-white text-[#1D1D1F] hover:bg-[#E8E8ED]'
                    }`}
                  >
                    {sc.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Person Selector */}
          <div className="bg-[#F5F5F7] rounded-[24px] p-5 flex flex-col gap-3">
            <span className="text-xs font-semibold text-[#6E6E73] uppercase tracking-wide">
              Tracked person
            </span>
            <div className="flex flex-wrap gap-2">
              {scenario.persons.map((p) => {
                const isSelected = p.person_id === selectedPersonId;
                return (
                  <button
                    key={p.person_id}
                    onClick={() => onSelectPerson(p.person_id)}
                    className={`px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1D1D1F] text-white shadow-xs'
                        : 'bg-white text-[#1D1D1F] hover:bg-[#E8E8ED]'
                    }`}
                  >
                    {p.display_label} ({p.anonymous_tag})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footnote */}
        <p className="text-xs text-[#86868B] text-center pt-4 pb-8">
          Demo footage recorded on a phone. In production, Repswell runs on the gym's existing cameras with a Raspberry Pi edge device.
        </p>
      </div>
    </div>
  );
};
