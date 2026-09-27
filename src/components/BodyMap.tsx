import React, { useState } from 'react';
import Model, { IExerciseData, IMuscleStats, Muscle } from 'react-body-highlighter';
import { MuscleId } from '../types/schema';
import { MUSCLE_NAMES } from '../data/exerciseMuscles';

export interface BodyMapProps {
  /**
   * Values between 0.0 and 1.0 for intensity mode,
   * or recovery percent / status strings
   */
  values?: Partial<Record<MuscleId, number>>;
  /**
   * Explicit color override per muscle (e.g. for recovery mode: #34C759, #FFCC00, #FF9500)
   */
  colorMap?: Partial<Record<MuscleId, string>>;
  /**
   * Mode: 'intensity' (shades of Apple green) or 'recovery' (status colors)
   */
  mode?: 'intensity' | 'recovery';
  /**
   * Custom label or status subtitle generator
   */
  getTooltipText?: (muscleId: MuscleId) => string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Map Repswell MuscleIds to react-body-highlighter Muscle names
const MUSCLE_ID_TO_LIBRARY: Record<MuscleId, Muscle> = {
  chest: 'chest',
  front_delts: 'front-deltoids',
  rear_delts: 'back-deltoids',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  abs: 'abs',
  obliques: 'obliques',
  traps: 'trapezius',
  lats: 'upper-back', // mapped to upper-back per prompt
  lower_back: 'lower-back',
  glutes: 'gluteal',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  calves: 'calves',
};

// Reverse mapping from library Muscle string to Repswell MuscleId
const LIBRARY_TO_MUSCLE_ID: Record<string, MuscleId> = {
  chest: 'chest',
  'front-deltoids': 'front_delts',
  'back-deltoids': 'rear_delts',
  biceps: 'biceps',
  triceps: 'triceps',
  forearm: 'forearms',
  abs: 'abs',
  obliques: 'obliques',
  trapezius: 'traps',
  'upper-back': 'lats',
  'lower-back': 'lower_back',
  gluteal: 'glutes',
  quadriceps: 'quads',
  hamstring: 'hamstrings',
  calves: 'calves',
};

export const BodyMap: React.FC<BodyMapProps> = ({
  values = {},
  colorMap,
  mode = 'intensity',
  getTooltipText,
  size = 'md',
  className = '',
}) => {
  const [activeMuscle, setActiveMuscle] = useState<MuscleId | null>(null);

  // Height sizing for container and Model SVG
  const maxHeight = size === 'sm' ? 190 : size === 'lg' ? 320 : 250;

  // Colors per mode as specified
  const highlightedColors =
    mode === 'recovery'
      ? ['#34C759', '#FFCC00', '#FF9500'] // freq 1: ready, freq 2: recovering, freq 3: fatigued
      : ['#C7EFD1', '#7FD99A', '#34C759']; // freq 1: light, freq 2: medium, freq 3: high

  // Build the data array for react-body-highlighter
  const data: IExerciseData[] = [];

  const allMuscleIds: MuscleId[] = [
    'chest',
    'front_delts',
    'rear_delts',
    'biceps',
    'triceps',
    'forearms',
    'abs',
    'obliques',
    'traps',
    'lats',
    'lower_back',
    'glutes',
    'quads',
    'hamstrings',
    'calves',
  ];

  allMuscleIds.forEach((mId) => {
    const libMuscle = MUSCLE_ID_TO_LIBRARY[mId];
    if (!libMuscle) return;

    if (mode === 'recovery') {
      let freq = 1; // ready
      if (colorMap && colorMap[mId]) {
        const color = colorMap[mId];
        if (color === '#FF9500') freq = 3; // fatigued
        else if (color === '#FFCC00') freq = 2; // recovering
        else freq = 1; // ready
      } else {
        const val = values[mId] ?? 1.0;
        if (val < 0.45) freq = 3;
        else if (val < 0.85) freq = 2;
        else freq = 1;
      }

      data.push({
        name: MUSCLE_NAMES[mId],
        muscles: [libMuscle],
        frequency: freq,
      });
    } else {
      // Intensity mode: convert intensity 0..1 into frequency 1..3
      const intensity = values[mId] ?? 0;
      if (intensity > 0) {
        let freq = 1;
        if (intensity > 0.7) {
          freq = 3;
        } else if (intensity > 0.35) {
          freq = 2;
        } else {
          freq = 1;
        }

        data.push({
          name: MUSCLE_NAMES[mId],
          muscles: [libMuscle],
          frequency: freq,
        });
      }
    }
  });

  // Handle tap / click on muscle
  const handleMuscleClick = (stats: IMuscleStats) => {
    if (!stats || !stats.muscle) return;
    const mId = LIBRARY_TO_MUSCLE_ID[stats.muscle];
    if (mId) {
      setActiveMuscle(mId);
    }
  };

  // Get color for currently active tooltip dot
  const getActiveDotColor = (mId: MuscleId): string => {
    if (mode === 'recovery') {
      if (colorMap && colorMap[mId]) return colorMap[mId]!;
      const val = values[mId] ?? 1;
      if (val < 0.45) return '#FF9500';
      if (val < 0.85) return '#FFCC00';
      return '#34C759';
    } else {
      const val = values[mId] ?? 0;
      if (val > 0.7) return '#34C759';
      if (val > 0.35) return '#7FD99A';
      if (val > 0) return '#C7EFD1';
      return '#E5E5EA';
    }
  };

  return (
    <div className={`relative flex flex-col items-center select-none w-full ${className}`}>
      {/* Front and Back Model rendered side by side */}
      <div className="flex items-center justify-center gap-6 sm:gap-12 w-full">
        {/* Front Model View */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-medium text-[#86868B] mb-1">
            Front
          </span>
          <div
            className="flex items-center justify-center"
            style={{ height: `${maxHeight}px`, width: `${Math.round(maxHeight * 0.58)}px` }}
          >
            <Model
              type="anterior"
              data={data}
              bodyColor="#E5E5EA"
              highlightedColors={highlightedColors}
              onClick={handleMuscleClick}
              style={{
                background: 'transparent',
                border: 'none',
                height: '100%',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              svgStyle={{
                height: '100%',
                width: 'auto',
                maxHeight: `${maxHeight}px`,
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.04))',
              }}
            />
          </div>
        </div>

        {/* Back Model View */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-medium text-[#86868B] mb-1">
            Back
          </span>
          <div
            className="flex items-center justify-center"
            style={{ height: `${maxHeight}px`, width: `${Math.round(maxHeight * 0.58)}px` }}
          >
            <Model
              type="posterior"
              data={data}
              bodyColor="#E5E5EA"
              highlightedColors={highlightedColors}
              onClick={handleMuscleClick}
              style={{
                background: 'transparent',
                border: 'none',
                height: '100%',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              svgStyle={{
                height: '100%',
                width: 'auto',
                maxHeight: `${maxHeight}px`,
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.04))',
              }}
            />
          </div>
        </div>
      </div>

      {/* Floating Info Tooltip / Active Selection Pill */}
      {activeMuscle && (
        <div className="mt-3 px-3.5 py-1.5 rounded-full bg-white shadow-md border border-black/[0.06] text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: getActiveDotColor(activeMuscle) }}
          />
          <span className="font-semibold text-[#1D1D1F]">
            {MUSCLE_NAMES[activeMuscle]}
          </span>
          <span className="text-[#6E6E73]">
            {getTooltipText
              ? getTooltipText(activeMuscle)
              : mode === 'recovery'
              ? `${Math.round((values[activeMuscle] ?? 1) * 100)}% recovered`
              : `${Math.round((values[activeMuscle] ?? 0) * 100)}% volume`}
          </span>
        </div>
      )}
    </div>
  );
};
