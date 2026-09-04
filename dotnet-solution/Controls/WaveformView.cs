using System;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Media;

namespace SpliceIt.Controls;

/// <summary>
/// Draws a clip's peak envelope with Avalonia's DrawingContext.
///
/// This replaces the NAudio.WaveFormRenderer package that was referenced but
/// unusable: it renders to a System.Drawing.Bitmap (GDI+), which cannot compose
/// with Avalonia's renderer at all.
///
/// Honours ClipOffset/ClipDuration against SourceDuration so a trimmed clip
/// shows the correct slice of the waveform rather than the whole file squashed
/// to fit — matching AudioClipItem's canvas logic in the React app.
/// </summary>
public sealed class WaveformView : Control
{
    public static readonly StyledProperty<float[]?> PeaksProperty =
        AvaloniaProperty.Register<WaveformView, float[]?>(nameof(Peaks));

    public static readonly StyledProperty<double> ClipOffsetSecondsProperty =
        AvaloniaProperty.Register<WaveformView, double>(nameof(ClipOffsetSeconds));

    public static readonly StyledProperty<double> ClipDurationSecondsProperty =
        AvaloniaProperty.Register<WaveformView, double>(nameof(ClipDurationSeconds), 1.0);

    public static readonly StyledProperty<double> SourceDurationSecondsProperty =
        AvaloniaProperty.Register<WaveformView, double>(nameof(SourceDurationSeconds), 1.0);

    public static readonly StyledProperty<IBrush?> WaveBrushProperty =
        AvaloniaProperty.Register<WaveformView, IBrush?>(
            nameof(WaveBrush), new SolidColorBrush(Color.Parse("#4FC3F7")));

    public float[]? Peaks
    {
        get => GetValue(PeaksProperty);
        set => SetValue(PeaksProperty, value);
    }

    public double ClipOffsetSeconds
    {
        get => GetValue(ClipOffsetSecondsProperty);
        set => SetValue(ClipOffsetSecondsProperty, value);
    }

    public double ClipDurationSeconds
    {
        get => GetValue(ClipDurationSecondsProperty);
        set => SetValue(ClipDurationSecondsProperty, value);
    }

    public double SourceDurationSeconds
    {
        get => GetValue(SourceDurationSecondsProperty);
        set => SetValue(SourceDurationSecondsProperty, value);
    }

    public IBrush? WaveBrush
    {
        get => GetValue(WaveBrushProperty);
        set => SetValue(WaveBrushProperty, value);
    }

    static WaveformView()
    {
        AffectsRender<WaveformView>(
            PeaksProperty,
            ClipOffsetSecondsProperty,
            ClipDurationSecondsProperty,
            SourceDurationSecondsProperty,
            WaveBrushProperty);
    }

    public override void Render(DrawingContext context)
    {
        base.Render(context);

        var peaks = Peaks;
        if (peaks is null || peaks.Length == 0) return;

        double width = Bounds.Width;
        double height = Bounds.Height;
        if (width <= 1 || height <= 1) return;

        var brush = WaveBrush ?? Brushes.DeepSkyBlue;

        // Map the visible clip window onto the source-relative peak array.
        double sourceDuration = SourceDurationSeconds > 0
            ? SourceDurationSeconds
            : Math.Max(0.001, ClipOffsetSeconds + ClipDurationSeconds);

        double startRatio = Math.Clamp(ClipOffsetSeconds / sourceDuration, 0.0, 1.0);
        double endRatio = Math.Clamp(
            (ClipOffsetSeconds + ClipDurationSeconds) / sourceDuration,
            startRatio + 0.0001, 1.0);

        // One bar every ~3px, matching the React renderer's density.
        int barCount = Math.Max(8, (int)(width / 3.0));
        double barWidth = width / barCount;
        double drawWidth = Math.Max(1.0, barWidth - 1.0);
        double midY = height / 2.0;
        double maxBarHeight = height * 0.85;

        for (int i = 0; i < barCount; i++)
        {
            double progress = barCount > 1 ? (double)i / (barCount - 1) : 0.0;
            double sourceProgress = startRatio + progress * (endRatio - startRatio);

            int peakIndex = (int)(sourceProgress * peaks.Length);
            peakIndex = Math.Clamp(peakIndex, 0, peaks.Length - 1);

            double amplitude = peaks[peakIndex];
            double barHeight = Math.Max(1.5, amplitude * maxBarHeight);

            var rect = new Rect(i * barWidth, midY - barHeight / 2.0, drawWidth, barHeight);
            context.FillRectangle(brush, rect);
        }
    }
}
