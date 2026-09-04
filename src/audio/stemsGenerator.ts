// Web Audio Procedural Multi-track Stem Generator
// Generates studio-quality 4-bar loops for Drums, Bass, Synth, and Ambience/Pad

export interface GeneratedStem {
  buffer: AudioBuffer;
  peaks: number[];
}

export async function generateStudioStems(audioCtx: AudioContext): Promise<{
  drums: GeneratedStem;
  bass: GeneratedStem;
  synth: GeneratedStem;
  ambient: GeneratedStem;
}> {
  const sampleRate = audioCtx.sampleRate || 44100;
  const bpm = 124;
  const beatsPerBar = 4;
  const totalBars = 4;
  const totalBeats = totalBars * beatsPerBar;
  const duration = (totalBeats * 60) / bpm; // ~7.74 seconds
  const totalFrames = Math.floor(sampleRate * duration);

  // 1. Render Drums (Kick, Snare, Hihats)
  const drumsBuffer = audioCtx.createBuffer(2, totalFrames, sampleRate);
  const kickCh0 = drumsBuffer.getChannelData(0);
  const kickCh1 = drumsBuffer.getChannelData(1);
  const beatSec = 60 / bpm;

  for (let beat = 0; beat < totalBeats; beat++) {
    const beatTime = beat * beatSec;
    const startSample = Math.floor(beatTime * sampleRate);

    // Four-on-the-floor Kick
    const kickDur = 0.35;
    const kickSamples = Math.min(totalFrames - startSample, Math.floor(kickDur * sampleRate));
    for (let i = 0; i < kickSamples; i++) {
      const t = i / sampleRate;
      const freq = 130 * Math.exp(-t * 18) + 42;
      const env = Math.exp(-t * 8);
      const s = Math.sin(2 * Math.PI * freq * t) * env * 0.75;
      kickCh0[startSample + i] += s;
      kickCh1[startSample + i] += s;
    }

    // Snare / Clap on beats 2 and 4 (indices 1, 3, 5, 7, etc.)
    if (beat % 2 === 1) {
      const snareDur = 0.28;
      const snareSamples = Math.min(totalFrames - startSample, Math.floor(snareDur * sampleRate));
      for (let i = 0; i < snareSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 16) * 0.4;
        const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 22) * 0.35;
        const s = noise + body;
        kickCh0[startSample + i] += s * 0.9;
        kickCh1[startSample + i] += s * 1.1; // slight stereo spread
      }
    }

    // 16th note Hi-Hats
    for (let step = 0; step < 4; step++) {
      const hatTime = beatTime + (step * beatSec) / 4;
      const hatStart = Math.floor(hatTime * sampleRate);
      const hatDur = step % 2 === 1 ? 0.08 : 0.04;
      const hatSamples = Math.min(totalFrames - hatStart, Math.floor(hatDur * sampleRate));
      const velocity = step === 2 ? 0.35 : 0.18;
      for (let i = 0; i < hatSamples; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 40) * velocity;
        if (hatStart + i < totalFrames) {
          kickCh0[hatStart + i] += noise * 0.8;
          kickCh1[hatStart + i] += noise * 1.2;
        }
      }
    }
  }

  // 2. Render Bass (Punchy Warm Analog 808/Synth Bass)
  const bassBuffer = audioCtx.createBuffer(2, totalFrames, sampleRate);
  const bassCh0 = bassBuffer.getChannelData(0);
  const bassCh1 = bassBuffer.getChannelData(1);

  // Bass chord roots: F1 (43.65 Hz), G#1 (51.91 Hz), D#1 (38.89 Hz), C1 (32.7 Hz)
  const bassNotes = [43.65, 43.65, 51.91, 51.91, 38.89, 38.89, 32.7, 32.7, 43.65, 43.65, 51.91, 51.91, 38.89, 38.89, 32.7, 32.7];

  for (let step = 0; step < totalBeats; step++) {
    const rootFreq = bassNotes[step % bassNotes.length];
    const startSample = Math.floor(step * beatSec * sampleRate);
    const noteSamples = Math.min(totalFrames - startSample, Math.floor(beatSec * 0.85 * sampleRate));

    for (let i = 0; i < noteSamples; i++) {
      const t = i / sampleRate;
      const env = Math.sin((Math.PI * i) / noteSamples);
      // Fundamental + 2nd harmonic + sub saturation
      const wave = Math.sin(2 * Math.PI * rootFreq * t) + 0.45 * Math.sin(2 * Math.PI * rootFreq * 2 * t);
      const saturated = Math.tanh(wave * 1.4) * 0.55 * env;
      bassCh0[startSample + i] += saturated;
      bassCh1[startSample + i] += saturated;
    }
  }

  // 3. Render Synth Lead / Chords (Arpeggiated saw/square)
  const synthBuffer = audioCtx.createBuffer(2, totalFrames, sampleRate);
  const synthCh0 = synthBuffer.getChannelData(0);
  const synthCh1 = synthBuffer.getChannelData(1);

  const synthFreqs = [261.63, 311.13, 392.0, 523.25, 349.23, 440.0, 523.25, 659.25];
  const arpStepSec = beatSec / 2; // 8th notes
  const totalArpSteps = Math.floor(duration / arpStepSec);

  for (let step = 0; step < totalArpSteps; step++) {
    const freq = synthFreqs[step % synthFreqs.length];
    const startSample = Math.floor(step * arpStepSec * sampleRate);
    const noteSamples = Math.min(totalFrames - startSample, Math.floor(arpStepSec * 0.9 * sampleRate));
    const panOffset = (step % 4 - 1.5) * 0.25; // panning modulation

    for (let i = 0; i < noteSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 6);
      const saw = (2 * ((freq * t) % 1) - 1) * 0.28;
      const sine = Math.sin(2 * Math.PI * freq * t) * 0.2;
      const s = (saw + sine) * env;
      synthCh0[startSample + i] += s * (1 - panOffset);
      synthCh1[startSample + i] += s * (1 + panOffset);
    }
  }

  // 4. Render Ambient Pad / FX Chop
  const ambientBuffer = audioCtx.createBuffer(2, totalFrames, sampleRate);
  const ambCh0 = ambientBuffer.getChannelData(0);
  const ambCh1 = ambientBuffer.getChannelData(1);

  const chordFreqs = [174.61, 220.0, 261.63, 329.63]; // Fmaj7 chord
  for (let i = 0; i < totalFrames; i++) {
    const t = i / sampleRate;
    let sL = 0;
    let sR = 0;
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);

    for (let c = 0; c < chordFreqs.length; c++) {
      const f = chordFreqs[c];
      const detune = 1 + (c % 2 === 0 ? 0.003 : -0.003);
      sL += Math.sin(2 * Math.PI * f * t) * 0.06;
      sR += Math.sin(2 * Math.PI * f * detune * t) * 0.06;
    }
    ambCh0[i] = sL * lfo;
    ambCh1[i] = sR * lfo;
  }

  return {
    drums: { buffer: drumsBuffer, peaks: extractPeaksFromBuffer(drumsBuffer, 120) },
    bass: { buffer: bassBuffer, peaks: extractPeaksFromBuffer(bassBuffer, 120) },
    synth: { buffer: synthBuffer, peaks: extractPeaksFromBuffer(synthBuffer, 120) },
    ambient: { buffer: ambientBuffer, peaks: extractPeaksFromBuffer(ambientBuffer, 120) }
  };
}

export function extractPeaksFromBuffer(buffer: AudioBuffer, numPeaks = 100): number[] {
  const channelData = buffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1, max));
  }

  return peaks;
}
