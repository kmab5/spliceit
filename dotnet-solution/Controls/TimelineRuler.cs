using System;
using System.Globalization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using System.Windows.Input;

namespace SpliceIt.Controls;

/// <summary>
/// Time ruler with adaptive tick density, a loop-region overlay and
/// click/drag scrubbing. Port of TimelineRuler.tsx.
/// </summary>
public sealed class TimelineRuler : Control
{
    public static readonly StyledProperty<double> TotalDurationProperty =
        AvaloniaProperty.Register<TimelineRuler, double>(nameof(TotalDuration), 16.0);

    public static readonly StyledProperty<double> PixelsPerSecondProperty =
        AvaloniaProperty.Register<TimelineRuler, double>(nameof(PixelsPerSecond), 80.0);

    public static readonly StyledProperty<double> CurrentTimeProperty =
        AvaloniaProperty.Register<TimelineRuler, double>(nameof(CurrentTime));

    public static readonly StyledProperty<bool> IsLoopingProperty =
        AvaloniaProperty.Register<TimelineRuler, bool>(nameof(IsLooping));

    public static readonly StyledProperty<double> LoopStartProperty =
        AvaloniaProperty.Register<TimelineRuler, double>(nameof(LoopStart));

    public static readonly StyledProperty<double> LoopEndProperty =
        AvaloniaProperty.Register<TimelineRuler, double>(nameof(LoopEnd), 8.0);

    public double TotalDuration
    {
        get => GetValue(TotalDurationProperty);
        set => SetValue(TotalDurationProperty, value);
    }

    public double PixelsPerSecond
    {
        get => GetValue(PixelsPerSecondProperty);
        set => SetValue(PixelsPerSecondProperty, value);
    }

    public double CurrentTime
    {
        get => GetValue(CurrentTimeProperty);
        set => SetValue(CurrentTimeProperty, value);
    }

    public bool IsLooping
    {
        get => GetValue(IsLoopingProperty);
        set => SetValue(IsLoopingProperty, value);
    }

    public double LoopStart
    {
        get => GetValue(LoopStartProperty);
        set => SetValue(LoopStartProperty, value);
    }

    public double LoopEnd
    {
        get => GetValue(LoopEndProperty);
        set => SetValue(LoopEndProperty, value);
    }

    public static readonly StyledProperty<ICommand?> ScrubCommandProperty =
        AvaloniaProperty.Register<TimelineRuler, ICommand?>(nameof(ScrubCommand));

    /// <summary>Invoked with the requested timeline position while scrubbing.</summary>
    public ICommand? ScrubCommand
    {
        get => GetValue(ScrubCommandProperty);
        set => SetValue(ScrubCommandProperty, value);
    }

    private bool _isScrubbing;

    static TimelineRuler()
    {
        AffectsRender<TimelineRuler>(
            TotalDurationProperty, PixelsPerSecondProperty, CurrentTimeProperty,
            IsLoopingProperty, LoopStartProperty, LoopEndProperty);
        AffectsMeasure<TimelineRuler>(TotalDurationProperty, PixelsPerSecondProperty);
    }

    public TimelineRuler()
    {
        Cursor = new Cursor(StandardCursorType.Ibeam);
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        double pps = PixelsPerSecond > 0 ? PixelsPerSecond : 80.0;
        return new Size(Math.Max(800, TotalDuration * pps), 28);
    }

    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
        base.OnPointerPressed(e);
        if (!e.GetCurrentPoint(this).Properties.IsLeftButtonPressed) return;

        _isScrubbing = true;
        e.Pointer.Capture(this);
        RaiseScrub(e.GetPosition(this).X);
        e.Handled = true;
    }

    protected override void OnPointerMoved(PointerEventArgs e)
    {
        base.OnPointerMoved(e);
        if (!_isScrubbing) return;
        RaiseScrub(e.GetPosition(this).X);
        e.Handled = true;
    }

    protected override void OnPointerReleased(PointerReleasedEventArgs e)
    {
        base.OnPointerReleased(e);
        _isScrubbing = false;
        e.Pointer.Capture(null);
    }

    private void RaiseScrub(double x)
    {
        double pps = PixelsPerSecond > 0 ? PixelsPerSecond : 80.0;
        double t = Math.Clamp(x / pps, 0, Math.Max(0, TotalDuration));
        if (ScrubCommand?.CanExecute(t) == true) ScrubCommand.Execute(t);
    }

    public override void Render(DrawingContext context)
    {
        base.Render(context);

        double pps = PixelsPerSecond > 0 ? PixelsPerSecond : 80.0;
        double w = Bounds.Width;
        double h = Bounds.Height;
        if (w <= 0 || h <= 0) return;

        context.FillRectangle(new SolidColorBrush(Color.Parse("#121214")), new Rect(0, 0, w, h));

        // Loop region behind the ticks
        if (IsLooping && LoopEnd > LoopStart)
        {
            var loopRect = new Rect(LoopStart * pps, 0, Math.Max(1, (LoopEnd - LoopStart) * pps), h);
            context.FillRectangle(new SolidColorBrush(Color.Parse("#F27D26"), 0.15), loopRect);
            var edgePen = new Pen(new SolidColorBrush(Color.Parse("#F27D26"), 0.6), 1);
            context.DrawLine(edgePen, loopRect.TopLeft, loopRect.BottomLeft);
            context.DrawLine(edgePen, loopRect.TopRight, loopRect.BottomRight);
        }

        // Tick density adapts to zoom so labels never collide.
        double tickInterval = pps > 100 ? 0.5 : pps > 50 ? 1.0 : pps > 25 ? 2.0 : 5.0;

        var majorPen = new Pen(new SolidColorBrush(Color.Parse("#3D3D3F")), 1);
        var minorPen = new Pen(new SolidColorBrush(Color.Parse("#252527")), 1);
        var labelBrush = new SolidColorBrush(Color.Parse("#8E9299"));

        int tickCount = (int)Math.Ceiling(TotalDuration / tickInterval) + 2;

        for (int i = 0; i < tickCount; i++)
        {
            double t = i * tickInterval;
            double x = t * pps;
            if (x > w) break;

            bool isMajor = Math.Abs(t - Math.Round(t)) < 0.0001;

            context.DrawLine(
                isMajor ? majorPen : minorPen,
                new Point(x, isMajor ? h - 12 : h - 6),
                new Point(x, h));

            if (isMajor)
            {
                int minutes = (int)(t / 60);
                int seconds = (int)(t % 60);
                var text = new FormattedText(
                    $"{minutes}:{seconds:D2}",
                    CultureInfo.CurrentCulture, FlowDirection.LeftToRight,
                    Typeface.Default, 10, labelBrush);
                context.DrawText(text, new Point(x + 3, 2));
            }
        }

        // Playhead marker
        double px = CurrentTime * pps;
        if (px >= 0 && px <= w)
        {
            var red = new SolidColorBrush(Color.Parse("#FF4444"));
            context.DrawLine(new Pen(red, 1.5), new Point(px, 0), new Point(px, h));
            context.DrawGeometry(red, null, new EllipseGeometry(new Rect(px - 4, 1, 8, 8)));
        }
    }
}
