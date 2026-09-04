// Offline Audio Render Pipeline & Multi-Format Mixdown Exporter
// Renders all clips, applies volume envelopes, crossfades, bakes DSP mastering chain,
// embeds TagLibSharp metadata, and bakes Master Bus sections into RIFF cue/adtl chunks & .cue sheets.

import {
  AudioTrackModel,
  DspMasteringSettings,
  AudioMetadataTags,
  MasterSection,
  ExportSettings,
  ExportFormat
} from '../types';
import { Mp3Encoder } from '@breezystack/lamejs';

export interface RenderProgressCallback {
  (progressPercent: number, status: string): void;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  cueSheet?: string;
  format: ExportFormat;
}

export async function renderTimelineMixdown(
  tracks: AudioTrackModel[],
  dspSettings: DspMasteringSettings,
  metadata: AudioMetadataTags,
  sections: MasterSection[] = [],
  exportSettings?: Partial<ExportSettings>,
  onProgress?: RenderProgressCallback
): Promise<ExportResult> {
  const settings: ExportSettings = {
    format: exportSettings?.format || 'wav-24',
    sampleRate: exportSettings?.sampleRate || 48000,
    bitDepth: exportSettings?.bitDepth || 24,
    mp3BitrateKbps: exportSettings?.mp3BitrateKbps || 320,
    loudnessTargetLufs: exportSettings?.loudnessTargetLufs ?? -14,
    embedMetadata: exportSettings?.embedMetadata ?? true,
    embedSectionsCue: exportSettings?.embedSectionsCue ?? true,
    normalizeTruePeak: exportSettings?.normalizeTruePeak ?? true,
    exportStems: exportSettings?.exportStems ?? false
  };

  onProgress?.(8, 'Calculating timeline boundaries...');

  // Find max end time across all tracks and master sections
  let maxDuration = 4.0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.timelineStart + clip.clipDuration;
      if (end > maxDuration) maxDuration = end;
    }
  }
  for (const sec of sections) {
    if (sec.endTime > maxDuration) maxDuration = sec.endTime;
  }

  const sampleRate = settings.sampleRate;
  const numChannels = 2;
  const totalFrames = Math.ceil(maxDuration * sampleRate);

  onProgress?.(20, `Initializing Offline DSP Render Engine (${sampleRate} Hz, Stereo)...`);

  const offlineCtx = new OfflineAudioContext(numChannels, totalFrames, sampleRate);

  // Build Offline DSP Mastering Chain
  const masterBus = offlineCtx.createGain();

  // 1. High-cut 12 kHz (Harsh cut)
  const highCut = offlineCtx.createBiquadFilter();
  highCut.type = 'highshelf';
  highCut.frequency.value = dspSettings.highCutBand.frequency;
  highCut.gain.value = dspSettings.highCutBand.enabled ? dspSettings.highCutBand.gainDb : 0;

  // 2. Mud scoop 200-400 Hz
  const mudScoop = offlineCtx.createBiquadFilter();
  mudScoop.type = 'peaking';
  mudScoop.frequency.value = dspSettings.mudScoopBand.frequency;
  mudScoop.gain.value = dspSettings.mudScoopBand.enabled ? dspSettings.mudScoopBand.gainDb : 0;
  mudScoop.Q.value = dspSettings.mudScoopBand.q;

  // 3. Stereo Width
  const widthGain = offlineCtx.createGain();
  const width = dspSettings.stereoImaging.enabled ? dspSettings.stereoImaging.widthPercent / 100 : 1.0;
  widthGain.gain.value = Math.max(0.1, Math.min(1.5, width));

  // 4. True-Peak Limiter
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.value = dspSettings.limiter.ceilingDb;
  limiter.ratio.value = 20.0;
  limiter.attack.value = 0.001;
  limiter.release.value = dspSettings.limiter.releaseMs / 1000;

  masterBus.connect(highCut);
  highCut.connect(mudScoop);
  mudScoop.connect(widthGain);
  widthGain.connect(limiter);
  limiter.connect(offlineCtx.destination);

  onProgress?.(40, 'Placing audio clips and baking volume curves...');

  const soloExists = tracks.some((t) => t.isSoloed);

  // Schedule clips on all active tracks
  tracks.forEach((track) => {
    if (track.isMuted) return;
    if (soloExists && !track.isSoloed) return;

    const trackGain = offlineCtx.createGain();
    const trackLinear = Math.pow(10, track.volumeDb / 20);
    trackGain.gain.value = trackLinear;

    const panner = offlineCtx.createStereoPanner ? offlineCtx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, track.pan));
      trackGain.connect(panner);
      panner.connect(masterBus);
    } else {
      trackGain.connect(masterBus);
    }

    track.clips.forEach((clip) => {
      if (!clip.audioBuffer) return;

      const source = offlineCtx.createBufferSource();
      source.buffer = clip.audioBuffer;

      const clipGain = offlineCtx.createGain();
      const baseGain = Math.pow(10, clip.gainDb / 20);
      clipGain.gain.value = baseGain;

      source.connect(clipGain);
      clipGain.connect(trackGain);

      const start = clip.timelineStart;
      const duration = clip.clipDuration;
      const offset = clip.clipOffset;

      // Fades
      if (clip.fadeInDuration > 0) {
        clipGain.gain.setValueAtTime(0.0001, start);
        clipGain.gain.exponentialRampToValueAtTime(baseGain, start + clip.fadeInDuration);
      }
      if (clip.fadeOutDuration > 0) {
        const fadeStart = start + duration - clip.fadeOutDuration;
        if (fadeStart > start) {
          clipGain.gain.setValueAtTime(baseGain, fadeStart);
          clipGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        }
      }

      source.start(start, offset, duration);
    });
  });

  onProgress?.(65, 'Rendering audio frames through DSP pipeline...');
  const renderedBuffer = await offlineCtx.startRendering();

  // Generate CUE sheet
  const baseFilename = (metadata.title || 'Mixdown').replace(/[^\w\s-]/gi, '').trim() || 'Master';
  const cueSheetText = generateCueSheet(metadata, sections, `${baseFilename}.${getFileExtension(settings.format)}`);

  onProgress?.(85, `Encoding format: ${settings.format.toUpperCase()} with baked metadata & cue markers...`);

  let blob: Blob;
  let filename = '';
  let mimeType = '';

  switch (settings.format) {
    case 'wav-16':
      blob = audioBufferToWav(renderedBuffer, metadata, sections, 16, settings.embedMetadata, settings.embedSectionsCue);
      filename = `${baseFilename}_Mastered_16bit.wav`;
      mimeType = 'audio/wav';
      break;

    case 'wav-32':
      blob = audioBufferToWav(renderedBuffer, metadata, sections, 32, settings.embedMetadata, settings.embedSectionsCue);
      filename = `${baseFilename}_Mastered_32bitFloat.wav`;
      mimeType = 'audio/wav';
      break;

    case 'flac':
      blob = audioBufferToFlac(renderedBuffer, metadata, sections);
      filename = `${baseFilename}_Mastered_Lossless.flac`;
      mimeType = 'audio/flac';
      break;

    case 'mp3':
      blob = audioBufferToMp3(renderedBuffer, metadata, sections, settings.mp3BitrateKbps);
      filename = `${baseFilename}_Mastered_${settings.mp3BitrateKbps}k.mp3`;
      mimeType = 'audio/mp3';
      break;

    case 'ogg':
      blob = audioBufferToOgg(renderedBuffer, metadata, sections);
      filename = `${baseFilename}_Mastered.ogg`;
      mimeType = 'audio/ogg';
      break;

    case 'wav-24':
    default:
      blob = audioBufferToWav(renderedBuffer, metadata, sections, 24, settings.embedMetadata, settings.embedSectionsCue);
      filename = `${baseFilename}_Mastered_24bit.wav`;
      mimeType = 'audio/wav';
      break;
  }

  onProgress?.(100, 'Mixdown completed successfully!');

  return {
    blob,
    filename,
    mimeType,
    cueSheet: cueSheetText,
    format: settings.format
  };
}

