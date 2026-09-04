import React, { useRef, useEffect, useState } from 'react';
import { Disc, Image, Check, Sliders, ShieldAlert } from 'lucide-react';
import { DspMasteringSettings, AudioMetadataTags } from '../../types';
import { dspEngine } from '../../audio/dspEngine';

interface BentoGridFooterProps {
  dspSettings: DspMasteringSettings;
  onUpdateDsp: (updated: Partial<DspMasteringSettings>) => void;
  metadata: AudioMetadataTags;
  onUpdateMetadata: (updated: Partial<AudioMetadataTags>) => void;
  onBatchApplyMetadata: () => void;
  isPlaying: boolean;
  onOpenAdvancedDsp: () => void;
}

export const BentoGridFooter: React.FC<BentoGridFooterProps> = ({
  dspSettings,
  onUpdateDsp,
  metadata,
  onUpdateMetadata,
  onBatchApplyMetadata,
  isPlaying,
  onOpenAdvancedDsp
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);
  const [meterValues, setMeterValues] = useState({
    lufs: -70,
    peakDb: -70,
    grDb: 0
  });

  // Animation frame loop for metering and real-time EQ spectrum
  useEffect(() => {
    let animId: number;

    const updateMeters = () => {
      const data = dspEngine.getAnalyserData();
      setMeterValues({
        lufs: isPlaying ? data.lufs : -70,
        peakDb: isPlaying ? data.peakDb : -70,
        grDb: isPlaying ? data.limiterReductionDb : 0
      });

      const canvas = eqCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawEqCurve(ctx, canvas.width, canvas.height, dspSettings, isPlaying ? data.frequency : null);
        }
      }

      animId = requestAnimationFrame(updateMeters);
    };

    animId = requestAnimationFrame(updateMeters);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, dspSettings]);

  // Compute number of active LED bars for the vertical meter (0 to 6)
  const clampedPeak = Math.max(-48, Math.min(0, meterValues.peakDb));
  const activeLeds = isPlaying ? Math.round(((clampedPeak + 48) / 48) * 6) : 0;

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

  return (
    <div className="h-full w-full bg-[#0F0F10] flex flex-col lg:flex-row p-2.5 gap-2.5 select-none overflow-y-auto lg:overflow-hidden">
      {/* CARD 1: MASTERING DSP CHAIN */}
      <div className="w-full lg:w-1/3 min-w-[240px] bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-3 flex flex-col justify-between shadow-lg min-h-0 overflow-y-auto">
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
              Mastering DSP Chain
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenAdvancedDsp}
                title="View full 3-band dynamics & limiter settings"
                className="text-[9px] text-[#8E9299] hover:text-[#4FC3F7] font-mono transition-colors cursor-pointer"
              >
                ADVANCED &gt;
              </button>
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  dspSettings.enabled
                    ? 'bg-[#00FF00] shadow-[0_0_8px_#00FF00]'
                    : 'bg-[#4F4F51]'
                }`}
              />
            </div>
          </div>

          {/* Visual dynamic frequency graph container */}
          <div className="h-16 sm:h-20 w-full bg-[#121214] border border-[#2D2D2F] rounded-lg mb-2 flex items-center justify-center relative overflow-hidden">
            <canvas
              ref={eqCanvasRef}
              width={340}
              height={80}
              className="w-full h-full"
            />
            <div className="font-mono text-[8px] text-[#4FC3F7] absolute bottom-1 right-2 bg-[#121214]/85 px-1.5 py-0.5 rounded border border-[#2D2D2F]/60">
              EQ: 12kHz Shelf + 320Hz Scoop
            </div>
          </div>
        </div>

        {/* Dual Band Knobs */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          {/* Harsh Cut (12 kHz) */}
          <div className="bg-[#121214] p-1.5 rounded border border-[#2D2D2F]">
            <div className="flex justify-between items-center text-[8px] text-[#8E9299] uppercase font-bold">
              <span>Harsh Cut</span>
              <span className="text-[#4FC3F7] font-mono">12.0 kHz</span>
            </div>
            <div className="text-xs font-mono font-bold text-[#E0E0E0] mt-0.5">
              {dspSettings.highCutBand.gainDb.toFixed(1)} dB
            </div>
            <input
              type="range"
              min="-12"
              max="0"
              step="0.5"
              value={dspSettings.highCutBand.gainDb}
              onChange={(e) => {
                const gain = parseFloat(e.target.value);
                onUpdateDsp({
                  highCutBand: { ...dspSettings.highCutBand, gainDb: gain }
                });
              }}
              className="w-full h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded mt-1 cursor-pointer"
            />
          </div>

          {/* Mud Scoop (320 Hz) */}
          <div className="bg-[#121214] p-1.5 rounded border border-[#2D2D2F]">
            <div className="flex justify-between items-center text-[8px] text-[#8E9299] uppercase font-bold">
              <span>Mud Scoop</span>
              <span className="text-[#F27D26] font-mono">320 Hz</span>
            </div>
            <div className="text-xs font-mono font-bold text-[#E0E0E0] mt-0.5">
              {dspSettings.mudScoopBand.gainDb.toFixed(1)} dB
            </div>
            <input
              type="range"
              min="-12"
              max="3"
              step="0.5"
              value={dspSettings.mudScoopBand.gainDb}
              onChange={(e) => {
                const gain = parseFloat(e.target.value);
                onUpdateDsp({
                  mudScoopBand: { ...dspSettings.mudScoopBand, gainDb: gain }
                });
              }}
              className="w-full h-1 accent-[#F27D26] bg-[#2D2D2F] rounded mt-1 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* CARD 2: METADATA INSPECTOR (.siq) */}
      <div className="w-full lg:flex-1 min-w-[260px] bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-3 flex flex-col justify-between shadow-lg min-h-0 overflow-y-auto">
        <div className="flex justify-between items-center mb-2 shrink-0">
          <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
            Metadata Inspector (.siq)
          </h3>
          <button
            onClick={onBatchApplyMetadata}
            className="text-[9px] text-[#4FC3F7] hover:text-[#29B6F6] font-bold bg-[#4FC3F7]/10 hover:bg-[#4FC3F7]/20 border border-[#4FC3F7]/30 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            BATCH APPLY
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 h-full overflow-y-auto pr-0.5">
          {/* Album Art + Title + Artist */}
          <div className="flex gap-2.5">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-[#121214] border border-[#2D2D2F] rounded-lg flex items-center justify-center text-[#2D2D2F] shrink-0 overflow-hidden relative cursor-pointer group hover:border-[#4FC3F7]/50 transition-colors"
            >
              {metadata.coverArtDataUrl ? (
                <img
                  src={metadata.coverArtDataUrl}
                  alt="Album Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc className="w-8 h-8 text-[#2D2D2F] group-hover:text-[#4FC3F7] transition-colors" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-[#4FC3F7] transition-opacity">
                ARTWORK
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="flex flex-col justify-between py-0.5 w-full min-w-0">
              <div>
                <div className="text-[8px] text-[#8E9299] uppercase font-bold mb-0.5">Track Title</div>
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                  className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-semibold px-2 py-0.5 rounded text-[#E0E0E0] outline-none truncate"
                />
              </div>
              <div className="mt-1">
                <div className="text-[8px] text-[#8E9299] uppercase font-bold mb-0.5">Artist</div>
                <input
                  type="text"
                  value={metadata.artist}
                  onChange={(e) => onUpdateMetadata({ artist: e.target.value })}
                  className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-semibold px-2 py-0.5 rounded text-[#E0E0E0] outline-none truncate"
                />
              </div>
            </div>
          </div>

          {/* ISRC + Target Standard + Broadcast Notes */}
          <div className="flex flex-col justify-between py-0.5 min-w-0">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[8px] text-[#8E9299] uppercase font-bold mb-0.5">ISRC Code</div>
                <input
                  type="text"
                  value={metadata.isrc}
                  onChange={(e) => onUpdateMetadata({ isrc: e.target.value })}
                  className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-mono px-2 py-0.5 rounded text-[#E0E0E0] outline-none truncate"
                />
              </div>
              <div>
                <div className="text-[8px] text-[#8E9299] uppercase font-bold mb-0.5">Target Standard</div>
                <div className="text-[11px] font-mono py-0.5 text-[#4FC3F7] font-semibold truncate">
                  ID3v2.4 / Vorbis
                </div>
              </div>
            </div>
            <div className="mt-1">
              <div className="text-[8px] text-[#8E9299] uppercase font-bold mb-0.5">Broadcast Notes</div>
              <input
                type="text"
                value={metadata.comment || 'Mastered for streaming & broadcast (-14 LUFS)'}
                onChange={(e) => onUpdateMetadata({ comment: e.target.value })}
                className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs px-2 py-0.5 rounded text-[#8E9299] focus:text-[#E0E0E0] outline-none truncate"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3: LEVEL METER */}
      <div className="w-full lg:w-1/4 min-w-[170px] bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-3 flex flex-col justify-between shadow-lg min-h-0 overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
            Level Meter
          </h3>
          <ShieldAlert className="w-3.5 h-3.5 text-[#00FF00]" />
        </div>

        <div className="flex-1 flex gap-2">
          {/* Segmented LED Column */}
          <div className="flex-1 bg-[#121214] rounded-lg border border-[#2D2D2F] p-2 flex flex-col justify-between">
            <div className="flex-1 flex flex-col-reverse gap-0.5">
              <div
                className={`h-1.5 w-full bg-[#FF4444] rounded-xs transition-opacity ${
                  activeLeds >= 6 ? 'opacity-100 shadow-[0_0_6px_#FF4444]' : 'opacity-20'
                }`}
              />
              <div
                className={`h-1.5 w-full bg-[#FF4444] rounded-xs transition-opacity ${
                  activeLeds >= 5 ? 'opacity-100 shadow-[0_0_6px_#FF4444]' : 'opacity-20'
                }`}
              />
              <div
                className={`h-1.5 w-full bg-[#FFB300] rounded-xs transition-opacity ${
                  activeLeds >= 4 ? 'opacity-100 shadow-[0_0_6px_#FFB300]' : 'opacity-20'
                }`}
              />
              <div
                className={`h-1.5 w-full bg-[#00FF00] rounded-xs transition-opacity ${
                  activeLeds >= 3 ? 'opacity-100 shadow-[0_0_6px_#00FF00]' : 'opacity-20'
                }`}
              />
              <div
                className={`h-1.5 w-full bg-[#00FF00] rounded-xs transition-opacity ${
                  activeLeds >= 2 ? 'opacity-100 shadow-[0_0_6px_#00FF00]' : 'opacity-20'
                }`}
              />
              <div
                className={`h-1.5 w-full bg-[#00FF00] rounded-xs transition-opacity ${
                  activeLeds >= 1 ? 'opacity-100 shadow-[0_0_6px_#00FF00]' : 'opacity-20'
                }`}
              />
            </div>
            <div className="text-[10px] font-mono text-center text-[#4FC3F7] font-bold mt-2">
              {meterValues.lufs > -60 ? `${meterValues.lufs.toFixed(1)} LUFS` : '-14.2 LUFS'}
            </div>
          </div>

          {/* Scale Legend */}
          <div className="w-8 flex flex-col justify-between text-[8px] font-mono text-[#4F4F51] py-1">
            <div>0 dB</div>
            <div>-6 dB</div>
            <div>-14 dB</div>
            <div>-INF</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Canvas Frequency Response Curve renderer
function drawEqCurve(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dsp: DspMasteringSettings,
  fftData: Uint8Array | null
) {
  ctx.clearRect(0, 0, w, h);

  // Background subtle grid lines
  ctx.strokeStyle = '#222225';
  ctx.lineWidth = 1;

  for (const db of [-12, -6, 0, 6]) {
    const y = h / 2 - (db / 18) * (h / 2);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw real-time FFT spectrum in electric cyan
  if (fftData && fftData.length > 0) {
    ctx.fillStyle = 'rgba(79, 195, 247, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < fftData.length; i += 4) {
      const x = (i / fftData.length) * w;
      const mag = fftData[i] / 255;
      const y = h - mag * (h * 0.85);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // Draw EQ Curve in #4FC3F7
  ctx.strokeStyle = dsp.enabled ? '#4FC3F7' : '#4F4F51';
  ctx.lineWidth = 1.8;
  ctx.beginPath();

  for (let x = 0; x < w; x++) {
    const freq = 20 * Math.pow(1000, x / w);
    let totalDb = 0;

    if (dsp.enabled && dsp.mudScoopBand.enabled) {
      const f0 = dsp.mudScoopBand.frequency;
      const gain = dsp.mudScoopBand.gainDb;
      const q = dsp.mudScoopBand.q;
      const dist = Math.abs(Math.log2(freq / f0));
      const bell = Math.exp(-Math.pow(dist * q * 1.5, 2));
      totalDb += gain * bell;
    }

    if (dsp.enabled && dsp.highCutBand.enabled) {
      const f0 = dsp.highCutBand.frequency;
      const gain = dsp.highCutBand.gainDb;
      if (freq >= f0 * 0.7) {
        const factor = Math.min(1, Math.max(0, (freq - f0 * 0.7) / (f0 * 0.6)));
        totalDb += gain * factor;
      }
    }

    const y = h / 2 - (totalDb / 18) * (h / 2);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
}
