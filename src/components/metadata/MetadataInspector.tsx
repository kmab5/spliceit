import React, { useRef } from 'react';
import { Image, Check } from 'lucide-react';
import { AudioMetadataTags } from '../../types';

interface MetadataInspectorProps {
  metadata: AudioMetadataTags;
  onUpdateMetadata: (updated: Partial<AudioMetadataTags>) => void;
  onApplyToMixdown: () => void;
}

export const MetadataInspector: React.FC<MetadataInspectorProps> = ({
  metadata,
  onUpdateMetadata,
  onApplyToMixdown
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onUpdateMetadata({
        coverArtDataUrl: dataUrl,
        coverArtMimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const removeCoverArt = () => {
    onUpdateMetadata({
      coverArtDataUrl: undefined,
      coverArtMimeType: undefined
    });
  };

  return (
    <div className="h-full p-3 bg-[#0F0F10] text-[#E0E0E0] overflow-y-auto select-none flex gap-3">
      {/* Bento Container Card */}
      <div className="flex-1 bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-4 flex flex-col justify-between shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
              Metadata Inspector (.siq / TagLibSharp)
            </h3>
            <span className="text-[9px] font-mono text-[#4FC3F7] font-semibold">
              ID3v1, ID3v2.4, VORBIS, MP4
            </span>
          </div>
          <button
            onClick={onApplyToMixdown}
            className="text-[9px] text-[#4FC3F7] hover:text-[#29B6F6] font-bold bg-[#4FC3F7]/10 hover:bg-[#4FC3F7]/20 border border-[#4FC3F7]/30 px-3 py-1 rounded transition-colors cursor-pointer flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            <span>BATCH APPLY</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Artwork + Title + Artist */}
          <div className="flex gap-3">
            {/* Embedded Album Art */}
            <div className="w-24 h-24 bg-[#121214] border border-[#2D2D2F] rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative group">
              {metadata.coverArtDataUrl ? (
                <>
                  <img
                    src={metadata.coverArtDataUrl}
                    alt="Album Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-1.5 py-0.5 bg-[#4FC3F7] text-black text-[9px] font-bold rounded"
                    >
                      Change
                    </button>
                    <button
                      onClick={removeCoverArt}
                      className="text-[8px] text-red-400 hover:text-red-300 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-2 text-center cursor-pointer group-hover:text-[#4FC3F7]"
                >
                  <Image className="w-6 h-6 text-[#4F4F51] group-hover:text-[#4FC3F7] transition-colors mb-1" />
                  <span className="text-[8px] text-[#8E9299] font-bold uppercase">Artwork</span>
                </div>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
            />

            {/* Title & Artist */}
            <div className="flex flex-col justify-between py-0.5 w-full">
              <div>
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Track Title</div>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                  className="w-full bg-[#121214] border border-[#2D2D2F] text-xs font-semibold px-2 py-1 rounded text-[#E0E0E0] focus:border-[#4FC3F7] outline-none"
                  placeholder="Track Title"
                />
              </div>
              <div>
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Artist</div>
                <input
                  type="text"
                  value={metadata.artist}
                  onChange={(e) => onUpdateMetadata({ artist: e.target.value })}
                  className="w-full bg-[#121214] border border-[#2D2D2F] text-xs font-semibold px-2 py-1 rounded text-[#E0E0E0] focus:border-[#4FC3F7] outline-none"
                  placeholder="Artist / Band"
                />
              </div>
            </div>
          </div>

          {/* Right: ISRC + Target Standard + Notes/Album */}
          <div className="flex flex-col justify-between py-0.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">ISRC Code</div>
                <input
                  type="text"
                  value={metadata.isrc}
                  onChange={(e) => onUpdateMetadata({ isrc: e.target.value })}
                  className="w-full bg-[#121214] border border-[#2D2D2F] text-xs font-mono px-2 py-1 rounded text-[#E0E0E0] focus:border-[#4FC3F7] outline-none"
                  placeholder="US-S1Q-26-00104"
                />
              </div>
              <div>
                <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Target Standard</div>
                <div className="text-xs font-mono py-1 text-[#4FC3F7] font-semibold">
                  TagLib# v2.3.0
                </div>
              </div>
            </div>

            <div>
              <div className="text-[9px] text-[#8E9299] uppercase font-bold mb-1">Broadcast / Album Notes</div>
              <input
                type="text"
                value={metadata.comment || `Mastered for broadcast (-14 LUFS) • Album: ${metadata.album}`}
                onChange={(e) => onUpdateMetadata({ comment: e.target.value })}
                className="w-full bg-[#121214] border border-[#2D2D2F] text-xs px-2 py-1 rounded text-[#8E9299] focus:text-[#E0E0E0] focus:border-[#4FC3F7] outline-none"
                placeholder="Broadcast metadata notes"
              />
            </div>
          </div>
        </div>

        {/* Bottom Details Row: BPM, Key, Year, Genre */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#2D2D2F] mt-2 text-xs">
          <div>
            <span className="text-[8px] text-[#8E9299] uppercase font-bold block mb-0.5">BPM</span>
            <input
              type="number"
              value={metadata.bpm}
              onChange={(e) => onUpdateMetadata({ bpm: parseFloat(e.target.value) || 120 })}
              className="w-full bg-[#121214] border border-[#2D2D2F] text-xs font-mono px-2 py-1 rounded text-[#E0E0E0] outline-none"
            />
          </div>
          <div>
            <span className="text-[8px] text-[#8E9299] uppercase font-bold block mb-0.5">Key</span>
            <input
              type="text"
              value={metadata.key}
              onChange={(e) => onUpdateMetadata({ key: e.target.value })}
              className="w-full bg-[#121214] border border-[#2D2D2F] text-xs font-mono px-2 py-1 rounded text-[#E0E0E0] outline-none"
            />
          </div>
          <div>
            <span className="text-[8px] text-[#8E9299] uppercase font-bold block mb-0.5">Genre</span>
            <input
              type="text"
              value={metadata.genre}
              onChange={(e) => onUpdateMetadata({ genre: e.target.value })}
              className="w-full bg-[#121214] border border-[#2D2D2F] text-xs px-2 py-1 rounded text-[#E0E0E0] outline-none"
            />
          </div>
          <div>
            <span className="text-[8px] text-[#8E9299] uppercase font-bold block mb-0.5">Year</span>
            <input
              type="number"
              value={metadata.year}
              onChange={(e) => onUpdateMetadata({ year: parseInt(e.target.value) || 2026 })}
              className="w-full bg-[#121214] border border-[#2D2D2F] text-xs font-mono px-2 py-1 rounded text-[#E0E0E0] outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
