import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Music,
  Play,
  Square,
  UploadCloud,
  Plus,
  Trash2,
  Search,
  CheckCircle,
  FileAudio,
  Radio,
  Layers,
  ArrowRightCircle
} from 'lucide-react';
import { LoadedAudioFile, AudioTrackModel } from '../types';

interface AudioFilesPoolProps {
  files: LoadedAudioFile[];
  tracks: AudioTrackModel[];
  onImportFile: (file: File) => void;
  onDeleteFile: (fileId: string) => void;
  onInsertClipToTrack: (fileId: string, trackIndex: number, startTime?: number) => void;
  onCreateTrackWithFile: (fileId: string) => void;
  currentTime: number;
}

export const AudioFilesPool: React.FC<AudioFilesPoolProps> = ({
  files,
  tracks,
  onImportFile,
  onDeleteFile,
  onInsertClipToTrack,
  onCreateTrackWithFile,
  currentTime
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [auditioningFileId, setAuditioningFileId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop audition audio
  const stopAudition = () => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {
        // Ignored if already stopped
      }
      currentSourceRef.current = null;
    }
    setAuditioningFileId(null);
  };

  // Play audition preview of an audio file
  const startAudition = (file: LoadedAudioFile) => {
    stopAudition();

    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const source = ctx.createBufferSource();
    source.buffer = file.audioBuffer;

    const gain = ctx.createGain();
    gain.gain.value = 0.85;

    source.connect(gain);
    gain.connect(ctx.destination);

    source.onended = () => {
      setAuditioningFileId(null);
    };

    source.start(0);
    currentSourceRef.current = source;
    setAuditioningFileId(file.id);
  };

  useEffect(() => {
    return () => {
      stopAudition();
    };
  }, []);

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSec = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-[#121214] text-[#E0E0E0] select-none">
      {/* Top Header Bar */}
      <div className="h-10 bg-[#161618] border-b border-[#2D2D2F] px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#4FC3F7]" />
          <span className="text-xs font-bold text-white tracking-wide">
            AUDIO MEDIA POOL
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#4FC3F7]/15 text-[#4FC3F7] font-semibold border border-[#4FC3F7]/30">
            {files.length} Loaded File{files.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative w-44">
            <Search className="w-3 h-3 absolute left-2 top-2 text-[#8E9299]" />
            <input
              type="text"
              placeholder="Search audio pool..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A1A1C] border border-[#2D2D2F] rounded pl-7 pr-2 py-1 text-xs font-mono text-white placeholder-[#6E7279] focus:outline-none focus:border-[#4FC3F7]"
            />
          </div>

          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#4FC3F7] hover:bg-[#29B6F6] text-black font-bold text-xs rounded transition-colors cursor-pointer shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Load Audio File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.wav,.mp3,.flac,.aac,.ogg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                Array.from(e.target.files).forEach((f) => onImportFile(f));
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>

      {/* Files List / Grid Area */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {filteredFiles.map((file) => {
          const isAuditioning = auditioningFileId === file.id;

          return (
            <div
              key={file.id}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ fileId: file.id }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className={`bg-[#1A1A1C] border rounded-lg p-2.5 flex flex-col justify-between transition-all group hover:border-[#4FC3F7]/50 ${
                isAuditioning ? 'border-[#00FFA3] shadow-[0_0_12px_rgba(0,255,163,0.2)]' : 'border-[#2D2D2F]'
              }`}
            >
              {/* File Title & Info */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileAudio className={`w-4 h-4 shrink-0 ${isAuditioning ? 'text-[#00FFA3] animate-pulse' : 'text-[#4FC3F7]'}`} />
                    <span className="text-xs font-bold text-white truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>

                  <button
                    onClick={() => onDeleteFile(file.id)}
                    title="Remove from pool"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#8E9299] hover:text-[#FF4444] hover:bg-[#FF4444]/15 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1 text-[9px] font-mono text-[#8E9299] mb-2 flex-wrap">
                  <span className="px-1 py-0.2 rounded bg-[#121214] border border-[#2D2D2F]">
                    {formatSec(file.duration)}
                  </span>
                  <span className="px-1 py-0.2 rounded bg-[#121214] border border-[#2D2D2F]">
                    {file.sampleRate} Hz
                  </span>
                  <span className="px-1 py-0.2 rounded bg-[#121214] border border-[#2D2D2F]">
                    {file.channels === 1 ? 'MONO' : 'STEREO'}
                  </span>
                  {file.fileSize && (
                    <span className="px-1 py-0.2 rounded bg-[#121214] border border-[#2D2D2F]">
                      {(file.fileSize / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  )}
                </div>

                {/* Mini Waveform Canvas */}
                <div className="h-8 bg-[#121214] rounded border border-[#2D2D2F]/60 overflow-hidden relative flex items-center px-1 mb-2">
                  <WaveformMini peaks={file.peaks} color={isAuditioning ? '#00FFA3' : '#4FC3F7'} />
                </div>
              </div>

              {/* Actions Bottom Row */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[#2D2D2F]/60">
                {/* Audition Button */}
                <button
                  onClick={() => (isAuditioning ? stopAudition() : startAudition(file))}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                    isAuditioning
                      ? 'bg-[#00FFA3] text-black shadow-[0_0_8px_#00FFA3]'
                      : 'bg-[#252528] hover:bg-[#323236] text-[#E0E0E0]'
                  }`}
                >
                  {isAuditioning ? (
                    <>
                      <Square className="w-3 h-3 fill-black" />
                      <span>STOP</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>AUDITION</span>
                    </>
                  )}
                </button>

                {/* Layer Placement Dropdown / Action */}
                <div className="flex items-center gap-1">
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'new') {
                        onCreateTrackWithFile(file.id);
                      } else if (val !== '') {
                        const trkIdx = parseInt(val, 10);
                        onInsertClipToTrack(file.id, trkIdx, currentTime);
                      }
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className="bg-[#252528] hover:bg-[#323236] border border-[#2D2D2F] text-[10px] font-mono text-[#4FC3F7] rounded px-1.5 py-1 cursor-pointer focus:outline-none"
                    title="Insert audio file into a track layer"
                  >
                    <option value="" disabled>
                      + Insert on Layer...
                    </option>
                    {tracks.map((t, idx) => (
                      <option key={t.id} value={idx}>
                        Track {idx + 1}: {t.name}
                      </option>
                    ))}
                    <option value="new">+ New Track Layer</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        {filteredFiles.length === 0 && (
          <div className="col-span-full h-36 border border-dashed border-[#2D2D2F] rounded-lg flex flex-col items-center justify-center gap-2 text-center p-4 bg-[#161618]/40">
            <Music className="w-6 h-6 text-[#8E9299]" />
            <div className="text-xs text-[#E0E0E0] font-semibold">No audio files in media pool</div>
            <div className="text-[10px] text-[#8E9299]">
              Import or drag WAV, MP3, FLAC, or OGG files to use as audio layers.
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 text-xs text-[#4FC3F7] hover:underline cursor-pointer font-mono"
            >
              Browse Files...
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Mini Waveform SVG / Canvas Preview
const WaveformMini: React.FC<{ peaks: number[]; color: string }> = ({ peaks, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const data = peaks && peaks.length > 0 ? peaks : [0.2, 0.4, 0.6, 0.3, 0.7, 0.5, 0.8, 0.4];
    const midY = h / 2;
    const numBars = Math.min(80, Math.floor(w / 3));
    const barWidth = w / numBars;

    ctx.fillStyle = color;
    for (let i = 0; i < numBars; i++) {
      const idx = Math.floor((i / numBars) * data.length);
      const val = data[idx] || 0.1;
      const barH = Math.max(2, val * (h * 0.85));
      ctx.fillRect(i * barWidth, midY - barH / 2, Math.max(1, barWidth - 1), barH);
    }
  }, [peaks, color]);

  return <canvas ref={canvasRef} width={280} height={32} className="w-full h-full opacity-80" />;
};
