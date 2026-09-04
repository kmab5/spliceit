using System;
using System.Windows.Input;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;

namespace SpliceIt.Controls;

/// <summary>
/// Full-height playhead needle with a grab handle, draggable anywhere over the
/// lanes. Phase 2a could only scrub from the ruler; this closes that gap.
///
/// Spans the whole lane area and stays hit-transparent except for a narrow band
/// around the needle, so clip interaction underneath is unaffected.
/// </summary>
public sealed class PlayheadView : Control
{
    /// <summary>Total control width. Kept narrow so it only intercepts pointer
    /// input immediately around the needle — clips either side stay clickable
    /// without needing a custom hit-test.</summary>
    public const double NeedleWidth = 19.0;

    private const double HandleSize = 11.0;

    private bool _isDragging;
    private double _dragStartX;
    private double _dragStartTime;

    public static readonly StyledProperty<double> CurrentTimeProperty =
        AvaloniaProperty.Register<PlayheadView, double>(nameof(CurrentTime));

    public static readonly StyledProperty<double> PixelsPerSecondProperty =
        AvaloniaProperty.Register<PlayheadView, double>(nameof(PixelsPerSecond), 80.0);

    public static readonly StyledProperty<double> TotalDurationProperty =
        AvaloniaProperty.Register<PlayheadView, double>(nameof(TotalDuration), 16.0);

    public static readonly StyledProperty<bool> SnapToGridProperty =
        AvaloniaProperty.Register<PlayheadView, bool>(nameof(SnapToGrid), true);

    public static readonly StyledProperty<double> GridSizeSecondsProperty =
        AvaloniaProperty.Register<PlayheadView, double>(nameof(GridSizeSeconds), 0.25);

    public static readonly StyledProperty<ICommand?> ScrubCommandProperty =
        AvaloniaProperty.Register<PlayheadView, ICommand?>(nameof(ScrubCommand));

    public double CurrentTime
    {
        get => GetValue(CurrentTimeProperty);
        set => SetValue(CurrentTimeProperty, value);
    }

    public double PixelsPerSecond
    {
        get => GetValue(PixelsPerSecondProperty);
        set => SetValue(PixelsPerSecondProperty, value);
    }

    public double TotalDuration
    {
        get => GetValue(TotalDurationProperty);
        set => SetValue(TotalDurationProperty, value);
    }

    public bool SnapToGrid
    {
        get => GetValue(SnapToGridProperty);
        set => SetValue(SnapToGridProperty, value);
    }

    public double GridSizeSeconds
    {
        get => GetValue(GridSizeSecondsProperty);
        set => SetValue(GridSizeSecondsProperty, value);
    }

    public ICommand? ScrubCommand
    {
        get => GetValue(ScrubCommandProperty);
        set => SetValue(ScrubCommandProperty, value);
    }

    static PlayheadView()
    {
        AffectsRender<PlayheadView>(
            CurrentTimeProperty, PixelsPerSecondProperty, TotalDurationProperty);
    }

    protected override Size MeasureOverride(Size availableSize)
    {
        double h = double.IsInfinity(availableSize.Height) ? 0 : availableSize.Height;
        return new Size(NeedleWidth, h);
    }

    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
        base.OnPointerPressed(e);
        if (!e.GetCurrentPoint(this).Properties.IsLeftButtonPressed) return;

        _isDragging = true;
        _dragStartX = e.GetPosition(this).X;
        _dragStartTime = CurrentTime;
        e.Pointer.Capture(this);
        InvalidateVisual();
        e.Handled = true;
    }

    protected override void OnPointerMoved(PointerEventArgs e)
    {
        base.OnPointerMoved(e);
        if (!_isDragging) return;

        // Delta-based: the control is narrow and moves with the playhead, so an
        // absolute position inside it carries no timeline meaning.
        double pps = PixelsPerSecond > 0 ? PixelsPerSecond : 80.0;
        double delta = (e.GetPosition(this).X - _dragStartX) / pps;
        Scrub(_dragStartTime + delta);
        e.Handled = true;
    }

    protected override void OnPointerReleased(PointerReleasedEventArgs e)
    {
        base.OnPointerReleased(e);
        _isDragging = false;
        e.Pointer.Capture(null);
        InvalidateVisual();
    }

    private void Scrub(double seconds)
    {
        double t = Math.Clamp(seconds, 0, Math.Max(0, TotalDuration));

        if (SnapToGrid && GridSizeSeconds > 0)
        {
            t = Math.Round(t / GridSizeSeconds) * GridSizeSeconds;
        }

        if (ScrubCommand?.CanExecute(t) == true) ScrubCommand.Execute(t);
    }

    public override void Render(DrawingContext context)
    {
        base.Render(context);

        double x = NeedleWidth / 2.0;
        double h = Bounds.Height;
        if (h <= 0) return;

        var red = new SolidColorBrush(Color.Parse("#FF4444"));
        double thickness = _isDragging ? 2.5 : 1.5;

        context.DrawLine(new Pen(red, thickness), new Point(x, 0), new Point(x, h));

        // Grab handle at the top
        context.DrawGeometry(red, null,
            new EllipseGeometry(new Rect(x - HandleSize / 2, 0, HandleSize, HandleSize)));
        context.DrawGeometry(Brushes.White, null,
            new EllipseGeometry(new Rect(x - 1.5, HandleSize / 2 - 1.5, 3, 3)));
    }
}
