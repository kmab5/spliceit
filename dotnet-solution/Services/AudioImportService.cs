using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Vorbis;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using SpliceIt.Models;

namespace SpliceIt.Services;

/// <summary>
/// Decodes an audio file into interleaved stereo float samples at the engine
/// sample rate.
///
/// Prior to Phase 1 the project had no audio decoding of any kind — the export
/// pipeline synthesised a 220 Hz sine tone regardless of what was on the
/// timeline. This service is what makes real audio possible.
///
/// Decoder selection:
///   .wav / .aiff  -> NAudio's native readers (avoids Media Foundation quirks)
///   .ogg          -> NAudio.Vorbis (Media Foundation cannot read Vorbis)
///   everything else -> MediaFoundationReader, which handles MP3, AAC/M4A, WMA,
///                      and FLAC on Windows 10 and later.
/// </summary>
public sealed class AudioImportService
{
    /// <summary>Engine-wide mix rate. Everything is resampled to this on import.</summary>
    public int TargetSampleRate { get; init; } = 48000;

    public static readonly string[] SupportedExtensions =
    {
        ".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".wma", ".aiff", ".aif"
    };

    public static bool IsSupported(string path)
    {
        string ext = Path.GetExtension(path);
        return Array.Exists(SupportedExtensions,
            e => string.Equals(e, ext, StringComparison.OrdinalIgnoreCase));
    }

    public Task<AudioSampleData> ImportAsync(string filePath, CancellationToken ct = default)
        => Task.Run(() => Import(filePath, ct), ct);

    public AudioSampleData Import(string filePath, CancellationToken ct = default)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException("Audio file not found", filePath);

        using WaveStream reader = CreateReader(filePath);

        int originalRate = reader.WaveFormat.SampleRate;
        int originalChannels = reader.WaveFormat.Channels;

        ISampleProvider provider = reader.ToSampleProvider();
        provider = NormaliseToStereo(provider);

        if (provider.WaveFormat.SampleRate != TargetSampleRate)
        {
            // WDL resampler: pure managed, good quality, no native dependency.
            provider = new WdlResamplingSampleProvider(provider, TargetSampleRate);
        }

        float[] samples = ReadAll(provider, ct);
        float[] peaks = PeakExtractionService.ExtractPeaks(samples);

        long fileSize = 0;
        try { fileSize = new FileInfo(filePath).Length; } catch { /* size is cosmetic */ }

        return new AudioSampleData
        {
            SourcePath = Path.GetFullPath(filePath),
            Samples = samples,
            SampleRate = TargetSampleRate,
            Peaks = peaks,
            OriginalSampleRate = originalRate,
            OriginalChannels = originalChannels,
            FileSizeBytes = fileSize
        };
    }

    private static WaveStream CreateReader(string filePath)
    {
        string ext = Path.GetExtension(filePath).ToLowerInvariant();

        return ext switch
        {
            ".wav" => new WaveFileReader(filePath),
            ".aiff" or ".aif" => new AiffFileReader(filePath),
            ".ogg" => new VorbisWaveReader(filePath),
            _ => CreateMediaFoundationReader(filePath)
        };
    }

    private static WaveStream CreateMediaFoundationReader(string filePath)
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException(
                $"Decoding '{Path.GetExtension(filePath)}' requires Media Foundation, which is " +
                "Windows-only. Cross-platform decode arrives with FFmpeg in Phase 3.");
        }

        // MediaFoundationReader's constructor calls MediaFoundationApi.Startup()
        // internally, so no explicit initialisation is needed here.
        return new MediaFoundationReader(filePath);
    }

    /// <summary>
    /// Forces any channel count to stereo. Mono is duplicated; anything above
    /// two channels keeps the first two rather than attempting a surround
    /// downmix matrix, which would be guesswork without channel-mask info.
    /// </summary>
    private static ISampleProvider NormaliseToStereo(ISampleProvider provider)
    {
        int channels = provider.WaveFormat.Channels;

        if (channels == 2) return provider;
        if (channels == 1) return new MonoToStereoSampleProvider(provider);

        var multiplexer = new MultiplexingSampleProvider(new[] { provider }, 2);
        multiplexer.ConnectInputToOutput(0, 0);
        multiplexer.ConnectInputToOutput(1, 1);
        return multiplexer;
    }

    private static float[] ReadAll(ISampleProvider provider, CancellationToken ct)
    {
        // 1 second of stereo audio per read.
        int blockSize = provider.WaveFormat.SampleRate * 2;
        var buffer = new float[blockSize];
        var chunks = new List<float[]>();
        long total = 0;

        int read;
        while ((read = provider.Read(buffer, 0, blockSize)) > 0)
        {
            ct.ThrowIfCancellationRequested();
            var chunk = new float[read];
            Array.Copy(buffer, 0, chunk, 0, read);
            chunks.Add(chunk);
            total += read;
        }

        // Guarantee an even length so the interleaved stereo invariant holds
        // even if a decoder returns a partial final frame.
        if (total % 2 != 0) total--;

        var result = new float[total];
        long pos = 0;
        foreach (var chunk in chunks)
        {
            long remaining = total - pos;
            if (remaining <= 0) break;
            long copy = Math.Min(chunk.LongLength, remaining);
            Array.Copy(chunk, 0, result, pos, copy);
            pos += copy;
        }

        return result;
    }
}