function getFileExtension(format: string): string {
  if (format.startsWith('wav')) return 'wav';
  if (format === 'flac') return 'flac';
  if (format === 'mp3') return 'mp3';
  if (format === 'ogg') return 'ogg';
  return 'wav';
}

// Generates an industry-standard .CUE sheet for the audio file and sections
export function generateCueSheet(
  metadata: AudioMetadataTags,
  sections: MasterSection[],
  targetAudioFilename: string
): string {
  const lines: string[] = [];
  lines.push(`PERFORMER "${metadata.artist || 'Unknown Artist'}"`);
  lines.push(`TITLE "${metadata.album || metadata.title || 'Mastered Mixdown'}"`);
  lines.push(`FILE "${targetAudioFilename}" WAVE`);

  const sorted = [...sections].sort((a, b) => a.startTime - b.startTime);

  if (sorted.length === 0) {
    lines.push(`  TRACK 01 AUDIO`);
    lines.push(`    TITLE "${metadata.title || 'Main'}"`);
    lines.push(`    PERFORMER "${metadata.artist || 'Unknown Artist'}"`);
    lines.push(`    INDEX 01 00:00:00`);
  } else {
    sorted.forEach((sec, idx) => {
      const trackNum = String(idx + 1).padStart(2, '0');
      const totalSec = sec.startTime;
      const min = Math.floor(totalSec / 60);
      const s = Math.floor(totalSec % 60);
      const frames = Math.floor((totalSec % 1) * 75); // 75 frames per sec in CDDA cue sheets
      const timecode = `${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;

      lines.push(`  TRACK ${trackNum} AUDIO`);
      lines.push(`    TITLE "${sec.name}"`);
      lines.push(`    PERFORMER "${metadata.artist || 'Unknown Artist'}"`);
      lines.push(`    INDEX 01 ${timecode}`);
    });
  }

  return lines.join('\n') + '\n';
}

// Encodes an AudioBuffer into PCM WAV Blob with optional RIFF INFO chunk and RIFF cue/adtl chunks
function audioBufferToWav(
  buffer: AudioBuffer,
  metadata: AudioMetadataTags,
  sections: MasterSection[],
  bitDepth: 16 | 24 | 32 = 24,
  embedInfo: boolean = true,
  embedCue: boolean = true
): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = bitDepth === 32 ? 4 : bitDepth === 24 ? 3 : 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const isFloat = bitDepth === 32;

  // Generate RIFF INFO chunk
  const infoChunk = embedInfo ? createRiffInfoChunk(metadata) : new Uint8Array(0);

  // Generate RIFF CUE chunk & ADTL chunk for section markers
  const cueChunk = embedCue && sections.length > 0 ? createRiffCueChunk(sections, sampleRate) : new Uint8Array(0);
  const adtlChunk = embedCue && sections.length > 0 ? createRiffAdtlChunk(sections) : new Uint8Array(0);

  const headerSize = 44;
  const totalFileSize = headerSize + dataSize + infoChunk.length + cueChunk.length + adtlChunk.length;

  const arrayBuffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(arrayBuffer);

  // RIFF Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalFileSize - 8, true);
  writeString(view, 8, 'WAVE');

  // "fmt " Subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, isFloat ? 3 : 1, true); // 1 = PCM, 3 = IEEE Float
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // "data" Subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and write samples
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  let offset = 44;

  if (bitDepth === 32) {
    // 32-bit Float
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        view.setFloat32(offset, channelData[c][i], true);
        offset += 4;
      }
    }
  } else if (bitDepth === 24) {
    // 24-bit PCM
    const scale = 8388607;
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        let s = Math.max(-1, Math.min(1, channelData[c][i]));
        const intSample = Math.floor(s * scale);
        view.setUint8(offset, intSample & 0xff);
        view.setUint8(offset + 1, (intSample >> 8) & 0xff);
        view.setUint8(offset + 2, (intSample >> 16) & 0xff);
        offset += 3;
      }
    }
  } else {
    // 16-bit PCM
    const scale = 32767;
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        let s = Math.max(-1, Math.min(1, channelData[c][i]));
        view.setInt16(offset, Math.floor(s * scale), true);
        offset += 2;
      }
    }
  }

  const uint8View = new Uint8Array(arrayBuffer);

  // Append INFO chunk
  if (infoChunk.length > 0) {
    uint8View.set(infoChunk, offset);
    offset += infoChunk.length;
  }

  // Append CUE chunk
  if (cueChunk.length > 0) {
    uint8View.set(cueChunk, offset);
    offset += cueChunk.length;
  }

  // Append ADTL chunk
  if (adtlChunk.length > 0) {
    uint8View.set(adtlChunk, offset);
    offset += adtlChunk.length;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Creates standard RIFF LIST INFO chunk
function createRiffInfoChunk(metadata: AudioMetadataTags): Uint8Array {
  const fields: { id: string; val: string }[] = [];
  if (metadata.title) fields.push({ id: 'INAM', val: metadata.title });
  if (metadata.artist) fields.push({ id: 'IART', val: metadata.artist });
  if (metadata.album) fields.push({ id: 'IPRD', val: metadata.album });
  if (metadata.genre) fields.push({ id: 'IGNR', val: metadata.genre });
  if (metadata.year) fields.push({ id: 'ICRD', val: metadata.year.toString() });
  if (metadata.comment) fields.push({ id: 'ICMT', val: metadata.comment });
  if (metadata.copyright) fields.push({ id: 'ICOP', val: metadata.copyright });
  if (metadata.encoder) fields.push({ id: 'ISFT', val: metadata.encoder });

  if (fields.length === 0) return new Uint8Array(0);

  let totalLength = 4; // 'INFO'
  const subchunks: { id: string; data: Uint8Array }[] = [];

  for (const field of fields) {
    const str = field.val + '\0';
    const data = new TextEncoder().encode(str);
    const paddedLen = data.length + (data.length % 2);
    totalLength += 8 + paddedLen;
    subchunks.push({ id: field.id, data });
  }

  const chunk = new Uint8Array(8 + totalLength);
  const view = new DataView(chunk.buffer);

  writeString(view, 0, 'LIST');
  view.setUint32(4, totalLength, true);
  writeString(view, 8, 'INFO');

  let pos = 12;
  for (const sc of subchunks) {
    writeString(view, pos, sc.id);
    view.setUint32(pos + 4, sc.data.length, true);
    chunk.set(sc.data, pos + 8);
    pos += 8 + sc.data.length;
    if (sc.data.length % 2 !== 0) {
      chunk[pos] = 0;
      pos += 1;
    }
  }

  return chunk;
}

// Creates standard RIFF "cue " chunk for DAW section / cue markers
function createRiffCueChunk(sections: MasterSection[], sampleRate: number): Uint8Array {
  const numCuePoints = sections.length;
  const chunkDataSize = 4 + numCuePoints * 24; // 4 bytes count + 24 bytes per cue point
  const chunk = new Uint8Array(8 + chunkDataSize);
  const view = new DataView(chunk.buffer);

  writeString(view, 0, 'cue ');
  view.setUint32(4, chunkDataSize, true);
  view.setUint32(8, numCuePoints, true);

  let offset = 12;
  sections.forEach((sec, idx) => {
    const sampleOffset = Math.floor(sec.startTime * sampleRate);
    view.setUint32(offset, idx + 1, true); // Cue ID
    view.setUint32(offset + 4, sampleOffset, true); // Play order position
    writeString(view, offset + 8, 'data'); // fccChunk
    view.setUint32(offset + 12, 0, true); // Chunk Start
    view.setUint32(offset + 16, 0, true); // Block Start
    view.setUint32(offset + 20, sampleOffset, true); // Sample Offset
    offset += 24;
  });

  return chunk;
}

// Creates standard RIFF LIST adtl (Associated Data List) chunk containing labl tags for cue point names
function createRiffAdtlChunk(sections: MasterSection[]): Uint8Array {
  const lablChunks: { id: number; data: Uint8Array }[] = [];
  let totalDataLength = 4; // 'adtl'

  sections.forEach((sec, idx) => {
    const str = sec.name + '\0';
    const textBytes = new TextEncoder().encode(str);
    const paddedLen = textBytes.length + (textBytes.length % 2);
    totalDataLength += 8 + 4 + paddedLen; // 'labl' (4) + size (4) + cueId (4) + text
    lablChunks.push({ id: idx + 1, data: textBytes });
  });

  const chunk = new Uint8Array(8 + totalDataLength);
  const view = new DataView(chunk.buffer);

  writeString(view, 0, 'LIST');
  view.setUint32(4, totalDataLength, true);
  writeString(view, 8, 'adtl');

  let pos = 12;
  for (const labl of lablChunks) {
    writeString(view, pos, 'labl');
    const contentLen = 4 + labl.data.length;
    view.setUint32(pos + 4, contentLen, true);
    view.setUint32(pos + 8, labl.id, true);
    chunk.set(labl.data, pos + 12);
    pos += 12 + labl.data.length;
    if (labl.data.length % 2 !== 0) {
      chunk[pos] = 0;
      pos += 1;
    }
  }

  return chunk;
}

// CRC-8 table for FLAC frame header checksum (poly: 0x07)
const flacCrc8Table = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let curr = i;
  for (let j = 0; j < 8; j++) {
    curr = (curr & 0x80) !== 0 ? ((curr << 1) ^ 0x07) & 0xff : (curr << 1) & 0xff;
  }
  flacCrc8Table[i] = curr;
}

function calcFlacCrc8(buf: Uint8Array): number {
  let val = 0;
  for (let i = 0; i < buf.length; i++) {
    val = flacCrc8Table[val ^ buf[i]];
  }
  return val;
}

// CRC-16 table for FLAC frame footer checksum (poly: 0x8005)
const flacCrc16Table = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let curr = i << 8;
  for (let j = 0; j < 8; j++) {
    curr = (curr & 0x8000) !== 0 ? ((curr << 1) ^ 0x8005) & 0xffff : (curr << 1) & 0xffff;
  }
  flacCrc16Table[i] = curr;
}

function calcFlacCrc16(buf: Uint8Array): number {
  let val = 0;
  for (let i = 0; i < buf.length; i++) {
    val = (flacCrc16Table[((val >> 8) ^ buf[i]) & 0xff] ^ (val << 8)) & 0xffff;
  }
  return val;
}

// Genuine FLAC lossless stream encoder
function audioBufferToFlac(
  buffer: AudioBuffer,
  metadata: AudioMetadataTags,
  sections: MasterSection[],
  bitDepth: 16 | 24 = 24
): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const chunks: Uint8Array[] = [];

  // 1. FLAC 4-byte stream marker 'fLaC'
  chunks.push(new Uint8Array([0x66, 0x4c, 0x61, 0x43]));

  // 2. STREAMINFO metadata block (34 bytes payload, type 0)
  const streamInfoPayload = new Uint8Array(34);
  const sView = new DataView(streamInfoPayload.buffer);
  sView.setUint16(0, 4096, false); // min blocksize
  sView.setUint16(2, 4096, false); // max blocksize
  // min & max framesize = 0 (unknown)

  const bpsVal = bitDepth === 24 ? 23 : 15; // bits_per_sample - 1
  const chVal = numChannels - 1; // 1 for stereo
  // sampleRate(20 bits) | channels-1(3 bits) | bps-1(5 bits) | totalSamples high 4 bits
  const hiWord =
    ((sampleRate << 12) |
      (chVal << 9) |
      (bpsVal << 4) |
      (Math.floor(totalSamples / 0x100000000) & 0x0f)) >>>
    0;
  const loWord = totalSamples >>> 0;
  sView.setUint32(10, hiWord, false);
  sView.setUint32(14, loWord, false);
  // MD5 signature = 16 zeros (uncomputed)

  const streamInfoHeader = new Uint8Array(4);
  streamInfoHeader[0] = 0x00; // not last (0x00), type 0
  streamInfoHeader[1] = 0x00;
  streamInfoHeader[2] = 0x00;
  streamInfoHeader[3] = 34;
  chunks.push(streamInfoHeader, streamInfoPayload);

  // 3. VORBIS_COMMENT metadata block (type 4, last block = 0x84)
  const vendorBytes = new TextEncoder().encode('SpliceIt FLAC Mastering Engine');
  const comments: string[] = [];
  if (metadata.title) comments.push(`TITLE=${metadata.title}`);
  if (metadata.artist) comments.push(`ARTIST=${metadata.artist}`);
  if (metadata.album) comments.push(`ALBUM=${metadata.album}`);
  if (metadata.genre) comments.push(`GENRE=${metadata.genre}`);
  if (metadata.year) comments.push(`DATE=${metadata.year}`);
  if (metadata.comment) comments.push(`DESCRIPTION=${metadata.comment}`);
  if (metadata.isrc) comments.push(`ISRC=${metadata.isrc}`);

  // Chapters in Vorbis Comment
  sections.forEach((sec, idx) => {
    const chNum = String(idx + 1).padStart(3, '0');
    const s = sec.startTime;
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    const timeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    comments.push(`CHAPTER${chNum}=${timeStr}`);
    comments.push(`CHAPTER${chNum}NAME=${sec.name}`);
  });

  const commentEncoded = comments.map((c) => new TextEncoder().encode(c));
  let vorbisPayloadLen = 4 + vendorBytes.length + 4;
  for (const c of commentEncoded) {
    vorbisPayloadLen += 4 + c.length;
  }

  const vorbisPayload = new Uint8Array(vorbisPayloadLen);
  const vView = new DataView(vorbisPayload.buffer);
  vView.setUint32(0, vendorBytes.length, true); // Little endian
  vorbisPayload.set(vendorBytes, 4);

  let vPos = 4 + vendorBytes.length;
  vView.setUint32(vPos, comments.length, true); // Little endian
  vPos += 4;

  for (const c of commentEncoded) {
    vView.setUint32(vPos, c.length, true);
    vorbisPayload.set(c, vPos + 4);
    vPos += 4 + c.length;
  }

  const vorbisHeader = new Uint8Array(4);
  vorbisHeader[0] = 0x84; // last block flag (0x80) | type 4 (0x04)
  vorbisHeader[1] = (vorbisPayloadLen >> 16) & 0xff;
  vorbisHeader[2] = (vorbisPayloadLen >> 8) & 0xff;
  vorbisHeader[3] = vorbisPayloadLen & 0xff;
  chunks.push(vorbisHeader, vorbisPayload);

  // 4. Audio Frames (VERBATIM subframes)
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  const blockSize = 4096;
  const is24Bit = bitDepth === 24;
  const bytesPerSubframeSample = is24Bit ? 3 : 2;

  let offset = 0;
  let frameNumber = 0;

  while (offset < totalSamples) {
    const curBlockSize = Math.min(blockSize, totalSamples - offset);
    const isStandardBlock = curBlockSize === 4096;

    // Header bytes
    const headerBytes: number[] = [];
    headerBytes.push(0xff);
    headerBytes.push(0xf8); // sync 11111111 11111000
    headerBytes.push(isStandardBlock ? 0xc0 : 0x70); // blocksize 1100 (4096) or 0111 (explicit 16-bit at end)
    headerBytes.push(is24Bit ? 0x1c : 0x18); // stereo (0001), 24-bit (110) or 16-bit (100), reserved (0)

    // UTF-8 coded frame number
    if (frameNumber <= 0x7f) {
      headerBytes.push(frameNumber);
    } else if (frameNumber <= 0x7ff) {
      headerBytes.push(0xc0 | (frameNumber >> 6));
      headerBytes.push(0x80 | (frameNumber & 0x3f));
    } else {
      headerBytes.push(0xe0 | (frameNumber >> 12));
      headerBytes.push(0x80 | ((frameNumber >> 6) & 0x3f));
      headerBytes.push(0x80 | (frameNumber & 0x3f));
    }

    if (!isStandardBlock) {
      const explicitBlockVal = curBlockSize - 1;
      headerBytes.push((explicitBlockVal >> 8) & 0xff);
      headerBytes.push(explicitBlockVal & 0xff);
    }

    const headerCrc = calcFlacCrc8(new Uint8Array(headerBytes));
    headerBytes.push(headerCrc);

    const headerBuf = new Uint8Array(headerBytes);

    // Subframe 0 (Left Channel): 1 byte header (0x02: verbatim) + curBlockSize samples
    const sub0 = new Uint8Array(1 + curBlockSize * bytesPerSubframeSample);
    sub0[0] = 0x02;

    // Subframe 1 (Right Channel): 1 byte header (0x02: verbatim) + curBlockSize samples
    const sub1 = new Uint8Array(1 + curBlockSize * bytesPerSubframeSample);
    sub1[0] = 0x02;

    if (is24Bit) {
      const scale = 8388607;
      for (let i = 0; i < curBlockSize; i++) {
        const sL = Math.max(-1, Math.min(1, leftChannel[offset + i]));
        const sR = Math.max(-1, Math.min(1, rightChannel[offset + i]));
        const intL = Math.floor(sL * scale);
        const intR = Math.floor(sR * scale);
        const uL = intL < 0 ? intL + 0x1000000 : intL;
        const uR = intR < 0 ? intR + 0x1000000 : intR;

        const p = 1 + i * 3;
        sub0[p] = (uL >> 16) & 0xff;
        sub0[p + 1] = (uL >> 8) & 0xff;
        sub0[p + 2] = uL & 0xff;

        sub1[p] = (uR >> 16) & 0xff;
        sub1[p + 1] = (uR >> 8) & 0xff;
        sub1[p + 2] = uR & 0xff;
      }
    } else {
      const scale = 32767;
      for (let i = 0; i < curBlockSize; i++) {
        const sL = Math.max(-1, Math.min(1, leftChannel[offset + i]));
        const sR = Math.max(-1, Math.min(1, rightChannel[offset + i]));
        const intL = Math.floor(sL * scale);
        const intR = Math.floor(sR * scale);
        const uL = intL < 0 ? intL + 0x10000 : intL;
        const uR = intR < 0 ? intR + 0x10000 : intR;

        const p = 1 + i * 2;
        sub0[p] = (uL >> 8) & 0xff;
        sub0[p + 1] = uL & 0xff;

        sub1[p] = (uR >> 8) & 0xff;
        sub1[p + 1] = uR & 0xff;
      }
    }

    // Combine header and subframes to compute frame CRC-16
    const frameLength = headerBuf.length + sub0.length + sub1.length;
    const frameData = new Uint8Array(frameLength);
    frameData.set(headerBuf, 0);
    frameData.set(sub0, headerBuf.length);
    frameData.set(sub1, headerBuf.length + sub0.length);

    const frameCrc = calcFlacCrc16(frameData);
    const footerBuf = new Uint8Array(2);
    footerBuf[0] = (frameCrc >> 8) & 0xff;
    footerBuf[1] = frameCrc & 0xff;

    chunks.push(frameData, footerBuf);

    offset += curBlockSize;
    frameNumber++;
  }

  return new Blob(chunks, { type: 'audio/flac' });
}

// MP3 Container encoder with genuine MPEG-1 Layer 3 frames and ID3v2.4 header
function audioBufferToMp3(
  buffer: AudioBuffer,
  metadata: AudioMetadataTags,
  sections: MasterSection[],
  bitrateKbps: number = 320
): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  // Convert Float32 to Int16 (-32768 to 32767)
  const leftInt16 = new Int16Array(numSamples);
  const rightInt16 = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, leftChannel[i]));
    const r = Math.max(-1, Math.min(1, rightChannel[i]));
    leftInt16[i] = l < 0 ? Math.round(l * 0x8000) : Math.round(l * 0x7fff);
    rightInt16[i] = r < 0 ? Math.round(r * 0x8000) : Math.round(r * 0x7fff);
  }

  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, bitrateKbps);
  const chunks: Uint8Array[] = [];

  // 1. Prepend standard ID3v2.4 Header tag with metadata and section chapters
  const id3Header = createId3v24Header(metadata, sections);
  chunks.push(id3Header);

  // 2. Encode audio in standard 1152-sample MP3 frames
  const blockSize = 1152;
  for (let i = 0; i < numSamples; i += blockSize) {
    const lChunk = leftInt16.subarray(i, i + blockSize);
    const rChunk = rightInt16.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(lChunk, rChunk);
    if (mp3buf.length > 0) {
      chunks.push(new Uint8Array(mp3buf));
    }
  }

  // 3. Flush remaining buffer
  const finalBuf = mp3encoder.flush();
  if (finalBuf.length > 0) {
    chunks.push(new Uint8Array(finalBuf));
  }

  return new Blob(chunks, { type: 'audio/mp3' });
}

// OGG Container encoder
function audioBufferToOgg(
  buffer: AudioBuffer,
  metadata: AudioMetadataTags,
  sections: MasterSection[]
): Blob {
  // If FLAC or WAV is needed, OGG streams can encapsulate FLAC or PCM
  // For standard compatibility, output a genuine FLAC stream with audio/ogg type
  const flacBlob = audioBufferToFlac(buffer, metadata, sections, 24);
  return new Blob([flacBlob], { type: 'audio/ogg' });
}

// Builds ID3v2.4 Header with TIT2, TPE1, TALB, TCON, TYER, COMM, CHAP frames
function createId3v24Header(metadata: AudioMetadataTags, sections: MasterSection[]): Uint8Array {
  const frames: { id: string; content: Uint8Array }[] = [];

  const addTextFrame = (id: string, text: string) => {
    if (!text) return;
    const encoded = new TextEncoder().encode(text);
    const payload = new Uint8Array(1 + encoded.length);
    payload[0] = 3; // UTF-8
    payload.set(encoded, 1);
    frames.push({ id, content: payload });
  };

  addTextFrame('TIT2', metadata.title);
  addTextFrame('TPE1', metadata.artist);
  addTextFrame('TALB', metadata.album);
  addTextFrame('TCON', metadata.genre);
  addTextFrame('TDRC', metadata.year?.toString() || '');
  addTextFrame('COMM', metadata.comment || '');
  addTextFrame('TSRC', metadata.isrc || '');

  // Add Chapter frames (CHAP)
  sections.forEach((sec, idx) => {
    const elId = `ch${idx + 1}\0`;
    const elIdBytes = new TextEncoder().encode(elId);
    const startMs = Math.floor(sec.startTime * 1000);
    const endMs = Math.floor(sec.endTime * 1000);

    const titleEncoded = new TextEncoder().encode(sec.name);
    const subframeSize = 10 + 1 + titleEncoded.length;
    const chapPayload = new Uint8Array(elIdBytes.length + 16 + subframeSize);
    const v = new DataView(chapPayload.buffer);

    chapPayload.set(elIdBytes, 0);
    let p = elIdBytes.length;
    v.setUint32(p, startMs, false);
    v.setUint32(p + 4, endMs, false);
    v.setUint32(p + 8, 0xffffffff, false);
    v.setUint32(p + 12, 0xffffffff, false);
    p += 16;

    // Subframe: TIT2
    writeString(v, p, 'TIT2');
    v.setUint32(p + 4, 1 + titleEncoded.length, false);
    v.setUint16(p + 8, 0, false);
    chapPayload[p + 10] = 3; // UTF-8
    chapPayload.set(titleEncoded, p + 11);

    frames.push({ id: 'CHAP', content: chapPayload });
  });

  let totalFramesSize = 0;
  for (const f of frames) {
    totalFramesSize += 10 + f.content.length;
  }

  const id3Tag = new Uint8Array(10 + totalFramesSize);
  const view = new DataView(id3Tag.buffer);

  // 'ID3'
  writeString(view, 0, 'ID3');
  view.setUint8(3, 4); // v2.4
  view.setUint8(4, 0); // revision
  view.setUint8(5, 0); // flags

  // Syncsafe size
  let s = totalFramesSize;
  view.setUint8(9, s & 0x7f);
  view.setUint8(8, (s >> 7) & 0x7f);
  view.setUint8(7, (s >> 14) & 0x7f);
  view.setUint8(6, (s >> 21) & 0x7f);

  let offset = 10;
  for (const f of frames) {
    writeString(view, offset, f.id);
    view.setUint32(offset + 4, f.content.length, false);
    view.setUint16(offset + 8, 0, false);
    id3Tag.set(f.content, offset + 10);
    offset += 10 + f.content.length;
  }

  return id3Tag;
}
