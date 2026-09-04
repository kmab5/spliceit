import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Plus, UploadCloud, ChevronLeft, ChevronRight } from 'lucide-react';
import { AudioTrackModel, AudioClipModel, MasterSection, LoopRegion } from '../types';
import { TrackHeader } from './TrackHeader';
import { TimelineRuler } from './TimelineRuler';
import { AudioClipItem } from './AudioClipItem';
import { MasterTimetrack } from './MasterTimetrack';
import { TimelineContextMenu, ContextMenuState } from './TimelineContextMenu';
import { findNextAvailableSlot } from '../utils/clipCollision';
import { generateUniqueId } from '../utils/idGenerator';

interface ArrangementViewProps {
  tracks: AudioTrackModel[];
  onUpdateTrack: (trackIndex: number, updated: Partial<AudioTrackModel>) => void;
  onDeleteTrack: (trackIndex: number) => void;
  onAddTrack: () => void;
  onInsertTrack?: (track: AudioTrackModel, insertAfterIndex?: number) => void;
  onMoveTrackUp: (trackIndex: number) => void;
  onMoveTrackDown: (trackIndex: number) => void;
  selectedClipId: string | null;
  onSelectClip: (clip: AudioClipModel) => void;
  onUpdateClip: (trackIndex: number, clipId: string, updated: Partial<AudioClipModel>) => void;
  /** Fired once on mouse-up after a drag/trim so the gesture becomes one undo step. */
  onCommitClipEdit?: () => void;
  onAddClipToTrack?: (trackIndex: number, clip: AudioClipModel) => void;
  onDeleteClip?: (trackIndex: number, clipId: string) => void;
  onSplitClipAtPlayhead?: () => void;
  currentTime: number;
  totalDuration: number;
  zoom: number;
  onZoomChange?: (newZoom: number) => void;
  onScrubTime: (time: number) => void;
  isLooping: boolean;
  loopRegion?: LoopRegion;
  onUpdateLoopRegion?: (region: LoopRegion) => void;
  snapToGrid: boolean;
  gridSnapSize: number;
  onImportAudioFile: (file: File) => void;
  isHeaderVisible: boolean;
  onToggleHeaderVisible: () => void;
  headerWidth: number;
  onResizeHeaderWidth: (width: number) => void;
  masterVolumeDb: number;
  onUpdateMasterVolume: (db: number) => void;
  isMasterMuted: boolean;
  onToggleMasterMute: () => void;
  masterSections: MasterSection[];
  /** Live/transient section updates during a drag — not recorded in history. */
  onUpdateSections: (sections: MasterSection[]) => void;
  /** Section change that should become an undo step. */
  onCommitSections?: (sections: MasterSection[]) => void;
  onOpenMediaPool?: () => void;
  onInsertClipToTrack?: (fileId: string, trackIndex: number, startTime?: number) => void;
}

