using System;
using System.Collections.Generic;
using System.Globalization;
using Avalonia;
using Avalonia.Data.Converters;
using Avalonia.Media;

namespace SpliceIt.Converters;

/// <summary>
/// Multiplies a duration in seconds by the current pixels-per-second zoom.
/// Replaces Phase 0's fixed-scale SecondsToPixelsConverter, which could not
/// respond to zoom at all.
/// </summary>
public sealed class SecondsAndZoomToPixelsConverter : IMultiValueConverter
{
    public double Minimum { get; set; }

    public object Convert(IList<object?> values, Type targetType, object? parameter, CultureInfo culture)
    {
        if (values.Count < 2) return Minimum;

        double seconds = ToDouble(values[0]);
        double pixelsPerSecond = ToDouble(values[1]);
        if (pixelsPerSecond <= 0) pixelsPerSecond = 80.0;

        return Math.Max(Minimum, seconds * pixelsPerSecond);
    }

    private static double ToDouble(object? v) => v switch
    {
        double d => d,
        float f => f,
        int i => i,
        _ => 0.0
    };
}

/// <summary>
/// Turns a ScrollViewer offset into a translate transform, used to keep the
/// ruler locked to the lanes horizontally and the track headers locked
/// vertically without nesting synchronised ScrollViewers.
/// Pass "X" or "Y" as the ConverterParameter.
/// </summary>
public sealed class ScrollOffsetToTransformConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is not Vector offset) return new TranslateTransform(0, 0);

        string axis = parameter as string ?? "X";
        return axis.Equals("Y", StringComparison.OrdinalIgnoreCase)
            ? new TranslateTransform(0, -offset.Y)
            : new TranslateTransform(-offset.X, 0);
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

/// <summary>Parses a model's hex colour string into a brush for binding.</summary>
public sealed class HexToBrushConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is string hex && !string.IsNullOrWhiteSpace(hex))
        {
            try { return new SolidColorBrush(Color.Parse(hex)); }
            catch { /* fall through to default */ }
        }
        return new SolidColorBrush(Color.Parse("#4FC3F7"));
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}
