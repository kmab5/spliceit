using System;
using SpliceIt.Models;

namespace SpliceIt.Services;

/// <summary>
/// Builds a normalised peak envelope for waveform rendering.
/// Mirrors extractPeaksFromBuffer() in the React app so both front-ends draw
/// the same shape for the same file.
/// </summary>
public static class PeakExtractionService
{
    public const int DefaultPeakCount = 512;

    /// <summary>
    /// Reduces interleaved stereo samples to <paramref name="peakCount"/> bins,
    /// each holding the maximum absolute amplitude across both channels.
    /// </summary>
    public static float[] ExtractPeaks(float[] interleavedStereo, int peakCount = DefaultPeakCount)
    {
        if (interleavedStereo.Length == 0 || peakCount <= 0)
            return Array.Empty<float>();

        long frameCount = interleavedStereo.LongLength / 2;
        if (frameCount == 0) return Array.Empty<float>();

        // Never ask for more bins than there are frames.
        peakCount = (int)Math.Min(peakCount, frameCount);
        var peaks = new float[peakCount];

        long framesPerBin = Math.Max(1, frameCount / peakCount);

        for (int bin = 0; bin < peakCount; bin++)
        {
            long start = bin * framesPerBin;
            long end = (bin == peakCount - 1) ? frameCount : Math.Min(frameCount, start + framesPerBin);

            float max = 0f;
            for (long f = start; f < end; f++)
            {
                long i = f * 2;
                float l = Math.Abs(interleavedStereo[i]);
                float r = Math.Abs(interleavedStereo[i + 1]);
                float m = Math.Max(l, r);
                if (m > max) max = m;
            }

            peaks[bin] = Math.Min(1f, max);
        }

        return peaks;
    }
}
