import React from 'react';
import { Volume2, Scissors, Copy, Trash2, ArrowRightLeft, Layers } from 'lucide-react';
import { AudioClipModel, CrossfadeCurveType } from '../../types';

interface ClipPropertiesPanelProps {
  selectedClip: AudioClipModel | null;
  onUpdateClip: (updated: Partial<AudioClipModel>) => void;
  onSplitClip: () => void;
  onDuplicateClip: () => void;
  onDeleteClip: () => void;
}

export const ClipPropertiesPanel: React.FC<ClipPropertiesPanelProps> = ({
  selectedClip,
  onUpdateClip,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip
}) => {
  if (!selectedClip) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0F0F10] text-[#8E9299] p-6 select-none">
        <div className="w-12 h-12 rounded-xl bg-[#1A1A1C] border border-[#2D2D2F] flex items-center justify-center mb-3">
          <Layers className="w-6 h-6 text-[#4FC3F7] opacity-60" />
        </div>
        <span className="text-xs font-semibold text-[#E0E0E0]">No Audio Clip Selected</span>
        <span className="text-[11px] text-[#8E9299] mt-1 font-mono">
          Click any audio block on the timeline to inspect non-destructive trim, gain, and crossfades.
        </span>
      </div>
    );
  }

  const crossfadeOptions: CrossfadeCurveType[] = ['Linear', 'Exponential', 'EqualPower'];

  return (
    <div className="h-full p-3 bg-[#0F0F10] text-[#E0E0E0] overflow-y-auto select-none flex gap-3">
      {/* Bento Card 1: Clip Coordinates & Identity */}
      <div className="flex-1 bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-4 flex flex-col justify-between shadow-lg">
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-[#2D2D2F] mb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={selectedClip.name}
                onChange={(e) => onUpdateClip({ name: e.target.value })}
                className="bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] font-bold text-xs text-white px-2 py-1 rounded outline-none"
              />
              <span className="text-[9px] font-mono text-[#8E9299] uppercase">
                Clip Parameters
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#4FC3F7] font-bold bg-[#4FC3F7]/10 px-2 py-0.5 rounded border border-[#4FC3F7]/30">
              ID: {selectedClip.id.slice(0, 8)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div className="bg-[#121214] p-2.5 rounded-lg border border-[#2D2D2F]">
              <span className="text-[9px] text-[#8E9299] uppercase font-bold block mb-1">
                Timeline Start
              </span>
              <span className="font-mono text-sm font-bold text-[#E0E0E0]">
                {selectedClip.timelineStart.toFixed(3)}s
              </span>
            </div>

            <div className="bg-[#121214] p-2.5 rounded-lg border border-[#2D2D2F]">
              <span className="text-[9px] text-[#8E9299] uppercase font-bold block mb-1">
                Duration
              </span>
              <span className="font-mono text-sm font-bold text-[#E0E0E0]">
                {selectedClip.clipDuration.toFixed(3)}s
              </span>
            </div>

            <div className="bg-[#121214] p-2.5 rounded-lg border border-[#2D2D2F]">
              <span className="text-[9px] text-[#8E9299] uppercase font-bold block mb-1">
                Source Offset
              </span>
              <span className="font-mono text-sm font-bold text-[#E0E0E0]">
                {selectedClip.clipOffset.toFixed(3)}s
              </span>
            </div>
          </div>
        </div>

        {/* Quick Edit Actions in Bento Style */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#2D2D2F]">
          <button
            onClick={onSplitClip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] border border-[#2D2D2F] text-[#F27D26] rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Split at Playhead (S)</span>
          </button>

          <button
            onClick={onDuplicateClip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] border border-[#2D2D2F] text-[#E0E0E0] rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>

          <button
            onClick={onDeleteClip}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121214] hover:bg-[#FF4444]/20 border border-[#2D2D2F] hover:border-[#FF4444]/40 text-[#FF4444] rounded text-xs font-semibold transition-colors ml-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Bento Card 2: Gain & Fades */}
      <div className="w-80 bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-4 flex flex-col justify-between shadow-lg">
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-[#2D2D2F] mb-3">
            <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
              Gain &amp; Ramps
            </h3>
            <Volume2 className="w-4 h-4 text-[#4FC3F7]" />
          </div>

          {/* Clip Gain Slider */}
          <div className="bg-[#121214] p-2.5 rounded-lg border border-[#2D2D2F] mb-2.5">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[9px] uppercase font-bold text-[#8E9299]">Clip Gain</span>
              <span className="font-mono font-bold text-[#4FC3F7]">
                {selectedClip.gainDb > 0 ? `+${selectedClip.gainDb.toFixed(1)}` : `${selectedClip.gainDb.toFixed(1)}`} dB
              </span>
            </div>
            <input
              type="range"
              min="-24"
              max="12"
              step="0.5"
              value={selectedClip.gainDb}
              onChange={(e) => onUpdateClip({ gainDb: parseFloat(e.target.value) })}
              className="w-full h-1.5 accent-[#4FC3F7] bg-[#2D2D2F] rounded cursor-pointer"
            />
          </div>

          {/* Fade In & Out */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F]">
              <span className="text-[9px] uppercase font-bold text-[#8E9299] block mb-1">Fade In</span>
              <input
                type="range"
                min="0"
                max={Math.max(0.5, selectedClip.clipDuration / 2)}
                step="0.05"
                value={selectedClip.fadeInDuration}
                onChange={(e) => onUpdateClip({ fadeInDuration: parseFloat(e.target.value) })}
                className="w-full h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded"
              />
              <span className="text-[9px] font-mono text-[#8E9299] block text-right mt-1">
                {selectedClip.fadeInDuration.toFixed(2)}s
              </span>
            </div>

            <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F]">
              <span className="text-[9px] uppercase font-bold text-[#8E9299] block mb-1">Fade Out</span>
              <input
                type="range"
                min="0"
                max={Math.max(0.5, selectedClip.clipDuration / 2)}
                step="0.05"
                value={selectedClip.fadeOutDuration}
                onChange={(e) => onUpdateClip({ fadeOutDuration: parseFloat(e.target.value) })}
                className="w-full h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded"
              />
              <span className="text-[9px] font-mono text-[#8E9299] block text-right mt-1">
                {selectedClip.fadeOutDuration.toFixed(2)}s
              </span>
            </div>
          </div>
        </div>

        {/* Crossfade Law */}
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[9px] uppercase font-bold text-[#8E9299]">Crossfade Law</span>
            <ArrowRightLeft className="w-3 h-3 text-[#4F4F51]" />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {crossfadeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => onUpdateClip({ crossfadeType: opt })}
                className={`py-1 text-[10px] font-semibold rounded border transition-colors cursor-pointer ${
                  selectedClip.crossfadeType === opt
                    ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] border-[#4FC3F7]/40'
                    : 'bg-[#121214] text-[#8E9299] border-[#2D2D2F] hover:bg-[#2D2D2F]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
