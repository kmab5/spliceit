using System;
using Avalonia;
using Avalonia.Controls;

namespace SpliceIt.Controls;

/// <summary>
/// Arranges AudioClipView children by their clip's timeline coordinates.
///
/// A plain Canvas cannot do this: Canvas.Left would need a per-child binding
/// multiplied by the live zoom factor. Positioning in the panel keeps the maths
/// in one place and makes zoom changes a single InvalidateArrange.
/// </summary>
public sealed class TimelineLanePanel : Panel
{
    public static readonly StyledProperty<double> PixelsPerSecondProperty =
        AvaloniaProperty.Register<TimelineLanePanel, double>(nameof(PixelsPerSecond), 80.0);

    public double PixelsPerSecond
    {
        get => GetValue(PixelsPerSecondProperty);
        set => SetValue(PixelsPerSecondProperty, value);
    }

    static TimelineLanePanel()
    {
        AffectsArrange<TimelineLanePanel>(PixelsPerSecondProperty);
        AffectsMeasure<TimelineLanePanel>(PixelsPerSecondProperty);
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        double pps = PixelsPerSecond > 0 ? PixelsPerSecond : 80.0;
        double widest = 0;

        foreach (var child in Children)
        {
            child.Measure(Size.Infinity);

            if (child is AudioClipView view && view.Clip is { } clip)
            {
                widest = Math.Max(widest, (clip.TimelineStartSeconds + clip.ClipDurationSeconds) * pps);
            }
        }

        double height = double.IsInfinity(availableSize.Height) ? 96 : availableSize.Height;
        double width = double.IsInfinity(availableSize.Width)
            ? widest
            : Math.Max(availableSize.Width, widest);

        return new Size(width, height);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        double pps = PixelsPerSecond > 0 ? PixelsPerSecond : 80.0;

        foreach (var child in Children)
        {
            if (child is not AudioClipView view || view.Clip is not { } clip)
            {
                child.Arrange(new Rect(0, 0, 0, 0));
                continue;
            }

            view.PixelsPerSecond = pps;

            double x = clip.TimelineStartSeconds * pps;
            double w = Math.Max(8, clip.ClipDurationSeconds * pps);

            // 4px inset top and bottom so lanes read as separate rows.
            child.Arrange(new Rect(x, 4, w, Math.Max(0, finalSize.Height - 8)));
        }

        return finalSize;
    }
}
