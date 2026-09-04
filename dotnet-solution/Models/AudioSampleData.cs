using System;

namespace SpliceIt.Models;

/// <summary>
/// Fully decoded audio held in memory as interleaved 32-bit float samples,
/// normalised to the engine's stereo format and sample rate.
///
/// Everything is converted on import so that mixing, waveform drawing and
/// export can all assume the same layout and never resample per read.
/// </summary>
public sealed class AudioSampleData
{
    public required string SourcePath { get; init; }

    /// <summary>Interleaved stereo samples: [L0, R0, L1, R1, ...].</summary>
    public required float[] Samples { get; init; }

    public required int SampleRate { get; init; }

    /// <summary>Always 2 — mono sources are widened and multichannel is downmixed on import.</summary>
    public int Channels => 2;

    /// <summary>Number of stereo frames (Samples.Length / 2).</summary>
    public long FrameCount => Samples.LongLength / 2;

    public double DurationSeconds => SampleRate > 0 ? (double)FrameCount / SampleRate : 0.0;

    /// <summary>Normalised 0..1 peak envelope for waveform display.</summary>
    public required float[] Peaks { get; init; }

    /// <summary>Original format details, kept for the media pool UI.</summary>
    public int OriginalSampleRate { get; init; }
    public int OriginalChannels { get; init; }
    public long FileSizeBytes { get; init; }

    public float GetSample(long frame, int channel)
    {
        long idx = frame * 2 + channel;
        if (idx < 0 || idx >= Samples.LongLength) return 0f;
        return Samples[idx];
    }
}
