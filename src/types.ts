// Domain Models matching C# .NET 9 Avalonia ProjectFile.cs, AudioTrack.cs, AudioClip.cs, DspSettings.cs

export type CrossfadeCurveType = 'Linear' | 'Exponential' | 'EqualPower';

export interface AudioClipModel {
  id: string;
  name: string;
  sourceFilePath: string;
  trackIndex: number;
  timelineStart: number; // in seconds
  clipOffset: number; // start offset within audio source in seconds
  clipDuration: number; // duration on timeline in seconds
  sourceDuration: number; // total duration of audio source in seconds
  gainDb: number; // clip gain in dB (-24 to +12 dB)
  fadeInDuration: number; // seconds
  fadeOutDuration: number; // seconds
  crossfadeType: CrossfadeCurveType;
  color?: string;
  // Audio waveform peaks (normalized -1 to 1 or 0 to 1) for visualization
  peaks?: number[];
  audioBuffer?: AudioBuffer;
}

export interface AudioTrackModel {
  id: string;
  name: string;
  volumeDb: number; // -60 to +6 dB
  pan: number; // -1.0 (L) to +1.0 (R)
  isMuted: boolean;
  isSoloed: boolean;
  color: string;
  clips: AudioClipModel[];
}

export interface ParametricEqBand {
  type: 'HighShelf' | 'Peaking' | 'LowPass';
  frequency: number; // Hz
  gainDb: number; // dB (-18 to +18)
  q: number; // Q factor
  enabled: boolean;
}

export interface MultibandBandSettings {
  thresholdDb: number; // -40 to 0 dB
  ratio: number; // 1:1 to 20:1
  attackMs: number;
  releaseMs: number;
  makeupGainDb: number;
}

export interface MultibandCompressorSettings {
  lowCrossoverHz: number; // default 250 Hz
  highCrossoverHz: number; // default 4000 Hz
  lowBand: MultibandBandSettings;
  midBand: MultibandBandSettings;
  highBand: MultibandBandSettings;
  enabled: boolean;
}

export interface StereoImagingSettings {
  widthPercent: number; // 0% (mono) to 200% (super stereo), 100% is unity
  enabled: boolean;
}

export interface TruePeakLimiterSettings {
  ceilingDb: number; // -0.1 to -6.0 dBFS
  releaseMs: number;
  targetLufs: number; // Standard: -14.0 LUFS
  enabled: boolean;
}

export interface DspMasteringSettings {
  enabled: boolean;
  // 12 kHz cut / shelf
  highCutBand: ParametricEqBand;
  // 200-400 Hz scoop filter
  mudScoopBand: ParametricEqBand;
  multiband: MultibandCompressorSettings;
  stereoImaging: StereoImagingSettings;
  limiter: TruePeakLimiterSettings;
}

export interface AudioMetadataTags {
  // Basic tags (TagLibSharp basic)
  title: string;
  artist: string;
  album: string;
  year: number;
  trackNumber: number;
  discNumber: number;
  genre: string;
  comment: string;
  composer: string;

  // Extended tags
  isrc: string;
  bpm: number;
  key: string;
  lyrics: string;
  copyright: string;
  publisher: string;
  encoder: string;

  // Visual
  coverArtDataUrl?: string;
  coverArtMimeType?: string;
}

export interface MasterSection {
  id: string;
  name: string;
  startTime: number; // seconds
  endTime: number; // seconds
  color: string;
}

/**
 * Master bus output state. Applied to both realtime playback and offline mixdown
 * so that what you hear is what gets rendered.
 */
export interface MasterBusState {
  volumeDb: number; // -24 to +6 dB
  isMuted: boolean;
}

/**
 * Transport loop region in seconds. Replaces the previously hardcoded 0-8s loop.
 */
export interface LoopRegion {
  startTime: number;
  endTime: number;
}

export type ExportFormat = 'wav-24' | 'wav-16' | 'wav-32' | 'flac' | 'mp3' | 'ogg';

export interface ExportSettings {
  format: ExportFormat;
  sampleRate: number; // 44100, 48000, 96000
  bitDepth: 16 | 24 | 32;
  mp3BitrateKbps: 128 | 192 | 256 | 320;
  loudnessTargetLufs: number; // -14, -16, -23, 0 (off)
  embedMetadata: boolean;
  embedSectionsCue: boolean;
  normalizeTruePeak: boolean;
  exportStems: boolean;
}

export interface SpliceItProjectFile {
  schemaVersion: string;
  appName: 'SpliceIt';
  projectFormatExtension: '.siq';
  projectName: string;
  sampleRate: number;
  tempoBpm: number;
  timeSignature: string;
  timelineLengthSeconds: number;
  tracks: AudioTrackModel[];
  dspSettings: DspMasteringSettings;
  metadata: AudioMetadataTags;
  masterSections?: MasterSection[];
  masterBus?: MasterBusState;
  loopRegion?: LoopRegion;
  savedAtUtc: string;
}

export interface LoadedAudioFile {
  id: string;
  name: string;
  fileName: string;
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  fileSize?: number;
  importedAt: string;
  audioBuffer: AudioBuffer;
  peaks: number[];
}

export type BottomInspectorTab = 'bento' | 'dsp' | 'metadata' | 'clip' | 'files' | 'csharp';