export const ArrangementView: React.FC<ArrangementViewProps> = ({
  tracks,
  onUpdateTrack,
  onDeleteTrack,
  onAddTrack,
  onInsertTrack,
  onMoveTrackUp,
  onMoveTrackDown,
  selectedClipId,
  onSelectClip,
  onUpdateClip,
  onCommitClipEdit,
  onAddClipToTrack,
  onDeleteClip,
  onSplitClipAtPlayhead,
  currentTime,
  totalDuration,
  zoom,
  onZoomChange,
  onScrubTime,
  isLooping,
  loopRegion = { startTime: 0, endTime: 8 },
  onUpdateLoopRegion,
  snapToGrid,
  gridSnapSize,
  onImportAudioFile,
  isHeaderVisible,
  onToggleHeaderVisible,
  headerWidth,
  onResizeHeaderWidth,
  masterVolumeDb,
  onUpdateMasterVolume,
  isMasterMuted,
  onToggleMasterMute,
  masterSections,
  onUpdateSections,
  onCommitSections,
  onOpenMediaPool,
  onInsertClipToTrack
}) => {
  const fileDropRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trackListRef = useRef<HTMLDivElement>(null);
  const collapsedTrackListRef = useRef<HTMLDivElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copiedTrack, setCopiedTrack] = useState<AudioTrackModel | null>(null);
  const [copiedClip, setCopiedClip] = useState<AudioClipModel | null>(null);

  // Playhead dragging state
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Dynamic width based on zoom level, allowing full horizontal zoom out
  const widthPx = Math.max(800, totalDuration * zoom);

  // Synchronized vertical scrolling between track headers and timeline edit area
  const isSyncingScrollRef = useRef(false);

  const handleEditAreaScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    const top = containerRef.current?.scrollTop || 0;
    if (trackListRef.current) trackListRef.current.scrollTop = top;
    if (collapsedTrackListRef.current) collapsedTrackListRef.current.scrollTop = top;
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const handleTrackListScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    const top = trackListRef.current?.scrollTop || 0;
    if (containerRef.current) containerRef.current.scrollTop = top;
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const handleCollapsedTrackListScroll = () => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    const top = collapsedTrackListRef.current?.scrollTop || 0;
    if (containerRef.current) containerRef.current.scrollTop = top;
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  // Re-sync scroll whenever header visibility toggles
  useEffect(() => {
    const top = containerRef.current?.scrollTop || 0;
    if (trackListRef.current) trackListRef.current.scrollTop = top;
    if (collapsedTrackListRef.current) collapsedTrackListRef.current.scrollTop = top;
  }, [isHeaderVisible]);

  // Resize drag handler for Left Track Headers column
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(headerWidth);

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = headerWidth;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(140, Math.min(380, startWidthRef.current + deltaX));
      onResizeHeaderWidth(newWidth);
    },
    [isResizing, onResizeHeaderWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Draggable Playhead Needle Body Movement
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);

    const startX = e.clientX;
    const initialTime = currentTime;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newTime = Math.max(0, Math.min(totalDuration, initialTime + deltaX / zoom));
      if (snapToGrid) {
        newTime = Math.round(newTime / gridSnapSize) * gridSnapSize;
      }
      onScrubTime(newTime);
    };

    const onMouseUp = () => {
      setIsDraggingPlayhead(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'ew-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Drag and drop audio files into arrangement
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('audio/') || /\.(wav|mp3|flac|aac|ogg)$/i.test(file.name)) {
          onImportAudioFile(file);
        }
      }
    }
  };

  // Handle dropping an audio pool file onto a specific track lane
  const handleLaneDrop = (e: React.DragEvent, trackIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData('application/json');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.fileId && onInsertClipToTrack) {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const dropTime = Math.max(0, clickX / zoom);
          onInsertClipToTrack(parsed.fileId, trackIdx, dropTime);
          return;
        }
      } catch (err) {}
    }

    // Direct audio file dropped onto lane
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        onImportAudioFile(e.dataTransfer.files[i]);
      }
    }
  };

  // Wheel zoom handling with Ctrl/Alt/Meta
  const handleWheel = (e: React.WheelEvent) => {
    if ((e.ctrlKey || e.altKey || e.metaKey) && onZoomChange) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.max(15, Math.min(250, Math.round(zoom * zoomFactor)));
      onZoomChange(newZoom);
    }
  };

  // Keyboard Shortcuts (Copy/Paste/Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedClipId) {
          for (let i = 0; i < tracks.length; i++) {
            const found = tracks[i].clips.find((c) => c.id === selectedClipId);
            if (found) {
              setCopiedClip(JSON.parse(JSON.stringify(found)));
              break;
            }
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedClip && tracks.length > 0) {
          // Paste clip onto target track at current playhead time
          const targetTrackIdx = copiedClip.trackIndex < tracks.length ? copiedClip.trackIndex : 0;
          handlePasteClip(targetTrackIdx, currentTime);
        } else if (copiedTrack) {
          handlePasteTrack();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId && onDeleteClip) {
          for (let i = 0; i < tracks.length; i++) {
            const found = tracks[i].clips.find((c) => c.id === selectedClipId);
            if (found) {
              onDeleteClip(i, selectedClipId);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, copiedClip, copiedTrack, tracks, currentTime, onDeleteClip]);

  // Context Menu Actions
  const handleCopyTrack = (track: AudioTrackModel) => {
    setCopiedTrack(JSON.parse(JSON.stringify(track)));
  };

  const handlePasteTrack = (insertAfterIndex?: number) => {
    if (!copiedTrack) return;
    const newTrack: AudioTrackModel = {
      ...copiedTrack,
      id: generateUniqueId('trk'),
      name: `${copiedTrack.name} (Copy)`,
      clips: copiedTrack.clips.map((c) => ({
        ...c,
        id: generateUniqueId('clip')
      }))
    };
    if (onInsertTrack) {
      onInsertTrack(newTrack, insertAfterIndex);
    } else {
      onAddTrack();
    }
  };

  const handleDuplicateTrack = (trackIndex: number) => {
    const source = tracks[trackIndex];
    if (!source) return;
    const newTrack: AudioTrackModel = {
      ...source,
      id: generateUniqueId('trk'),
      name: `${source.name} (Copy)`,
      clips: source.clips.map((c) => ({
        ...c,
        id: generateUniqueId('clip')
      }))
    };
    if (onInsertTrack) {
      onInsertTrack(newTrack, trackIndex);
    } else {
      onAddTrack();
    }
  };

  const handleCopyClip = (clip: AudioClipModel) => {
    setCopiedClip(JSON.parse(JSON.stringify(clip)));
  };

  const handleCutClip = (clip: AudioClipModel, trackIndex: number) => {
    setCopiedClip(JSON.parse(JSON.stringify(clip)));
    onDeleteClip?.(trackIndex, clip.id);
  };

  const handlePasteClip = (trackIndex: number, time: number) => {
    if (!copiedClip || !tracks[trackIndex]) return;
    const targetTrack = tracks[trackIndex];
    const dur = copiedClip.clipDuration;
    // Guaranteed non-overlapping placement
    const slot = findNextAvailableSlot(time, dur, targetTrack.clips);
    const newClip: AudioClipModel = {
      ...copiedClip,
      id: generateUniqueId('clip'),
      trackIndex,
      timelineStart: slot
    };
    onAddClipToTrack?.(trackIndex, newClip);
  };

  const handleDuplicateClip = (clip: AudioClipModel, trackIndex: number) => {
    const targetTrack = tracks[trackIndex];
    if (!targetTrack) return;
    const slot = findNextAvailableSlot(
      clip.timelineStart + clip.clipDuration,
      clip.clipDuration,
      targetTrack.clips
    );
    const newClip: AudioClipModel = {
      ...clip,
      id: generateUniqueId('clip'),
      timelineStart: slot
    };
    onAddClipToTrack?.(trackIndex, newClip);
  };

  return (
    <div
      ref={fileDropRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 flex overflow-hidden bg-[#141416] relative select-none"
    >
      {/* 1. LEFT COLUMN: Track Headers & Add Track (Collapsible & Resizable) */}
      {isHeaderVisible && (
        <div
          style={{ width: `${headerWidth}px` }}
          className="bg-[#1A1A1C] border-r border-[#2D2D2F] flex flex-col shrink-0 z-20 shadow-lg relative transition-all"
        >
          {/* Header spacer aligned with ruler (h-7 = 28px) */}
          <div className="h-7 bg-[#121214] border-b border-[#2D2D2F] px-2.5 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-mono uppercase font-bold text-[#8E9299]">
              TRACKS ({tracks.length})
            </span>
            <div className="flex items-center gap-1">
              <button
                id="btn-add-track"
                onClick={onAddTrack}
                title="Add Audio Track"
                className="flex items-center gap-1 text-[10px] font-semibold text-[#4FC3F7] hover:text-white transition-colors cursor-pointer bg-[#4FC3F7]/10 hover:bg-[#4FC3F7]/20 border border-[#4FC3F7]/30 px-1.5 py-0.5 rounded"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
              <button
                onClick={onToggleHeaderVisible}
                title="Collapse Track Headers"
                className="p-0.5 text-[#8E9299] hover:text-white rounded hover:bg-[#2D2D2F] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Master spacer header aligned with MasterTimetrack (h-16 = 64px) */}
          <div className="h-16 bg-[#161618] border-b border-[#2D2D2F] px-3 py-2 flex flex-col justify-between shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#4FC3F7] shadow-[0_0_8px_#4FC3F7]"></span>
                <span className="text-[11px] font-bold text-white tracking-wide truncate">
                  MASTER BUS
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#4FC3F7]/15 text-[#4FC3F7] border border-[#4FC3F7]/30">
                STEREO
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-[#8E9299]">
              <span>OUT 1-2</span>
              <span className="text-[#00FFA3] font-bold">-14 LUFS TARGET</span>
            </div>
          </div>

          {/* Track Headers List - Synced with edit area vertical scroll */}
          <div
            ref={trackListRef}
            onScroll={handleTrackListScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none"
          >
            {tracks.map((track, idx) => (
              <TrackHeader
                key={track.id}
                track={track}
                trackIndex={idx}
                onUpdateTrack={(updated) => onUpdateTrack(idx, updated)}
                onDeleteTrack={() => onDeleteTrack(idx)}
                onMoveTrackUp={() => onMoveTrackUp(idx)}
                onMoveTrackDown={() => onMoveTrackDown(idx)}
                canMoveUp={idx > 0}
                canMoveDown={idx < tracks.length - 1}
                onJumpToTrackStart={() => {
                  if (track.clips.length > 0) {
                    const minStart = Math.min(...track.clips.map((c) => c.timelineStart));
                    onScrubTime(minStart);
                  }
                }}
                onJumpToTrackEnd={() => {
                  if (track.clips.length > 0) {
                    const maxEnd = Math.max(
                      ...track.clips.map((c) => c.timelineStart + c.clipDuration)
                    );
                    onScrubTime(maxEnd);
                  }
                }}
              />
            ))}

            {/* Quick Import / Add Layer Card */}
            <div className="p-2 flex flex-col gap-1.5">
              <button
                onClick={onAddTrack}
                className="w-full py-2 border border-dashed border-[#2D2D2F] hover:border-[#4FC3F7]/60 rounded-lg flex items-center justify-center gap-1.5 text-xs text-[#8E9299] hover:text-[#4FC3F7] bg-[#121214] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Track Layer</span>
              </button>

              <label className="p-2 border border-dashed border-[#2D2D2F] hover:border-[#4FC3F7]/50 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors bg-[#121214]">
                <UploadCloud className="w-4 h-4 text-[#4FC3F7]" />
                <span className="text-[10px] font-semibold text-[#E0E0E0]">Import Audio File</span>
                <span className="text-[8px] text-[#8E9299] font-mono">WAV, MP3, FLAC, OGG</span>
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.flac,.aac,.ogg"
                  onChange={(e) => {
                    if (e.target.files?.[0]) onImportAudioFile(e.target.files[0]);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Draggable Vertical Resize Handle */}
          <div
            onMouseDown={handleMouseDownResize}
            title="Drag to resize track headers width"
            className="absolute top-0 right-0 w-1.5 bottom-0 cursor-col-resize hover:bg-[#4FC3F7] transition-colors z-30 flex items-center justify-center group"
          >
            <div className="w-0.5 h-6 bg-[#2D2D2F] group-hover:bg-[#4FC3F7] rounded-full" />
          </div>
        </div>
      )}

      {/* 2. COLLAPSED TRACK TAB VIEW: Shows only track colors synced with edit area scroll */}
      {!isHeaderVisible && (
        <div className="w-10 bg-[#1A1A1C] border-r border-[#2D2D2F] flex flex-col shrink-0 z-20 shadow-lg relative transition-all select-none">
          {/* Expand Toggle Button aligned with ruler (h-7) */}
          <div className="h-7 bg-[#121214] border-b border-[#2D2D2F] flex items-center justify-center shrink-0">
            <button
              onClick={onToggleHeaderVisible}
              title="Expand Track Headers"
              className="p-1 rounded text-[#8E9299] hover:text-[#4FC3F7] hover:bg-[#2D2D2F] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Master Bus Pip aligned with MasterTimetrack (h-16) */}
          <div
            className="h-16 bg-[#161618] border-b border-[#2D2D2F] flex flex-col items-center justify-center shrink-0"
            title="Master Bus Output"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#4FC3F7] shadow-[0_0_8px_#4FC3F7]" />
            <span className="text-[8px] font-mono text-[#4FC3F7] font-bold mt-1">MST</span>
          </div>

          {/* Synced Collapsed Track Colors Strip */}
          <div
            ref={collapsedTrackListRef}
            onScroll={handleCollapsedTrackListScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none"
          >
            {tracks.map((track, idx) => (
              <div
                key={track.id}
                className="h-24 border-b border-[#2D2D2F] flex flex-col items-center justify-center relative group hover:bg-[#252528] transition-colors cursor-pointer"
                title={`Track ${idx + 1}: ${track.name} (${track.clips.length} clips)`}
                onClick={() => {
                  if (track.clips.length > 0) {
                    onScrubTime(track.clips[0].timelineStart);
                  }
                }}
              >
                {/* Vertical Glowing Colored Pill */}
                <div
                  style={{
                    backgroundColor: track.color || '#4FC3F7',
                    boxShadow: `0 0 10px ${track.color || '#4FC3F7'}60`
                  }}
                  className="w-2.5 h-12 rounded-full group-hover:w-3 transition-all"
                />

                {/* Track Number Badge */}
                <span className="text-[9px] font-mono font-bold text-[#8E9299] group-hover:text-white mt-1">
                  T{idx + 1}
                </span>

                {/* Status indicator dots */}
                {track.isMuted && (
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-[#FF4444] absolute top-1.5 right-1.5"
                    title="Muted"
                  />
                )}
                {track.isSoloed && (
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-[#FFAA00] absolute top-1.5 left-1.5"
                    title="Soloed"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RIGHT COLUMN: Sticky Master Audio Timeline + Scrollable Tracks Lanes */}
      <div
        ref={containerRef}
        onScroll={handleEditAreaScroll}
        onWheel={handleWheel}
        className="flex-1 flex flex-col overflow-x-auto overflow-y-auto relative"
      >
        {/* STICKY MAIN NAV TRACK: Ruler + Master Audio Timeline */}
        <div
          style={{ width: `${widthPx}px` }}
          className="sticky top-0 z-30 flex flex-col bg-[#161618] border-b border-[#2D2D2F] shrink-0 shadow-md"
        >
          {/* Timeline Ruler */}
          <TimelineRuler
            totalDuration={totalDuration}
            currentTime={currentTime}
            zoom={zoom}
            onScrubTime={onScrubTime}
            isLooping={isLooping}
            loopStart={loopRegion.startTime}
            loopEnd={loopRegion.endTime}
            onUpdateLoopRegion={onUpdateLoopRegion}
          />

          {/* Master Timetrack Overview with Sections */}
          <MasterTimetrack
            tracks={tracks}
            totalDuration={totalDuration}
            currentTime={currentTime}
            zoom={zoom}
            onScrubTime={onScrubTime}
            masterVolumeDb={masterVolumeDb}
            onUpdateMasterVolume={onUpdateMasterVolume}
            isMasterMuted={isMasterMuted}
            onToggleMasterMute={onToggleMasterMute}
            headerWidth={headerWidth}
            isHeaderVisible={false}
            masterSections={masterSections}
            onUpdateSections={onUpdateSections}
            onCommitSections={onCommitSections}
            snapToGrid={snapToGrid}
            gridSnapSize={gridSnapSize}
          />
        </div>

        {/* Tracks Canvas Container */}
        <div
          style={{ width: `${widthPx}px` }}
          className="relative flex-1 bg-[#141416]"
          onContextMenu={(e) => {
            // Context menu on empty arrangement area
            e.preventDefault();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const time = Math.max(0, clickX / zoom);
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              time
            });
          }}
        >
          {/* Subtle Vertical Beat Grid Lines */}
          <div className="absolute inset-0 pointer-events-none opacity-10">
            {Array.from({ length: Math.ceil(totalDuration) }).map((_, sec) => (
              <div
                key={sec}
                style={{ left: `${sec * zoom}px` }}
                className="absolute top-0 bottom-0 w-px bg-white"
              />
            ))}
          </div>

          {/* Track Lanes */}
          {tracks.map((track, trackIdx) => (
            <div
              key={track.id}
              style={{ width: `${widthPx}px` }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => handleLaneDrop(e, trackIdx)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const time = Math.max(0, clickX / zoom);
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  trackIndex: trackIdx,
                  time
                });
              }}
              className="h-24 border-b border-[#2D2D2F] relative bg-[#141416] hover:bg-[#1A1A1C]/50 transition-colors"
            >
              {/* Audio Clips on this track */}
              {track.clips.map((clip) => (
                <AudioClipItem
                  key={clip.id}
                  clip={clip}
                  trackColor={track.color}
                  zoom={zoom}
                  isSelected={clip.id === selectedClipId}
                  onSelect={() => onSelectClip(clip)}
                  onUpdateClip={(updated) => onUpdateClip(trackIdx, clip.id, updated)}
                  onCommitEdit={onCommitClipEdit}
                  snapToGrid={snapToGrid}
                  gridSnapSize={gridSnapSize}
                  trackClips={track.clips}
                  onContextMenu={(e, c) => {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      trackIndex: trackIdx,
                      clipId: c.id,
                      time: c.timelineStart
                    });
                  }}
                />
              ))}
            </div>
          ))}

          {/* Draggable Full-Height Bento Playhead Needle Body */}
          <div
            style={{ left: `${currentTime * zoom}px` }}
            onMouseDown={handlePlayheadMouseDown}
            className="absolute top-0 bottom-0 z-30 select-none group cursor-ew-resize"
          >
            {/* Extended interactive hit-area spanning the full height */}
            <div className="absolute top-0 bottom-0 -left-3 w-7 cursor-ew-resize flex flex-col items-center pointer-events-auto">
              {/* Top Handle Pip */}
              <div className="w-3.5 h-3.5 bg-[#FF4444] rounded-full -mt-1 shadow-[0_0_10px_#FF4444] group-hover:scale-125 transition-transform flex items-center justify-center shrink-0">
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>

              {/* Glowing needle body line */}
              <div
                className={`w-[1.5px] h-full bg-[#FF4444] shadow-[0_0_8px_#FF4444] group-hover:bg-[#FF6666] group-hover:w-[2.5px] transition-all ${
                  isDraggingPlayhead ? 'w-[2.5px] bg-[#FF8888] shadow-[0_0_12px_#FF4444]' : ''
                }`}
              />

              {/* Realtime Scrub Time Code floating badge */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 left-3 px-1.5 py-0.5 rounded bg-[#1A1A1C]/95 border border-[#FF4444]/60 text-[10px] font-mono text-[#FF8888] font-bold shadow-lg pointer-events-none whitespace-nowrap z-40">
                {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(2).padStart(5, '0')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Edit Area Custom Context Menu */}
      {contextMenu && (
        <TimelineContextMenu
          state={contextMenu}
          onClose={() => setContextMenu(null)}
          tracks={tracks}
          copiedTrack={copiedTrack}
          copiedClip={copiedClip}
          onCopyTrack={handleCopyTrack}
          onPasteTrack={handlePasteTrack}
          onDuplicateTrack={handleDuplicateTrack}
          onDeleteTrack={onDeleteTrack}
          onAddTrack={onAddTrack}
          onCopyClip={handleCopyClip}
          onCutClip={handleCutClip}
          onPasteClip={handlePasteClip}
          onDuplicateClip={handleDuplicateClip}
          onSplitClipAtPlayhead={() => onSplitClipAtPlayhead?.()}
          onDeleteClip={(clipId, trkIdx) => onDeleteClip?.(trkIdx, clipId)}
          onSetPlayheadHere={(t) => onScrubTime(t)}
          onOpenMediaPool={() => onOpenMediaPool?.()}
        />
      )}
    </div>
  );
};
