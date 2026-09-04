import React, { useRef, useEffect, useState } from 'react';
import { Activity, Disc3, ShieldAlert } from 'lucide-react';
import { DspMasteringSettings } from '../../types';
import { dspEngine } from '../../audio/dspEngine';

interface DspMasteringPanelProps {
  dspSettings: DspMasteringSettings;
  onUpdateDsp: (updated: Partial<DspMasteringSettings>) => void;
  isPlaying: boolean;
}

export const DspMasteringPanel: React.FC<DspMasteringPanelProps> = ({
  dspSettings,
  onUpdateDsp,
  isPlaying
}) => {
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);
  const [meterValues, setMeterValues] = useState({
    lufs: -70,
    peakDb: -70,
    grDb: 0
  });

  // Animation frame loop for metering
  useEffect(() => {
    let animId: number;

    const updateMeters = () => {
      const data = dspEngine.getAnalyserData();
      setMeterValues({
        lufs: isPlaying ? data.lufs : -70,
        peakDb: isPlaying ? data.peakDb : -70,
        grDb: isPlaying ? data.limiterReductionDb : 0
      });

      // Draw real-time spectrum & EQ response curve on canvas
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

  // Compute number of active LED bars for the vertical meter
  const clampedPeak = Math.max(-48, Math.min(0, meterValues.peakDb));
  const activeLeds = isPlaying ? Math.round(((clampedPeak + 48) / 48) * 8) : 0;

  return (
    <div className="h-full flex gap-3 overflow-x-auto bg-[#0F0F10] p-3 text-[#E0E0E0] select-none">
      {/* BENTO CARD 1: MASTERING DSP CHAIN & PARAMETRIC EQ */}
      <div className="w-[430px] bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-3.5 flex flex-col shrink-0 shadow-lg justify-between">
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
                Mastering DSP Chain
              </h3>
              <span className="text-[9px] font-mono text-[#4FC3F7] font-semibold">
                BIQUAD DIRECT FORM II
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  dspSettings.enabled
                    ? 'bg-[#00FF00] shadow-[0_0_8px_#00FF00]'
                    : 'bg-[#4F4F51]'
                }`}
              />
              <button
                onClick={() => onUpdateDsp({ enabled: !dspSettings.enabled })}
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                  dspSettings.enabled
                    ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] border-[#4FC3F7]/40'
                    : 'bg-[#121214] text-[#4F4F51] border-[#2D2D2F]'
                }`}
              >
                {dspSettings.enabled ? 'ACTIVE' : 'BYPASS'}
              </button>
            </div>
          </div>

          {/* EQ Curve Display Container */}
          <div className="h-24 w-full bg-[#121214] border border-[#2D2D2F] rounded-lg relative overflow-hidden mb-2.5">
            <canvas
              ref={eqCanvasRef}
              width={420}
              height={96}
              className="w-full h-full"
            />
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#8E9299] flex items-center gap-2 bg-[#121214]/80 px-1.5 py-0.5 rounded border border-[#2D2D2F]/50">
              <span className="text-[#4FC3F7]">12kHz Shelf</span>
              <span>•</span>
              <span className="text-[#F27D26]">320Hz Scoop</span>
            </div>
          </div>
        </div>

        {/* Dual Band Knobs Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Mud Scoop (200-400 Hz) */}
          <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-[#F27D26] uppercase">Mud Scoop (Bell)</span>
              <span className="text-[9px] font-mono text-[#E0E0E0] font-bold">
                {dspSettings.mudScoopBand.gainDb.toFixed(1)} dB
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[8px] text-[#8E9299] font-mono">
                <span>Freq</span>
                <span>{Math.round(dspSettings.mudScoopBand.frequency)} Hz</span>
              </div>
              <input
                type="range"
                min="200"
                max="400"
                value={dspSettings.mudScoopBand.frequency}
                onChange={(e) => {
                  const freq = parseFloat(e.target.value);
                  onUpdateDsp({
                    mudScoopBand: { ...dspSettings.mudScoopBand, frequency: freq }
                  });
                }}
                className="w-full h-1 accent-[#F27D26] bg-[#2D2D2F] rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-[#8E9299] font-mono">
                <span>Scoop Gain</span>
                <span>{dspSettings.mudScoopBand.gainDb.toFixed(1)} dB</span>
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
                className="w-full h-1 accent-[#F27D26] bg-[#2D2D2F] rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Harsh High Cut (>12 kHz) */}
          <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-[#4FC3F7] uppercase">Harsh Cut (Shelf)</span>
              <span className="text-[9px] font-mono text-[#E0E0E0] font-bold">
                {dspSettings.highCutBand.gainDb.toFixed(1)} dB
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[8px] text-[#8E9299] font-mono">
                <span>Cutoff</span>
                <span>{(dspSettings.highCutBand.frequency / 1000).toFixed(1)} kHz</span>
              </div>
              <input
                type="range"
                min="10000"
                max="16000"
                step="200"
                value={dspSettings.highCutBand.frequency}
                onChange={(e) => {
                  const freq = parseFloat(e.target.value);
                  onUpdateDsp({
                    highCutBand: { ...dspSettings.highCutBand, frequency: freq }
                  });
                }}
                className="w-full h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-[#8E9299] font-mono">
                <span>Attenuation</span>
                <span>{dspSettings.highCutBand.gainDb.toFixed(1)} dB</span>
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
                className="w-full h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* BENTO CARD 2: MULTIBAND DYNAMICS & STEREO IMAGING */}
      <div className="w-[340px] bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-3.5 flex flex-col shrink-0 shadow-lg justify-between">
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
              Multiband &amp; Stereo Width
            </h3>
            <span className="text-[9px] font-mono text-[#4FC3F7] font-semibold">
              3-BAND SPLIT
            </span>
          </div>

          {/* 3 Dynamics Bands in Bento cells */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {/* Low Band */}
            <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F] flex flex-col justify-between">
              <span className="text-[9px] font-bold text-[#00FF00]">LOW &lt;250</span>
              <input
                type="range"
                min="-36"
                max="0"
                value={dspSettings.multiband.lowBand.thresholdDb}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateDsp({
                    multiband: {
                      ...dspSettings.multiband,
                      lowBand: { ...dspSettings.multiband.lowBand, thresholdDb: val }
                    }
                  });
                }}
                className="w-full h-1 accent-[#00FF00] bg-[#2D2D2F] mt-1"
              />
              <span className="text-[8px] font-mono text-[#8E9299] mt-0.5 text-right">
                {dspSettings.multiband.lowBand.thresholdDb} dB
              </span>
            </div>

            {/* Mid Band */}
            <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F] flex flex-col justify-between">
              <span className="text-[9px] font-bold text-[#4FC3F7]">MID 250-4k</span>
              <input
                type="range"
                min="-36"
                max="0"
                value={dspSettings.multiband.midBand.thresholdDb}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateDsp({
                    multiband: {
                      ...dspSettings.multiband,
                      midBand: { ...dspSettings.multiband.midBand, thresholdDb: val }
                    }
                  });
                }}
                className="w-full h-1 accent-[#4FC3F7] bg-[#2D2D2F] mt-1"
              />
              <span className="text-[8px] font-mono text-[#8E9299] mt-0.5 text-right">
                {dspSettings.multiband.midBand.thresholdDb} dB
              </span>
            </div>

            {/* High Band */}
            <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F] flex flex-col justify-between">
              <span className="text-[9px] font-bold text-[#FFB300]">HIGH &gt;4k</span>
              <input
                type="range"
                min="-36"
                max="0"
                value={dspSettings.multiband.highBand.thresholdDb}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateDsp({
                    multiband: {
                      ...dspSettings.multiband,
                      highBand: { ...dspSettings.multiband.highBand, thresholdDb: val }
                    }
                  });
                }}
                className="w-full h-1 accent-[#FFB300] bg-[#2D2D2F] mt-1"
              />
              <span className="text-[8px] font-mono text-[#8E9299] mt-0.5 text-right">
                {dspSettings.multiband.highBand.thresholdDb} dB
              </span>
            </div>
          </div>
        </div>

        {/* Stereo Width Slider */}
        <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F] flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Disc3 className="w-3.5 h-3.5 text-[#4FC3F7]" />
            <span className="text-[9px] font-bold uppercase text-[#8E9299]">M/S Width</span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            step="5"
            value={dspSettings.stereoImaging.widthPercent}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onUpdateDsp({
                stereoImaging: { ...dspSettings.stereoImaging, widthPercent: val }
              });
            }}
            className="flex-1 h-1 accent-[#4FC3F7] bg-[#2D2D2F] rounded cursor-pointer"
          />
          <span className="text-[10px] font-mono font-bold text-[#4FC3F7] w-10 text-right">
            {dspSettings.stereoImaging.widthPercent}%
          </span>
        </div>
      </div>

      {/* BENTO CARD 3: LEVEL METER & TRUE-PEAK LIMITER */}
      <div className="w-[280px] bg-[#1A1A1C] rounded-xl border border-[#2D2D2F] p-3.5 flex flex-col shrink-0 shadow-lg justify-between">
        <div>
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-[10px] font-bold text-[#8E9299] tracking-widest uppercase">
              Level Meter
            </h3>
            <ShieldAlert className="w-3.5 h-3.5 text-[#00FF00]" />
          </div>

          <div className="flex gap-3 h-24">
            {/* Vertical Segmented LED Meter */}
            <div className="flex-1 bg-[#121214] rounded-lg border border-[#2D2D2F] p-2 flex flex-col gap-1 justify-between">
              <div className="flex-1 flex flex-col-reverse gap-0.5 overflow-hidden">
                <div className={`h-1.5 w-full bg-[#FF4444] rounded-xs ${activeLeds >= 8 ? 'opacity-100 shadow-[0_0_6px_#FF4444]' : 'opacity-20'}`} />
                <div className={`h-1.5 w-full bg-[#FF4444] rounded-xs ${activeLeds >= 7 ? 'opacity-100 shadow-[0_0_6px_#FF4444]' : 'opacity-20'}`} />
                <div className={`h-1.5 w-full bg-[#FFB300] rounded-xs ${activeLeds >= 6 ? 'opacity-100 shadow-[0_0_6px_#FFB300]' : 'opacity-20'}`} />
                <div className={`h-1.5 w-full bg-[#FFB300] rounded-xs ${activeLeds >= 5 ? 'opacity-100 shadow-[0_0_6px_#FFB300]' : 'opacity-20'}`} />
                <div className={`h-1.5 w-full bg-[#00FF00] rounded-xs ${activeLeds >= 4 ? 'opacity-100 shadow-[0_0_6px_#00FF00]' : 'opacity-20'}`} />
                <div className={`h-1.5 w-full bg-[#00FF00] rounded-xs ${activeLeds >= 3 ? 'opacity-100 shadow-[0_0_6px_#00FF00]' : 'opacity-20'}`} />
                <div className={`h-1.5 w-full bg-[#00FF00] rounded-xs ${activeLeds >= 2 ? 'opacity-100 shadow-[0_0_6px_#00FF00]' : 'opacity-20'}`} />
                <div className={`h-1.5 w-full bg-[#00FF00] rounded-xs ${activeLeds >= 1 ? 'opacity-100 shadow-[0_0_6px_#00FF00]' : 'opacity-20'}`} />
              </div>
              <div className="text-[11px] font-mono text-center text-[#4FC3F7] font-bold">
                {meterValues.lufs > -60 ? `${meterValues.lufs.toFixed(1)} LUFS` : '-14.2 LUFS'}
              </div>
            </div>

            {/* dB Scale Ladder */}
            <div className="w-14 flex flex-col justify-between text-[8px] font-mono text-[#4F4F51] py-1">
              <span>0 dB</span>
              <span>-3 dB</span>
              <span>-6 dB</span>
              <span>-12 dB</span>
              <span>-18 dB</span>
              <span>-INF</span>
            </div>
          </div>
        </div>

        {/* True-Peak Limiter Ceiling */}
        <div className="bg-[#121214] p-2 rounded-lg border border-[#2D2D2F] flex items-center justify-between">
          <span className="text-[9px] font-bold text-[#8E9299] uppercase">Ceiling</span>
          <span className="text-[10px] font-mono font-bold text-[#00FF00]">
            {dspSettings.limiter.ceilingDb.toFixed(1)} dBTP
          </span>
          <input
            type="range"
            min="-3.0"
            max="-0.1"
            step="0.1"
            value={dspSettings.limiter.ceilingDb}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateDsp({
                limiter: { ...dspSettings.limiter, ceilingDb: val }
              });
            }}
            className="w-20 h-1 accent-[#00FF00] bg-[#2D2D2F] rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

// Helper: Renders Frequency Response Curve on Canvas in Bento Palette
function drawEqCurve(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dsp: DspMasteringSettings,
  fftData: Uint8Array | null
) {
  ctx.clearRect(0, 0, w, h);

  // Background Grid Lines
  ctx.strokeStyle = '#222225';
  ctx.lineWidth = 1;

  const dbMarks = [-12, -6, 0, 6];
  for (const db of dbMarks) {
    const y = h / 2 - (db / 18) * (h / 2);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    if (db === 0) {
      ctx.strokeStyle = '#2D2D2F';
      ctx.stroke();
      ctx.strokeStyle = '#222225';
    }
  }

  // Draw Real-time FFT spectrum if playing
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

  // Calculate EQ Curve: High Shelf + Peaking Bell in Electric Cyan (#4FC3F7)
  ctx.strokeStyle = dsp.enabled ? '#4FC3F7' : '#4F4F51';
  ctx.lineWidth = 2.0;
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
