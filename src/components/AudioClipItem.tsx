import React, { useRef, useEffect } from 'react';
import { AudioClipModel } from '../types';
import { getClipMovementBounds } from '../utils/clipCollision';

interface AudioClipItemProps {
  clip: AudioClipModel;
  trackColor: string;
  zoom: number; // px per second
  isSelected: boolean;
  onSelect: () => void;
  onUpdateClip: (updated: Partial<AudioClipModel>) => void;
  snapToGrid: boolean;
  gridSnapSize?: number;
  trackClips?: AudioClipModel[];
  onContextMenu?: (e: React.MouseEvent, clip: AudioClipModel) => void;
}

export const AudioClipItem: React.FC<AudioClipItemProps> = ({
  clip,
  trackColor,
  zoom,
  isSelected,
  onSelect,
  onUpdateClip,
  snapToGrid,
  gridSnapSize = 0.25,
  trackClips = [],
  onContextMenu
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leftPx = clip.timelineStart * zoom;
  const widthPx = Math.max(16, clip.clipDuration * zoom);

  // Normalize color to match Bento theme accents
  const accentColor = trackColor || '#4FC3F7';
  const snapStep = gridSnapSize > 0 ? gridSnapSize : 0.25;

  // Draw Waveform representation on Canvas slice corresponding to clipOffset & clipDuration
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const peaks = clip.peaks || generateMockPeaks(120);
    const midY = h / 2;

    // Calculate source time bounds
    const totalSourceDuration = clip.sourceDuration && clip.sourceDuration > 0
      ? clip.sourceDuration
      : Math.max(0.1, clip.clipOffset + clip.clipDuration);

    const startRatio = Math.max(0, Math.min(1, clip.clipOffset / totalSourceDuration));
    const endRatio = Math.max(startRatio + 0.001, Math.min(1, (clip.clipOffset + clip.clipDuration) / totalSourceDuration));

    // Number of visual bars based on width
    const numBars = Math.max(8, Math.floor(w / 3.5));
    const barWidth = Math.max(1, w / numBars);

    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.9;

    for (let i = 0; i < numBars; i++) {
      const x = i * barWidth;
      const progress = numBars > 1 ? i / (numBars - 1) : 0;
      const sourceProgress = startRatio + progress * (endRatio - startRatio);
      const peakIndex = Math.min(peaks.length - 1, Math.max(0, Math.floor(sourceProgress * peaks.length)));
      const peakVal = peaks[peakIndex] !== undefined ? peaks[peakIndex] : 0.2;
      const barHeight = Math.max(2, peakVal * (h * 0.85));
      ctx.fillRect(x, midY - barHeight / 2, Math.max(1, barWidth - 1), barHeight);
    }
  }, [clip.peaks, clip.clipOffset, clip.clipDuration, clip.sourceDuration, accentColor, widthPx]);

  // Handle Drag Move (Horizontal Position) with Strict Collision Avoidance
  const handleClipMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return;
    if (e.button === 2) return; // Right click handled by context menu
    e.stopPropagation();
    onSelect();

    const startX = e.clientX;
    const initialStart = clip.timelineStart;
    const initialDuration = clip.clipDuration;
    const { leftBound, rightBound } = getClipMovementBounds(clip.id, initialStart, initialDuration, trackClips);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newStart = initialStart + deltaX / zoom;
      if (snapToGrid) {
        newStart = Math.round(newStart / snapStep) * snapStep;
      }
      // Strictly prevent overlapping other clips on the same track
      const maxAllowedStart = Math.max(leftBound, rightBound - initialDuration);
      const clampedStart = Math.max(leftBound, Math.min(maxAllowedStart, newStart));
      onUpdateClip({ timelineStart: clampedStart });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Handle Left Trim with Collision Avoidance
  const handleLeftTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialStart = clip.timelineStart;
    const initialDuration = clip.clipDuration;
    const initialOffset = clip.clipOffset;
    const { leftBound } = getClipMovementBounds(clip.id, initialStart, initialDuration, trackClips);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let timeDelta = deltaX / zoom;
      if (snapToGrid) {
        timeDelta = Math.round(timeDelta / snapStep) * snapStep;
      }

      // Ensure left trim does not cross into preceding clip
      const newStart = Math.max(leftBound, Math.min(initialStart + initialDuration - 0.1, initialStart + timeDelta));
      const deltaApplied = newStart - initialStart;
      const newDuration = Math.max(0.1, initialDuration - deltaApplied);
      const newOffset = Math.max(0, initialOffset + deltaApplied);

      onUpdateClip({
        timelineStart: newStart,
        clipDuration: newDuration,
        clipOffset: newOffset
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Handle Right Trim with Collision Avoidance
  const handleRightTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialStart = clip.timelineStart;
    const initialDuration = clip.clipDuration;
    const { rightBound } = getClipMovementBounds(clip.id, initialStart, initialDuration, trackClips);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newDuration = initialDuration + deltaX / zoom;
      if (snapToGrid) {
        newDuration = Math.round(newDuration / snapStep) * snapStep;
      }
      // Ensure right trim does not cross into succeeding clip
      const maxDuration = Math.max(0.1, rightBound - initialStart);
      const clampedDuration = Math.max(0.1, Math.min(maxDuration, newDuration));
      onUpdateClip({ clipDuration: clampedDuration });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onClick={onSelect}
      onMouseDown={handleClipMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.(e, clip);
      }}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        borderColor: isSelected ? accentColor : `${accentColor}55`,
        backgroundColor: `${accentColor}12`
      }}
      className={`h-[72px] top-2 absolute rounded overflow-hidden select-none cursor-grab active:cursor-grabbing border transition-all ${
        isSelected
          ? 'shadow-[0_0_15px_rgba(79,195,247,0.3)] ring-1 ring-[#4FC3F7]'
          : 'hover:border-opacity-80'
      }`}
    >
      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={Math.min(1000, Math.max(64, Math.floor(widthPx)))}
        height={70}
        className="w-full h-full absolute top-0 left-0 pointer-events-none opacity-80"
      />

      {/* Bento Clip Header Label */}
      <div className="absolute top-1 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
        <span
          style={{ color: accentColor }}
          className="text-[9px] font-bold uppercase tracking-tight truncate opacity-90"
        >
          {clip.name}
        </span>
        <span className="text-[8px] font-mono text-[#8E9299] font-medium">
          {clip.gainDb > 0 ? `+${clip.gainDb.toFixed(1)}` : `${clip.gainDb.toFixed(1)}`} dB
        </span>
      </div>

      {/* Fade In & Out visual indicators */}
      {clip.fadeInDuration > 0 && (
        <div
          style={{ width: `${Math.min(widthPx / 2, clip.fadeInDuration * zoom)}px` }}
          className="absolute top-0 bottom-0 left-0 pointer-events-none border-t border-[#4FC3F7]/50 bg-gradient-to-r from-black/40 to-transparent"
        />
      )}

      {clip.fadeOutDuration > 0 && (
        <div
          style={{ width: `${Math.min(widthPx / 2, clip.fadeOutDuration * zoom)}px` }}
          className="absolute top-0 bottom-0 right-0 pointer-events-none border-t border-[#4FC3F7]/50 bg-gradient-to-l from-black/40 to-transparent"
        />
      )}

      {/* Left Trim Handle */}
      <div
        data-handle="left"
        onMouseDown={handleLeftTrimMouseDown}
        title="Drag to trim start"
        className="absolute top-0 bottom-0 left-0 w-2 hover:w-3 bg-white/0 hover:bg-[#4FC3F7]/60 cursor-ew-resize transition-all z-20"
      />

      {/* Right Trim Handle */}
      <div
        data-handle="right"
        onMouseDown={handleRightTrimMouseDown}
        title="Drag to trim end"
        className="absolute top-0 bottom-0 right-0 w-2 hover:w-3 bg-white/0 hover:bg-[#4FC3F7]/60 cursor-ew-resize transition-all z-20"
      />
    </div>
  );
};

function generateMockPeaks(count: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    peaks.push(0.1 + 0.8 * Math.abs(Math.sin(i * 0.25) * Math.cos(i * 0.1)));
  }
  return peaks;
}
