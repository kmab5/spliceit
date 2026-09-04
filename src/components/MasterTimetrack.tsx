import React, { useRef, useMemo, useState } from 'react';
import { Volume2, VolumeX, Radio, Plus, X, Check, Edit2 } from 'lucide-react';
import { AudioTrackModel, MasterSection } from '../types';
import { generateUniqueId } from '../utils/idGenerator';

interface MasterTimetrackProps {
  tracks: AudioTrackModel[];
  totalDuration: number;
  currentTime: number;
  zoom: number;
  onScrubTime: (time: number) => void;
  masterVolumeDb: number;
  onUpdateMasterVolume: (db: number) => void;
  isMasterMuted: boolean;
  onToggleMasterMute: () => void;
  headerWidth: number;
  isHeaderVisible: boolean;
  masterSections: MasterSection[];
  onUpdateSections: (sections: MasterSection[]) => void;
  /** Records an undo step; used for add/delete/rename and on drag mouse-up. */
  onCommitSections?: (sections: MasterSection[]) => void;
  snapToGrid?: boolean;
  gridSnapSize?: number;
}

export const MasterTimetrack: React.FC<MasterTimetrackProps> = ({
  tracks,
  totalDuration,
  currentTime,
  zoom,
  onScrubTime,
  masterVolumeDb,
  onUpdateMasterVolume,
  isMasterMuted,
  onToggleMasterMute,
  headerWidth,
  isHeaderVisible,
  masterSections,
  onUpdateSections,
  onCommitSections,
  snapToGrid = true,
  gridSnapSize = 0.25
}) => {
  const laneRef = useRef<HTMLDivElement>(null);
  const latestSectionsRef = useRef<MasterSection[] | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const snapStep = gridSnapSize > 0 ? gridSnapSize : 0.25;

  // Width parity with ArrangementView / TimelineRuler.
  const widthPx = Math.max(800, totalDuration * zoom);

  /** Structural section changes should land in the undo stack. */
  const commitSections = (sections: MasterSection[]) =>
    (onCommitSections ?? onUpdateSections)(sections);

  // Compute composite master peaks by summing all active track clips
  const compositePeaks = useMemo(() => {
    const numBins = Math.max(200, Math.floor(totalDuration * 25));
    const peaks = new Float32Array(numBins);
    const soloExists = tracks.some((t) => t.isSoloed);

    tracks.forEach((track) => {
      if (track.isMuted) return;
      if (soloExists && !track.isSoloed) return;

      const trackLinearVol = Math.pow(10, track.volumeDb / 20);

      track.clips.forEach((clip) => {
        if (!clip.peaks || clip.peaks.length === 0) return;
        const clipLinearVol = Math.pow(10, clip.gainDb / 20);
        const combinedGain = trackLinearVol * clipLinearVol;

        const clipStartSec = clip.timelineStart;
        const clipDurSec = clip.clipDuration;
        const clipEndSec = clipStartSec + clipDurSec;

        const startBin = Math.max(0, Math.floor((clipStartSec / totalDuration) * numBins));
        const endBin = Math.min(numBins, Math.ceil((clipEndSec / totalDuration) * numBins));

        const totalSourceDur = clip.sourceDuration || (clip.clipOffset + clip.clipDuration);
        const startRatio = totalSourceDur > 0 ? clip.clipOffset / totalSourceDur : 0;
        const endRatio = totalSourceDur > 0 ? (clip.clipOffset + clip.clipDuration) / totalSourceDur : 1;

        for (let bin = startBin; bin < endBin; bin++) {
          const binProgress = (bin - startBin) / Math.max(1, endBin - startBin);
          const sourceProgress = startRatio + binProgress * (endRatio - startRatio);
          const peakIdx = Math.min(
            clip.peaks.length - 1,
            Math.max(0, Math.floor(sourceProgress * clip.peaks.length))
          );
          const rawPeak = clip.peaks[peakIdx] || 0.15;
          peaks[bin] = Math.min(1.0, peaks[bin] + rawPeak * combinedGain);
        }
      });
    });

    return peaks;
  }, [tracks, totalDuration]);

  // Click on Master Lane to scrub playhead
  const handleLaneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-section-control]')) return;
    if (!laneRef.current) return;
    const rect = laneRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    let targetTime = Math.max(0, Math.min(totalDuration, clickX / zoom));
    if (snapToGrid) {
      targetTime = Math.round(targetTime / snapStep) * snapStep;
    }
    onScrubTime(targetTime);
  };

  // Add new section
  const handleAddSection = (e: React.MouseEvent) => {
    e.stopPropagation();
    const colors = ['#4FC3F7', '#00FFA3', '#F27D26', '#BD00FF', '#FFD600', '#FF4081', '#00E5FF'];
    let start = currentTime;
    if (start >= totalDuration - 1) start = 0;
    const end = Math.min(totalDuration, start + 4.0);

    const newSec: MasterSection = {
      id: generateUniqueId('sec'),
      name: `Section ${masterSections.length + 1}`,
      startTime: Math.round(start * 10) / 10,
      endTime: Math.round(end * 10) / 10,
      color: colors[masterSections.length % colors.length]
    };
    commitSections([...masterSections, newSec]);
  };

  // Delete section
  const handleDeleteSection = (secId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    commitSections(masterSections.filter((s) => s.id !== secId));
  };

  // Start rename
  const handleStartRename = (sec: MasterSection, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSectionId(sec.id);
    setEditingName(sec.name);
  };

  const handleSaveRename = (secId: string, e?: React.FormEvent | React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingName.trim()) {
      setEditingSectionId(null);
      return;
    }
    commitSections(
      masterSections.map((s) => (s.id === secId ? { ...s, name: editingName.trim() } : s))
    );
    setEditingSectionId(null);
  };

  // Drag handles for section boundaries
  const handleSectionDrag = (
    e: React.MouseEvent,
    sec: MasterSection,
    type: 'move' | 'left' | 'right'
  ) => {
    e.stopPropagation();
    const startX = e.clientX;
    const initialStart = sec.startTime;
    const initialEnd = sec.endTime;
    const duration = initialEnd - initialStart;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let timeDelta = deltaX / zoom;
      if (snapToGrid) {
        timeDelta = Math.round(timeDelta / snapStep) * snapStep;
      }

      let updatedStart = initialStart;
      let updatedEnd = initialEnd;

      if (type === 'move') {
        updatedStart = Math.max(0, initialStart + timeDelta);
        if (updatedStart + duration > totalDuration) {
          updatedStart = totalDuration - duration;
        }
        updatedEnd = updatedStart + duration;
      } else if (type === 'left') {
        updatedStart = Math.max(0, Math.min(initialEnd - 0.5, initialStart + timeDelta));
      } else if (type === 'right') {
        updatedEnd = Math.min(totalDuration, Math.max(initialStart + 0.5, initialEnd + timeDelta));
      }

      const nextSections = masterSections.map((s) =>
        s.id === sec.id
          ? { ...s, startTime: Math.round(updatedStart * 100) / 100, endTime: Math.round(updatedEnd * 100) / 100 }
          : s
      );
      latestSectionsRef.current = nextSections;
      onUpdateSections(nextSections);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      // One undo entry for the whole gesture rather than one per mousemove.
      if (latestSectionsRef.current) {
        commitSections(latestSectionsRef.current);
        latestSectionsRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex border-b border-[#2D2D2F] bg-[#161618] select-none shrink-0 z-10">
      {/* Left Master Bus Header (Aligned with track headers) */}
      {isHeaderVisible && (
        <div
          style={{ width: `${headerWidth}px` }}
          className="h-16 bg-[#161618] border-r border-[#2D2D2F] px-3 py-1.5 flex flex-col justify-between shrink-0 z-20 shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#4FC3F7] shadow-[0_0_8px_#4FC3F7]"></span>
              <span className="text-[11px] font-bold text-white tracking-wide truncate">
                MASTER BUS
              </span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#4FC3F7]/15 text-[#4FC3F7] border border-[#4FC3F7]/30 hidden sm:inline">
                STEREO
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleAddSection}
                title="Add Master Section Marker"
                className="p-1 rounded text-[9px] font-bold bg-[#4FC3F7]/10 hover:bg-[#4FC3F7]/25 text-[#4FC3F7] border border-[#4FC3F7]/30 flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
                <span className="hidden xl:inline">SECTION</span>
              </button>

              <button
                onClick={onToggleMasterMute}
                title={isMasterMuted ? 'Unmute Master' : 'Mute Master'}
                className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                  isMasterMuted
                    ? 'bg-[#FF4444] text-white'
                    : 'bg-[#121214] text-[#8E9299] hover:text-white border border-[#2D2D2F]'
                }`}
              >
                {isMasterMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Master Volume Trim Slider */}
          <div className="flex items-center gap-2 mt-0.5">
            <input
              type="range"
              min="-24"
              max="6"
              step="0.5"
              value={masterVolumeDb}
              onChange={(e) => onUpdateMasterVolume(parseFloat(e.target.value))}
              className="flex-1 h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded cursor-pointer"
            />
            <span className="font-mono text-[10px] text-[#E0E0E0] w-10 text-right font-semibold">
              {masterVolumeDb > 0 ? `+${masterVolumeDb.toFixed(1)}` : `${masterVolumeDb.toFixed(1)}`} dB
            </span>
          </div>
        </div>
      )}

      {/* Master Timeline Lane */}
      <div
        ref={laneRef}
        onClick={handleLaneClick}
        style={{ width: `${widthPx}px` }}
        className="h-16 bg-[#121214]/90 relative cursor-pointer group hover:bg-[#121214] transition-colors overflow-hidden"
      >
        {/* Subtle Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-15">
          {Array.from({ length: Math.ceil(totalDuration) }).map((_, sec) => (
            <div
              key={sec}
              style={{ left: `${sec * zoom}px` }}
              className="absolute top-0 bottom-0 w-px bg-white/40"
            />
          ))}
        </div>

        {/* Master Composite Waveform */}
        <div className="absolute inset-x-0 bottom-0 h-10 flex items-center px-0.5 pointer-events-none">
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox={`0 0 ${compositePeaks.length} 40`}
          >
            <defs>
              <linearGradient id="masterWaveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4FC3F7" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#29B6F6" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#0288D1" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {Array.from(compositePeaks).map((peak: number, idx: number) => {
              const h = Math.max(2, peak * 36);
              return (
                <rect
                  key={idx}
                  x={idx}
                  y={20 - h / 2}
                  width="0.8"
                  height={h}
                  fill="url(#masterWaveGrad)"
                />
              );
            })}
          </svg>
        </div>

        {/* Interactive Master Section Markers */}
        <div className="absolute top-1 inset-x-0 h-5 pointer-events-none z-10">
          {masterSections.map((sec) => {
            const left = sec.startTime * zoom;
            const width = Math.max(48, (sec.endTime - sec.startTime) * zoom);
            const isEditing = editingSectionId === sec.id;

            return (
              <div
                key={sec.id}
                data-section-control="true"
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  borderColor: sec.color,
                  backgroundColor: `${sec.color}20`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onScrubTime(sec.startTime);
                }}
                className="absolute top-0 h-5 rounded border-t-2 border-l border-r border-b-0 flex items-center justify-between px-1.5 pointer-events-auto cursor-grab active:cursor-grabbing group/sec shadow-sm transition-all"
                title={`${sec.name} (${sec.startTime.toFixed(1)}s - ${sec.endTime.toFixed(1)}s) - Click to seek, drag to move`}
                onMouseDown={(e) => handleSectionDrag(e, sec, 'move')}
              >
                {/* Left Trim Handle */}
                <div
                  onMouseDown={(e) => handleSectionDrag(e, sec, 'left')}
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40 rounded-l"
                  title="Drag start point"
                />

                {/* Section Title / Inline Rename */}
                {isEditing ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 z-30"
                  >
                    <input
                      type="text"
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(sec.id);
                        if (e.key === 'Escape') setEditingSectionId(null);
                      }}
                      className="h-4 px-1 text-[9px] bg-black border border-white/60 text-white rounded outline-none font-bold w-20"
                    />
                    <button
                      onClick={(e) => handleSaveRename(sec.id, e)}
                      className="p-0.5 text-white hover:text-[#00FF00] cursor-pointer"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDoubleClick={(e) => handleStartRename(sec, e)}
                    className="flex items-center gap-1 min-w-0 truncate"
                  >
                    <span
                      style={{ color: sec.color }}
                      className="text-[9px] font-mono font-bold truncate select-none"
                    >
                      {sec.name}
                    </span>
                    <span className="text-[7px] font-mono text-white/50 hidden md:inline">
                      {sec.startTime.toFixed(1)}s
                    </span>
                  </div>
                )}

                {/* Edit & Delete Action Buttons on Hover */}
                {!isEditing && (
                  <div className="flex items-center gap-1 opacity-0 group-hover/sec:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartRename(sec, e)}
                      title="Rename section"
                      className="p-0.5 rounded text-white/70 hover:text-white hover:bg-black/40 cursor-pointer"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSection(sec.id, e)}
                      title="Delete section"
                      className="p-0.5 rounded text-white/70 hover:text-[#FF4444] hover:bg-black/40 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}

                {/* Right Trim Handle */}
                <div
                  onMouseDown={(e) => handleSectionDrag(e, sec, 'right')}
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/40 rounded-r"
                  title="Drag end point"
                />
              </div>
            );
          })}
        </div>

        {/* Master Lane Hover Indicator */}
        <div className="absolute right-3 bottom-1 pointer-events-none text-[9px] font-mono text-[#4FC3F7] opacity-60 flex items-center gap-1">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>COMPOSITE BUS • -14 LUFS TARGET</span>
        </div>
      </div>
    </div>
  );
};
