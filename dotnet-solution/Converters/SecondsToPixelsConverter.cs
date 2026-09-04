using System;
using System.Globalization;
using Avalonia.Data.Converters;

namespace SpliceIt.Converters;

/// <summary>
/// Converts a timeline value in seconds into a horizontal pixel coordinate.
///
/// Phase 0: the clip rectangles in MainWindow.axaml were hardcoded to
/// Canvas.Left="10" Width="320", so every clip rendered in the same place at the
/// same size regardless of its actual position or duration. This converter makes
/// the timeline honest at a fixed zoom level.
///
/// Phase 2 replaces the fixed scale with the live ZoomFactor from the view model
/// via a MultiBinding, at which point this becomes a multi-value converter.
/// </summary>
public sealed class SecondsToPixelsConverter : IValueConverter
{
    /// <summary>Fallback scale in pixels per second, matching MainViewModel.ZoomFactor.</summary>
    public double DefaultPixelsPerSecond { get; set; } = 80.0;

    /// <summary>Smallest width a clip may render at, so short clips stay clickable.</summary>
    public double MinimumPixels { get; set; } = 0.0;

    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        double seconds = value switch
        {
            double d => d,
            float f => f,
            int i => i,
            _ => 0.0
        };

        double scale = DefaultPixelsPerSecond;
        if (parameter is double p && p > 0)
        {
            scale = p;
        }
        else if (parameter is string s &&
                 double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed) &&
                 parsed > 0)
        {
            scale = parsed;
        }

        double pixels = seconds * scale;
        return Math.Max(MinimumPixels, pixels);
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        double pixels = value switch
        {
            double d => d,
            float f => f,
            int i => i,
            _ => 0.0
        };

        double scale = DefaultPixelsPerSecond;
        if (parameter is double p && p > 0) scale = p;

        return scale > 0 ? pixels / scale : 0.0;
    }
}
