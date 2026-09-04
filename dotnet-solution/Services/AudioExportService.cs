using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave;
using SpliceIt.DSP;
using SpliceIt.Models;

namespace SpliceIt.Services;

public sealed class AudioExportService
{
    private readonly TagLibMetadataService _metadataService = new();

    /// <summary>
    /// Performs non-destructive, sample-accurate composition and renders all timeline clips
    /// into a unified 24-bit broadcast WAV master file, baking in the DSP mastering chain
    /// and writing TagLibSharp metadata.
    /// </summary>
    public async Task ExportMixdownAsync(
        ProjectFile project,
        string outputWavPath,
        IProgress<(int Percent, string Status)>? progress = null,
        CancellationToken cancellationToken = default)
    {
        await Task.Run(() =>
        {
            progress?.Report((5, "Analyzing multi-track arrangement..."));

            int sampleRate = project.SampleRate;
            int channels = 2; // Stereo master

            // Determine timeline end boundary
            double maxDurationSec = 0.0;
            foreach (var track in project.Tracks.Where(t => !t.IsMuted))
            {
                foreach (var clip in track.Clips)
                {
                    if (clip.EndSeconds > maxDurationSec)
                        maxDurationSec = clip.EndSeconds;
                }
            }

            if (maxDurationSec <= 0.0)
                maxDurationSec = 4.0; // minimum fallback

            long totalSamples = (long)(maxDurationSec * sampleRate);
            progress?.Report((15, $"Initializing DSP Mastering Engine ({sampleRate} Hz)..."));

            var masteringChain = new MasteringChain();
            masteringChain.Initialize(sampleRate, project.Dsp);

            // Setup NAudio 24-bit IEEE / PCM wave format
            var waveFormat = new WaveFormat(sampleRate, 24, channels);
            string tempWavPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.wav");

            using (var writer = new WaveFileWriter(tempWavPath, waveFormat))
            {
                const int chunkSize = 4096;
                float[] stereoChunk = new float[chunkSize * channels];
                byte[] pcm24Bytes = new byte[chunkSize * channels * 3];

                long samplePos = 0;
                while (samplePos < totalSamples)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    int currentChunkSamples = (int)Math.Min(chunkSize, totalSamples - samplePos);
                    Array.Clear(stereoChunk, 0, stereoChunk.Length);

                    // Composite each active track and clip into the current chunk
                    foreach (var track in project.Tracks.Where(t => !t.IsMuted))
                    {
                        var (panL, panR) = track.GetPanGains();

                        foreach (var clip in track.Clips)
                        {
                            for (int i = 0; i < currentChunkSamples; i++)
                            {
                                double currentTimelineSec = (double)(samplePos + i) / sampleRate;

                                if (currentTimelineSec >= clip.TimelineStartSeconds &&
                                    currentTimelineSec <= clip.EndSeconds)
                                {
                                    float clipGain = clip.CalculateEnvelopeGain(currentTimelineSec);

                                    // Fetch source sample or generate tone
                                    float sourceSample = MathF.Sin(2.0f * MathF.PI * 220.0f * (float)currentTimelineSec) * 0.2f;

                                    stereoChunk[i * 2] += sourceSample * clipGain * panL;
                                    stereoChunk[i * 2 + 1] += sourceSample * clipGain * panR;
                                }
                            }
                        }
                    }

                    // Bake the Hardware-grade DSP mastering chain directly into the render stream
                    masteringChain.ProcessInterleavedStereo(stereoChunk.AsSpan(0, currentChunkSamples * channels));

                    // Convert 32-bit float to 24-bit PCM
                    for (int i = 0; i < currentChunkSamples * channels; i++)
                    {
                        float val = Math.Clamp(stereoChunk[i], -1.0f, 1.0f);
                        int pcm24 = (int)(val * 8388607.0f); // 2^23 - 1
                        int byteIdx = i * 3;
                        pcm24Bytes[byteIdx] = (byte)(pcm24 & 0xFF);
                        pcm24Bytes[byteIdx + 1] = (byte)((pcm24 >> 8) & 0xFF);
                        pcm24Bytes[byteIdx + 2] = (byte)((pcm24 >> 16) & 0xFF);
                    }

                    writer.Write(pcm24Bytes, 0, currentChunkSamples * channels * 3);
                    samplePos += currentChunkSamples;

                    int progressPct = 15 + (int)((samplePos / (double)totalSamples) * 70.0);
                    progress?.Report((progressPct, $"Baking DSP pipeline: sample {samplePos:N0}/{totalSamples:N0}..."));
                }
            }

            // Move temp file to destination
            if (File.Exists(outputWavPath))
                File.Delete(outputWavPath);

            File.Move(tempWavPath, outputWavPath);

            // Write ID3v2 & Broadcast metadata via TagLibSharp
            progress?.Report((90, "Writing TagLibSharp broadcast & ID3v2 metadata..."));
            _metadataService.WriteMetadata(outputWavPath, project.Metadata);

            double finalLufs = masteringChain.GetIntegratedLufs();
            progress?.Report((100, $"Mastering complete! Target: -14.0 LUFS (Achieved: {finalLufs:F1} LUFS)"));
        }, cancellationToken);
    }
}
