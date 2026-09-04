import React, { useState } from 'react';
import { Volume2, Trash2, Edit2, ChevronUp, ChevronDown, SkipBack, SkipForward } from 'lucide-react';
import { AudioTrackModel } from '../types';

interface TrackHeaderProps {
  track: AudioTrackModel;
  trackIndex: number;
  onUpdateTrack: (updated: Partial<AudioTrackModel>) => void;
  onDeleteTrack: () => void;
  onMoveTrackUp?: () => void;
  onMoveTrackDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onJumpToTrackStart?: () => void;
  onJumpToTrackEnd?: () => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  track,
  trackIndex,
  onUpdateTrack,
  onDeleteTrack,
  onMoveTrackUp,
  onMoveTrackDown,
  canMoveUp,
  canMoveDown,
  onJumpToTrackStart,
  onJumpToTrackEnd
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(track.name);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onUpdateTrack({ name: tempName.trim() });
    }
  };

  const formatPan = (val: number) => {
    if (Math.abs(val) < 0.05) return 'C';
    if (val < 0) return `L${Math.round(Math.abs(val) * 100)}`;
    return `R${Math.round(val * 100)}`;
  };

  return (
    <div className="h-24 bg-[#1A1A1C] border-b border-r border-[#2D2D2F] flex relative group select-none transition-colors">
      {/* Track Color Accent Bar & Reorder Handle */}
      <div className="flex flex-col items-center justify-between py-1 bg-[#121214] border-r border-[#2D2D2F]/50 w-5 shrink-0">
        <button
          disabled={!canMoveUp}
          onClick={onMoveTrackUp}
          title="Move Track Up"
          className="text-[#8E9299] hover:text-white disabled:opacity-20 disabled:hover:text-[#8E9299] p-0.5 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <div
          style={{ backgroundColor: track.color || '#4FC3F7' }}
          className="w-1.5 h-8 rounded-full shadow-[0_0_6px_rgba(79,195,247,0.3)]"
        />

        <button
          disabled={!canMoveDown}
          onClick={onMoveTrackDown}
          title="Move Track Down"
          className="text-[#8E9299] hover:text-white disabled:opacity-20 disabled:hover:text-[#8E9299] p-0.5 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 p-2 flex flex-col justify-between overflow-hidden">
        {/* Top Row: Track Name & Quick Actions */}
        <div className="flex items-center justify-between gap-1">
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="bg-[#121214] text-xs font-semibold text-white px-1.5 py-0.5 rounded border border-[#4FC3F7] outline-none w-28"
            />
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 cursor-pointer group/title truncate"
              title="Click to rename track"
            >
              <span className="text-xs font-semibold text-[#8E9299] uppercase tracking-tighter truncate hover:text-white">
                Track {String(trackIndex + 1).padStart(2, '0')} • {track.name}
              </span>
              <Edit2 className="w-2.5 h-2.5 text-[#4F4F51] opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </div>
          )}

          <div className="flex items-center gap-1">
            {/* Jump playhead to track start and track end */}
            <button
              onClick={onJumpToTrackStart}
              title="Jump playhead to track start"
              className="p-1 rounded text-[#8E9299] hover:text-[#4FC3F7] hover:bg-[#2D2D2F] transition-colors cursor-pointer"
            >
              <SkipBack className="w-3 h-3" />
            </button>
            <button
              onClick={onJumpToTrackEnd}
              title="Jump playhead to track end"
              className="p-1 rounded text-[#8E9299] hover:text-[#4FC3F7] hover:bg-[#2D2D2F] transition-colors cursor-pointer"
            >
              <SkipForward className="w-3 h-3" />
            </button>
            <button
              onClick={onDeleteTrack}
              title="Delete Track"
              className="text-[#4F4F51] hover:text-[#FF4444] p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Middle Row: Mute, Solo, and Pan in Bento aesthetic */}
        <div className="flex items-center gap-1.5">
          {/* Mute Button */}
          <button
            id={`btn-mute-track-${trackIndex}`}
            onClick={() => onUpdateTrack({ isMuted: !track.isMuted })}
            title="Mute Track"
            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
              track.isMuted
                ? 'bg-[#F27D26] text-[#0F0F10] shadow-[0_0_8px_rgba(242,125,38,0.4)]'
                : 'bg-[#2D2D2F] text-[#8E9299] hover:text-white'
            }`}
          >
            M
          </button>

          {/* Solo Button */}
          <button
            id={`btn-solo-track-${trackIndex}`}
            onClick={() => onUpdateTrack({ isSoloed: !track.isSoloed })}
            title="Solo Track"
            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
              track.isSoloed
                ? 'bg-[#FF4444] text-white shadow-[0_0_8px_#FF4444]'
                : 'bg-[#2D2D2F] text-[#FF4444]'
            }`}
          >
            S
          </button>

          {/* Pan Slider & Readout */}
          <div className="flex items-center gap-1 bg-[#121214] px-1.5 py-0.5 rounded border border-[#2D2D2F] ml-auto">
            <span className="text-[8px] font-mono text-[#4F4F51] font-bold">PAN</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={track.pan}
              onChange={(e) => onUpdateTrack({ pan: parseFloat(e.target.value) })}
              className="w-10 h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded cursor-pointer"
            />
            <span className="text-[8px] font-mono text-[#8E9299] w-5 text-right">
              {formatPan(track.pan)}
            </span>
          </div>
        </div>

        {/* Bottom Row: Volume Fader Slider & dB Readout */}
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-3 h-3 text-[#4F4F51]" />
          <input
            id={`slider-vol-track-${trackIndex}`}
            type="range"
            min="-36"
            max="6"
            step="0.5"
            value={track.volumeDb}
            onChange={(e) => onUpdateTrack({ volumeDb: parseFloat(e.target.value) })}
            className="flex-1 h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded cursor-pointer"
            title={`Volume: ${track.volumeDb > 0 ? '+' : ''}${track.volumeDb} dB`}
          />
          <span className="text-[9px] font-mono text-[#8E9299] font-medium w-12 text-right">
            {track.volumeDb > 0 ? `+${track.volumeDb.toFixed(1)}` : `${track.volumeDb.toFixed(1)}`} dB
          </span>
        </div>
      </div>
    </div>
  );
};
