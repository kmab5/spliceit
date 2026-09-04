import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  Plus,
  Split,
  FolderOpen,
  Play,
  Layers,
  Sparkles
} from 'lucide-react';
import { AudioTrackModel, AudioClipModel } from '../types';

export interface ContextMenuState {
  x: number;
  y: number;
  trackIndex?: number;
  clipId?: string;
  time: number;
}

interface TimelineContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  tracks: AudioTrackModel[];
  copiedTrack: AudioTrackModel | null;
  copiedClip: AudioClipModel | null;
  onCopyTrack: (track: AudioTrackModel) => void;
  onPasteTrack: (insertAfterIndex?: number) => void;
  onDuplicateTrack: (trackIndex: number) => void;
  onDeleteTrack: (trackIndex: number) => void;
  onAddTrack: () => void;
  onCopyClip: (clip: AudioClipModel) => void;
  onCutClip: (clip: AudioClipModel, trackIndex: number) => void;
  onPasteClip: (trackIndex: number, time: number) => void;
  onDuplicateClip: (clip: AudioClipModel, trackIndex: number) => void;
  onSplitClipAtPlayhead: () => void;
  onDeleteClip: (clipId: string, trackIndex: number) => void;
  onSetPlayheadHere: (time: number) => void;
  onOpenMediaPool: () => void;
}

export const TimelineContextMenu: React.FC<TimelineContextMenuProps> = ({
  state,
  onClose,
  tracks,
  copiedTrack,
  copiedClip,
  onCopyTrack,
  onPasteTrack,
  onDuplicateTrack,
  onDeleteTrack,
  onAddTrack,
  onCopyClip,
  onCutClip,
  onPasteClip,
  onDuplicateClip,
  onSplitClipAtPlayhead,
  onDeleteClip,
  onSetPlayheadHere,
  onOpenMediaPool
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const { x, y, trackIndex, clipId, time } = state;
  const currentTrack = trackIndex !== undefined && tracks[trackIndex] ? tracks[trackIndex] : undefined;
  const currentClip = currentTrack && clipId ? currentTrack.clips.find((c) => c.id === clipId) : undefined;

  // Reposition if menu overflows screen bounds
  const adjustedX = Math.min(window.innerWidth - 240, Math.max(10, x));
  const adjustedY = Math.min(window.innerHeight - 340, Math.max(10, y));

  // Close on outside click or Esc
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-56 bg-[#161618]/95 backdrop-blur-md border border-[#2D2D2F] rounded-lg shadow-2xl py-1.5 text-xs text-[#E0E0E0] select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
    >
      {/* Header Info */}
      <div className="px-3 py-1 text-[10px] font-mono text-[#8E9299] border-b border-[#2D2D2F] flex items-center justify-between mb-1">
        <span>TIMELINE @ {time.toFixed(2)}s</span>
        {currentTrack && (
          <span className="font-bold truncate max-w-[90px]" style={{ color: currentTrack.color }}>
            {currentTrack.name}
          </span>
        )}
      </div>

      {/* Clip Actions (if clicked on a clip) */}
      {currentClip && trackIndex !== undefined && (
        <>
          <div className="px-3 py-0.5 text-[9px] font-mono uppercase text-[#4FC3F7] font-bold tracking-wider">
            Clip: {currentClip.name}
          </div>

          <button
            onClick={() => {
              onCopyClip(currentClip);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-[#4FC3F7]" />
              <span>Copy Clip</span>
            </div>
            <span className="text-[10px] font-mono text-[#8E9299]">Ctrl+C</span>
          </button>

          <button
            onClick={() => {
              onCutClip(currentClip, trackIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-[#FFAA00]" />
              <span>Cut Clip</span>
            </div>
            <span className="text-[10px] font-mono text-[#8E9299]">Ctrl+X</span>
          </button>

          <button
            onClick={() => {
              onDuplicateClip(currentClip, trackIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#00FFA3]" />
              <span>Duplicate Clip</span>
            </div>
          </button>

          <button
            onClick={() => {
              onSplitClipAtPlayhead();
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Split className="w-3.5 h-3.5 text-[#4FC3F7]" />
              <span>Split at Playhead</span>
            </div>
            <span className="text-[10px] font-mono text-[#8E9299]">S</span>
          </button>

          <button
            onClick={() => {
              onDeleteClip(currentClip.id, trackIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#FF4444]/20 text-[#FF6666] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-[#FF4444]" />
              <span>Delete Clip</span>
            </div>
            <span className="text-[10px] font-mono text-[#FF8888]">Del</span>
          </button>

          <div className="my-1 border-t border-[#2D2D2F]" />
        </>
      )}

      {/* Paste Clip option if clip in clipboard and clicked on track */}
      {copiedClip && trackIndex !== undefined && (
        <button
          onClick={() => {
            onPasteClip(trackIndex, time);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <Clipboard className="w-3.5 h-3.5 text-[#00FFA3]" />
            <span>Paste Clip Here</span>
          </div>
          <span className="text-[10px] font-mono text-[#8E9299]">Ctrl+V</span>
        </button>
      )}

      {/* Track Operations */}
      {currentTrack && trackIndex !== undefined && (
        <>
          <div className="px-3 py-0.5 text-[9px] font-mono uppercase text-[#8E9299] font-bold tracking-wider">
            Track: {currentTrack.name}
          </div>

          <button
            onClick={() => {
              onCopyTrack(currentTrack);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-[#4FC3F7]" />
              <span>Copy Track Layer</span>
            </div>
          </button>

          <button
            onClick={() => {
              onDuplicateTrack(trackIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#BD00FF]" />
              <span>Duplicate Track</span>
            </div>
          </button>

          <button
            onClick={() => {
              onDeleteTrack(trackIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#FF4444]/20 text-[#FF6666] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-[#FF4444]" />
              <span>Delete Track</span>
            </div>
          </button>

          <div className="my-1 border-t border-[#2D2D2F]" />
        </>
      )}

      {/* Paste Track option if track in clipboard */}
      {copiedTrack && (
        <button
          onClick={() => {
            onPasteTrack(trackIndex);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left font-semibold text-[#4FC3F7]"
        >
          <div className="flex items-center gap-2">
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste Track Layer</span>
          </div>
          <span className="text-[10px] font-mono text-[#8E9299]">"{copiedTrack.name}"</span>
        </button>
      )}

      {/* Global / Timeline Operations */}
      <button
        onClick={() => {
          onSetPlayheadHere(time);
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
      >
        <Play className="w-3.5 h-3.5 text-[#FF4444]" />
        <span>Move Playhead Here</span>
      </button>

      <button
        onClick={() => {
          onAddTrack();
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left"
      >
        <Plus className="w-3.5 h-3.5 text-[#4FC3F7]" />
        <span>Add Audio Track Layer</span>
      </button>

      <button
        onClick={() => {
          onOpenMediaPool();
          onClose();
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#4FC3F7]/15 hover:text-white transition-colors cursor-pointer text-left border-t border-[#2D2D2F] mt-1 pt-1.5 text-[#4FC3F7]"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        <span>Open Media Pool...</span>
      </button>
    </div>
  );
};
