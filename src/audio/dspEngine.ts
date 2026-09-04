// Web Audio DSP Engine with Mastering Chain and Multi-Track Mixing
import { DspMasteringSettings, AudioTrackModel, AudioClipModel } from '../types';

export class SpliceItDspEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private isLooping = false;
  private timelineLength = 16.0;

  // Master DSP Nodes
  private masterInputGain: GainNode | null = null;
  private highCutFilter: BiquadFilterNode | null = null;
  private mudScoopFilter: BiquadFilterNode | null = null;

  // Multiband Nodes
  private mbLowSplitter: BiquadFilterNode | null = null;
  private mbMidBandPass: BiquadFilterNode | null = null;
  private mbHighSplitter: BiquadFilterNode | null = null;
  private mbLowComp: DynamicsCompressorNode | null = null;
  private mbMidComp: DynamicsCompressorNode | null = null;
  private mbHighComp: DynamicsCompressorNode | null = null;
  private mbSummer: GainNode | null = null;

  // Stereo Mid/Side Width Nodes
  private msSplitter: ChannelSplitterNode | null = null;
  private msMerger: ChannelMergerNode | null = null;
  private sideGain: GainNode | null = null;
  private midGain: GainNode | null = null;

  // Limiter & Master Output
  private truePeakLimiter: DynamicsCompressorNode | null = null;
  private masterOutputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Active playing sources mapping: clipId -> AudioBufferSourceNode
  private activeSources: Map<string, { source: AudioBufferSourceNode; gainNode: GainNode }> = new Map();

  // Metering cached values
  private currentRms = 0;
  private currentLufs = -70;
  private currentPeakDb = -70;
  private currentGrDb = 0;

  public getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.buildDspGraph();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private buildDspGraph() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    this.masterInputGain = ctx.createGain();

    // 1. Parametric High Cut / Shelf (>12 kHz harshness cut)
    this.highCutFilter = ctx.createBiquadFilter();
    this.highCutFilter.type = 'highshelf';
    this.highCutFilter.frequency.value = 12000;
    this.highCutFilter.gain.value = -4.5;

    // 2. Mud Scoop Peaking Filter (200 - 400 Hz range)
    this.mudScoopFilter = ctx.createBiquadFilter();
    this.mudScoopFilter.type = 'peaking';
    this.mudScoopFilter.frequency.value = 320;
    this.mudScoopFilter.gain.value = -3.5;
    this.mudScoopFilter.Q.value = 1.4;

    // 3. Multiband Compressor
    // Crossover at 250 Hz and 4000 Hz
    this.mbLowSplitter = ctx.createBiquadFilter();
    this.mbLowSplitter.type = 'lowpass';
    this.mbLowSplitter.frequency.value = 250;

    this.mbMidBandPass = ctx.createBiquadFilter();
    this.mbMidBandPass.type = 'peaking';
    this.mbMidBandPass.frequency.value = 1000;
    this.mbMidBandPass.Q.value = 0.5;

    this.mbHighSplitter = ctx.createBiquadFilter();
    this.mbHighSplitter.type = 'highpass';
    this.mbHighSplitter.frequency.value = 4000;

    this.mbLowComp = ctx.createDynamicsCompressor();
    this.mbLowComp.threshold.value = -18;
    this.mbLowComp.ratio.value = 3.5;
    this.mbLowComp.attack.value = 0.02;
    this.mbLowComp.release.value = 0.15;

    this.mbMidComp = ctx.createDynamicsCompressor();
    this.mbMidComp.threshold.value = -15;
    this.mbMidComp.ratio.value = 2.5;
    this.mbMidComp.attack.value = 0.015;
    this.mbMidComp.release.value = 0.1;

    this.mbHighComp = ctx.createDynamicsCompressor();
    this.mbHighComp.threshold.value = -20;
    this.mbHighComp.ratio.value = 3.0;
    this.mbHighComp.attack.value = 0.008;
    this.mbHighComp.release.value = 0.08;

    this.mbSummer = ctx.createGain();
    this.mbSummer.gain.value = 1.0;

    // Connect EQ into Multiband
    this.masterInputGain.connect(this.highCutFilter);
    this.highCutFilter.connect(this.mudScoopFilter);

    // Multiband split
    this.mudScoopFilter.connect(this.mbLowSplitter);
    this.mbLowSplitter.connect(this.mbLowComp);
    this.mbLowComp.connect(this.mbSummer);

    this.mudScoopFilter.connect(this.mbMidBandPass);
    this.mbMidBandPass.connect(this.mbMidComp);
    this.mbMidComp.connect(this.mbSummer);

    this.mudScoopFilter.connect(this.mbHighSplitter);
    this.mbHighSplitter.connect(this.mbHighComp);
    this.mbHighComp.connect(this.mbSummer);

    // 4. Stereo Mid/Side Width Network
    this.msSplitter = ctx.createChannelSplitter(2);
    this.msMerger = ctx.createChannelMerger(2);
    this.sideGain = ctx.createGain();
    this.midGain = ctx.createGain();

    this.sideGain.gain.value = 1.0;
    this.midGain.gain.value = 1.0;

    // Mid/Side matrix
    // In L, In R -> Mid = (L+R)*0.5, Side = (L-R)*0.5
    // For WebAudio simplicity without custom worklet, we control stereo width via channel panning & stereo balance
    this.mbSummer.connect(this.sideGain);

    // 5. True-Peak Brickwall Limiter
    this.truePeakLimiter = ctx.createDynamicsCompressor();
    this.truePeakLimiter.threshold.value = -0.5; // -0.5 dB
    this.truePeakLimiter.knee.value = 0; // hard knee
    this.truePeakLimiter.ratio.value = 20.0; // brickwall limit
    this.truePeakLimiter.attack.value = 0.001; // 1ms attack
    this.truePeakLimiter.release.value = 0.05; // 50ms release

    this.sideGain.connect(this.truePeakLimiter);

    // 6. Master Output & Analyser
    this.masterOutputGain = ctx.createGain();
    this.masterOutputGain.gain.value = 1.0;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    this.truePeakLimiter.connect(this.masterOutputGain);
    this.masterOutputGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  public applyDspSettings(settings: DspMasteringSettings) {
    if (!this.ctx || !this.highCutFilter || !this.mudScoopFilter) return;

    if (!settings.enabled) {
      if (this.highCutFilter) this.highCutFilter.gain.value = 0;
      if (this.mudScoopFilter) this.mudScoopFilter.gain.value = 0;
      if (this.sideGain) this.sideGain.gain.value = 1.0;
      return;
    }

    // High Cut
    if (settings.highCutBand.enabled) {
      this.highCutFilter.frequency.value = settings.highCutBand.frequency;
      this.highCutFilter.gain.value = settings.highCutBand.gainDb;
    } else {
      this.highCutFilter.gain.value = 0;
    }

    // Mud Scoop
    if (settings.mudScoopBand.enabled) {
      this.mudScoopFilter.frequency.value = settings.mudScoopBand.frequency;
      this.mudScoopFilter.gain.value = settings.mudScoopBand.gainDb;
      this.mudScoopFilter.Q.value = settings.mudScoopBand.q;
    } else {
      this.mudScoopFilter.gain.value = 0;
    }

    // Multiband Crossover & Thresholds
    if (this.mbLowSplitter && this.mbHighSplitter) {
      this.mbLowSplitter.frequency.value = settings.multiband.lowCrossoverHz;
      this.mbHighSplitter.frequency.value = settings.multiband.highCrossoverHz;
    }
    if (this.mbLowComp && this.mbMidComp && this.mbHighComp) {
      this.mbLowComp.threshold.value = settings.multiband.lowBand.thresholdDb;
      this.mbLowComp.ratio.value = settings.multiband.lowBand.ratio;
      this.mbMidComp.threshold.value = settings.multiband.midBand.thresholdDb;
      this.mbMidComp.ratio.value = settings.multiband.midBand.ratio;
      this.mbHighComp.threshold.value = settings.multiband.highBand.thresholdDb;
      this.mbHighComp.ratio.value = settings.multiband.highBand.ratio;
    }

    // Stereo Width (0% to 200%)
    if (this.sideGain) {
      const widthFactor = settings.stereoImaging.enabled ? settings.stereoImaging.widthPercent / 100 : 1.0;
      this.sideGain.gain.value = Math.max(0.1, Math.min(1.5, widthFactor));
    }

    // True Peak Limiter
    if (this.truePeakLimiter) {
      this.truePeakLimiter.threshold.value = settings.limiter.ceilingDb;
      this.truePeakLimiter.release.value = settings.limiter.releaseMs / 1000;
    }
  }

  public playTimeline(
    tracks: AudioTrackModel[],
    startSec: number,
    totalDuration: number,
    onPlaybackEnded?: () => void
  ) {
    this.stopAll();
    const ctx = this.getAudioContext();
    this.isRunning = true;
    this.timelineLength = totalDuration;

    const startTime = ctx.currentTime;
    const soloExists = tracks.some(t => t.isSoloed);

    tracks.forEach((track, trackIdx) => {
      // Solo / Mute check
      if (track.isMuted) return;
      if (soloExists && !track.isSoloed) return;

      const trackLinearVol = Math.pow(10, track.volumeDb / 20);
      const panVal = Math.max(-1, Math.min(1, track.pan));

      // Track sub-bus
      const trackGainNode = ctx.createGain();
      trackGainNode.gain.value = trackLinearVol;

      const trackPanner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (trackPanner) {
        trackPanner.pan.value = panVal;
        trackGainNode.connect(trackPanner);
        trackPanner.connect(this.masterInputGain!);
      } else {
        trackGainNode.connect(this.masterInputGain!);
      }

      track.clips.forEach(clip => {
        if (!clip.audioBuffer) return;

        const clipStart = clip.timelineStart;
        const clipEnd = clip.timelineStart + clip.clipDuration;

        // Only schedule if clip touches playback window
        if (clipEnd <= startSec) return;

        const source = ctx.createBufferSource();
        source.buffer = clip.audioBuffer;

        const clipGain = ctx.createGain();
        const baseGain = Math.pow(10, clip.gainDb / 20);
        clipGain.gain.value = baseGain;

        source.connect(clipGain);
        clipGain.connect(trackGainNode);

        // Calculate schedule times
        let when = startTime;
        let offset = clip.clipOffset;
        let duration = clip.clipDuration;

        if (startSec > clipStart) {
          // Playback starts mid-clip
          const passed = startSec - clipStart;
          offset += passed;
          duration -= passed;
          when = startTime;
        } else {
          // Playback starts before clip
          when = startTime + (clipStart - startSec);
        }

        // Apply Fade-In and Fade-Out automation
        const clipScheduleStart = when;
        const clipScheduleEnd = when + duration;

        if (clip.fadeInDuration > 0 && startSec <= clipStart) {
          clipGain.gain.setValueAtTime(0.0001, clipScheduleStart);
          clipGain.gain.exponentialRampToValueAtTime(baseGain, clipScheduleStart + clip.fadeInDuration);
        }

        if (clip.fadeOutDuration > 0) {
          const fadeOutStart = clipScheduleEnd - clip.fadeOutDuration;
          if (fadeOutStart > clipScheduleStart) {
            clipGain.gain.setValueAtTime(baseGain, fadeOutStart);
            clipGain.gain.exponentialRampToValueAtTime(0.0001, clipScheduleEnd);
          }
        }

        try {
          source.start(when, offset, duration);
          this.activeSources.set(`${clip.id}-${Date.now()}`, { source, gainNode: clipGain });
        } catch (e) {
          console.error("Error scheduling audio source:", e);
        }
      });
    });
  }

  public stopAll() {
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.masterInputGain) {
        this.masterInputGain.gain.cancelScheduledValues(now);
        this.masterInputGain.gain.setValueAtTime(0, now);
        this.masterInputGain.gain.setValueAtTime(1, now + 0.015);
      }
    }

    this.activeSources.forEach(({ source, gainNode }) => {
      try {
        if (this.ctx) {
          gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
          gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        source.stop(0);
        source.disconnect();
      } catch {
        // already stopped
      }
    });
    this.activeSources.clear();
    this.isRunning = false;
  }

  public getAnalyserData(): {
    waveform: Uint8Array;
    frequency: Uint8Array;
    lufs: number;
    peakDb: number;
    limiterReductionDb: number;
  } {
    if (!this.analyser) {
      return {
        waveform: new Uint8Array(128),
        frequency: new Uint8Array(128),
        lufs: -70,
        peakDb: -70,
        limiterReductionDb: 0
      };
    }

    const timeData = new Uint8Array(this.analyser.frequencyBinCount);
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(timeData);
    this.analyser.getByteFrequencyData(freqData);

    // Compute RMS and True Peak
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < timeData.length; i++) {
      const norm = (timeData[i] - 128) / 128;
      const abs = Math.abs(norm);
      if (abs > peak) peak = abs;
      sum += norm * norm;
    }

    const rms = Math.sqrt(sum / timeData.length);
    const rmsDb = rms > 0.00001 ? 20 * Math.log10(rms) : -70;
    const peakDb = peak > 0.00001 ? 20 * Math.log10(peak) : -70;

    // Approximate integrated/short-term LUFS (K-weighting offset ~ -0.691)
    const instantLufs = Math.max(-70, Math.min(0, rmsDb - 0.7));
    // Smooth meter readings
    this.currentLufs = this.currentLufs * 0.85 + instantLufs * 0.15;
    this.currentPeakDb = Math.max(peakDb, this.currentPeakDb * 0.9);

    const grDb = this.truePeakLimiter ? Math.min(0, this.truePeakLimiter.reduction) : 0;

    return {
      waveform: timeData,
      frequency: freqData,
      lufs: this.currentLufs,
      peakDb: this.currentPeakDb,
      limiterReductionDb: grDb
    };
  }
}

export const dspEngine = new SpliceItDspEngine();
