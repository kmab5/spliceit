using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave;
using SpliceIt.Audio;
using SpliceIt.DSP;
using SpliceIt.Models;

namespace SpliceIt.Services;

public sealed class AudioExportService
{
    private readonly TagLibMetadataService _metadataService = new();

    /// <summary>
    /// Renders the timeline to a 24-bit WAV master, baking in the DSP mastering
    /// chain and writing TagLibSharp metadata.
    ///
    /// PHASE 1 REWRITE — the previous implementation never read any audio. It
    /// contained the line:
    ///
    ///     float sourceSample = MathF.Sin(2f * MathF.PI * 220f * currentTimelineSec) * 0.2f;
    ///
    /// so every export was a 220 Hz sine tone regardless of the project. It now
    /// pulls from TimelineMixerSampleProvider, the same component that feeds
    /// realtime playback, so a render cannot diverge from what was auditioned.
    /// </summary>
    public async Task ExportMixdownAsync(
        ProjectFile project,
        AudioSampleCache sampleCache,
        string outputWavPath,
        double timelineSeconds,
        double masterVolumeDb = 0.0,
        bool masterMuted = false,
        IProgress<(int Percent, string Status)>? progress = null,
        CancellationToken cancellationToken = default)
    {
        await Task.Run(() =>
        {
            progress?.Report((5, "Analyzing multi-track arrangement..."));

            int sampleRate = project.SampleRate;
            const int channels = 2;

            var mixer = new TimelineMixerSampleProvider(project, sampleCache, sampleRate, timelineSeconds)
            {
                PositionFrames = 0,
                LoopEnabled = false,
                MasterGain = masterMuted ? 0f : (float)Math.Pow(10.0, masterVolumeDb / 20.0)
            };

            long totalFrames = mixer.LengthFrames;
            if (totalFrames <= 0)
            {
                throw new InvalidOperationException(
                    "Nothing to export — the timeline is empty or no audio has been imported.");
            }

            progress?.Report((15, $"Initializing DSP Mastering Engine ({sampleRate} Hz)..."));

            var masteringChain = new MasteringChain();
            masteringChain.Initialize(sampleRate, project.Dsp);

            var waveFormat = new WaveFormat(sampleRate, 24, channels);
            string tempWavPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.wav");

            try
            {
                using (var writer = new WaveFileWriter(tempWavPath, waveFormat))
                {
                    const int chunkFrames = 4096;
                    var floatChunk = new float[chunkFrames * channels];
                    var pcm24Bytes = new byte[chunkFrames * channels * 3];

                    long framesWritten = 0;
                    int samplesRead;

                    while ((samplesRead = mixer.Read(floatChunk, 0, floatChunk.Length)) > 0)
                    {
                        cancellationToken.ThrowIfCancellationRequested();

                        // Bake the mastering chain into the render stream.
                        masteringChain.ProcessInterleavedStereo(floatChunk.AsSpan(0, samplesRead));

                        for (int i = 0; i < samplesRead; i++)
                        {
                            float val = Math.Clamp(floatChunk[i], -1.0f, 1.0f);
                            int pcm24 = (int)(val * 8388607.0f); // 2^23 - 1
                            int byteIdx = i * 3;
                            pcm24Bytes[byteIdx] = (byte)(pcm24 & 0xFF);
                            pcm24Bytes[byteIdx + 1] = (byte)((pcm24 >> 8) & 0xFF);
                            pcm24Bytes[byteIdx + 2] = (byte)((pcm24 >> 16) & 0xFF);
                        }

                        writer.Write(pcm24Bytes, 0, samplesRead * 3);

                        framesWritten += samplesRead / channels;
                        int progressPct = 15 + (int)((framesWritten / (double)totalFrames) * 70.0);
                        progress?.Report((
                            Math.Clamp(progressPct, 15, 85),
                            $"Baking DSP pipeline: frame {framesWritten:N0}/{totalFrames:N0}..."));
                    }
                }

                if (File.Exists(outputWavPath))
                    File.Delete(outputWavPath);

                File.Move(tempWavPath, outputWavPath);
            }
            finally
            {
                // A cancelled or failed render must not leave temp files behind.
                if (File.Exists(tempWavPath))
                {
                    try { File.Delete(tempWavPath); } catch { /* best effort */ }
                }
            }

            progress?.Report((90, "Writing TagLibSharp broadcast & ID3v2 metadata..."));
            try
            {
                _metadataService.WriteMetadata(outputWavPath, project.Metadata);
            }
            catch (Exception ex)
            {
                // A tagging failure should not discard a good render.
                progress?.Report((95, $"Audio written, but metadata failed: {ex.Message}"));
            }

            double finalLufs = masteringChain.GetIntegratedLufs();
            progress?.Report((100,
                $"Mastering complete! Target: {project.Dsp.Limiter.TargetLufs:F1} LUFS (Achieved: {finalLufs:F1} LUFS)"));
        }, cancellationToken);
    }
}
