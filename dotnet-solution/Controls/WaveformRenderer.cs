using System;
using Avalonia;
using Avalonia.Media;

namespace SpliceIt.Controls;

/// <summary>
/// Shared peak-drawing routine so the clip view and the media-pool thumbnail
/// produce an identical waveform for the same audio.
/// </summary>
public static class WaveformRenderer
{
    public static void DrawPeaks(
        DrawingContext context,
        Rect bounds,
        float[]? peaks,
        double clipOffsetSeconds,
        double clipDurationSeconds,
        double sourceDurationSeconds,
        IBrush brush,
        double barSpacing = 3.0)
    {
        if (peaks is null || peaks.Length == 0) return;
        if (bounds.Width <= 1 || bounds.Height <= 1) return;

        // Map the visible clip window onto the source-relative peak array so a
        // trimmed clip shows its slice rather than the whole file squashed.
        double sourceDuration = sourceDurationSeconds > 0
            ? sourceDurationSeconds
            : Math.Max(0.001, clipOffsetSeconds + clipDurationSeconds);

        double startRatio = Math.Clamp(clipOffsetSeconds / sourceDuration, 0.0, 1.0);
        double endRatio = Math.Clamp(
            (clipOffsetSeconds + clipDurationSeconds) / sourceDuration,
            startRatio + 0.0001, 1.0);

        int barCount = Math.Max(4, (int)(bounds.Width / barSpacing));
        double barWidth = bounds.Width / barCount;
        double drawWidth = Math.Max(1.0, barWidth - 1.0);
        double midY = bounds.Y + bounds.Height / 2.0;
        double maxBarHeight = bounds.Height * 0.85;

        for (int i = 0; i < barCount; i++)
        {
            double progress = barCount > 1 ? (double)i / (barCount - 1) : 0.0;
            double sourceProgress = startRatio + progress * (endRatio - startRatio);

            int peakIndex = Math.Clamp((int)(sourceProgress * peaks.Length), 0, peaks.Length - 1);
            double barHeight = Math.Max(1.5, peaks[peakIndex] * maxBarHeight);

            context.FillRectangle(
                brush,
                new Rect(bounds.X + i * barWidth, midY - barHeight / 2.0, drawWidth, barHeight));
        }
    }
}
