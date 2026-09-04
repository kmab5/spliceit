using System;
using System.Globalization;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using System.Windows.Input;
using SpliceIt.Models;
using SpliceIt.Utils;

namespace SpliceIt.Controls;

/// <summary>
/// An interactive clip rectangle: waveform, label, fade ramps, selection state,
/// plus drag-to-move and edge-trim with strict collision avoidance.
///
/// Everything is drawn directly rather than templated, so the control owns its
/// own hit-testing zones and there is no ambiguity about which element received
/// a pointer press.
/// </summary>
public sealed class AudioClipView : Control
{
    private const double HandleWidth = 8.0;

    private enum DragMode { None, Move, TrimStart, TrimEnd }

    private DragMode _mode = DragMode.None;
    private Point _dragOrigin;
    private double _initialStart;
    private double _initialDuration;
    private double _initialOffset;
    private double _leftBound;
    private double _rightBound;
    private bool _committed;

    public static readonly StyledProperty<AudioClip?> ClipProperty =
        AvaloniaProperty.Register<AudioClipView, AudioClip?>(nameof(Clip));

    public static readonly StyledProperty<AudioTrack?> OwnerTrackProperty =
        AvaloniaProperty.Register<AudioClipView, AudioTrack?>(nameof(OwnerTrack));

    public static readonly StyledProperty<double> PixelsPerSecondProperty =
        AvaloniaProperty.Register<AudioClipView, double>(nameof(PixelsPerSecond), 80.0);

    public static readonly StyledProperty<bool> IsSelectedProperty =
        AvaloniaProperty.Register<AudioClipView, bool>(nameof(IsSelected));

    public static readonly StyledProperty<bool> SnapToGridProperty =
        AvaloniaProperty.Register<AudioClipView, bool>(nameof(SnapToGrid), true);

    public static readonly StyledProperty<double> GridSizeSecondsProperty =
        AvaloniaProperty.Register<AudioClipView, double>(nameof(GridSizeSeconds), 0.25);

    public AudioClip? Clip
    {
        get => GetValue(ClipProperty);
        set => SetValue(ClipProperty, value);
    }

    public AudioTrack? OwnerTrack
    {
        get => GetValue(OwnerTrackProperty);
        set => SetValue(OwnerTrackProperty, value);
    }

    public double PixelsPerSecond
    {
        get => GetValue(PixelsPerSecondProperty);
        set => SetValue(PixelsPerSecondProperty, value);
    }

    public bool IsSelected
    {
        get => GetValue(IsSelectedProperty);
        set => SetValue(IsSelectedProperty, value);
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

    public static readonly StyledProperty<ICommand?> SelectCommandProperty =
        AvaloniaProperty.Register<AudioClipView, ICommand?>(nameof(SelectCommand));

    public static readonly StyledProperty<ICommand?> EditCommittedCommandProperty =
        AvaloniaProperty.Register<AudioClipView, ICommand?>(nameof(EditCommittedCommand));

    /// <summary>Invoked with the clip when it is clicked.</summary>
    public ICommand? SelectCommand
    {
        get => GetValue(SelectCommandProperty);
        set => SetValue(SelectCommandProperty, value);
    }

    /// <summary>Invoked with the clip once a drag or trim gesture completes.</summary>
    public ICommand? EditCommittedCommand
    {
        get => GetValue(EditCommittedCommandProperty);
        set => SetValue(EditCommittedCommandProperty, value);
    }

    static AudioClipView()
    {
        AffectsRender<AudioClipView>(
            ClipProperty, PixelsPerSecondProperty, IsSelectedProperty);
    }

    public AudioClipView()
    {
        Cursor = new Cursor(StandardCursorType.Hand);
    }

    // ------------------------------------------------------------ Pointer input

    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
        base.OnPointerPressed(e);

        var clip = Clip;
        if (clip is null) return;
        if (!e.GetCurrentPoint(this).Properties.IsLeftButtonPressed) return;

        if (SelectCommand?.CanExecute(clip) == true) SelectCommand.Execute(clip);

        _dragOrigin = e.GetPosition(this);
        _mode = HitTestZone(_dragOrigin.X);
        _committed = false;

        _initialStart = clip.TimelineStartSeconds;
        _initialDuration = clip.ClipDurationSeconds;
        _initialOffset = clip.ClipOffsetSeconds;

        var siblings = OwnerTrack?.Clips.AsEnumerable() ?? Enumerable.Empty<AudioClip>();
        (_leftBound, _rightBound) = ClipCollision.GetMovementBounds(
            clip.Id, _initialStart, _initialDuration, siblings);

        e.Pointer.Capture(this);
        e.Handled = true;
    }

    protected override void OnPointerMoved(PointerEventArgs e)
    {
        base.OnPointerMoved(e);

        var clip = Clip;
        if (clip is null) return;

        var pos = e.GetPosition(this);

        if (_mode == DragMode.None)
        {
            // Hover feedback only.
            Cursor = HitTestZone(pos.X) switch
            {
                DragMode.TrimStart or DragMode.TrimEnd => new Cursor(StandardCursorType.SizeWestEast),
                _ => new Cursor(StandardCursorType.Hand)
            };
            return;
        }

        double pps = PixelsPerSecond > 0 ? PixelsPerSecond : 80.0;
        double deltaSeconds = (pos.X - _dragOrigin.X) / pps;

        switch (_mode)
        {
            case DragMode.Move:
            {
                double newStart = ClipCollision.Snap(
                    _initialStart + deltaSeconds, SnapToGrid, GridSizeSeconds);

                // Never let a clip pass through a neighbour.
                double maxStart = double.IsInfinity(_rightBound)
                    ? double.MaxValue
                    : Math.Max(_leftBound, _rightBound - _initialDuration);

                clip.TimelineStartSeconds = Math.Clamp(newStart, _leftBound, maxStart);
                break;
            }

            case DragMode.TrimStart:
            {
                double snapped = ClipCollision.Snap(
                    _initialStart + deltaSeconds, SnapToGrid, GridSizeSeconds);

                double newStart = Math.Clamp(
                    snapped, _leftBound, _initialStart + _initialDuration - 0.05);

                double applied = newStart - _initialStart;

                // Trimming the head must not read before the start of the source.
                double newOffset = _initialOffset + applied;
                if (newOffset < 0)
                {
                    applied -= newOffset;
                    newStart = _initialStart + applied;
                    newOffset = 0;
                }

                clip.TimelineStartSeconds = newStart;
                clip.ClipOffsetSeconds = newOffset;
                clip.ClipDurationSeconds = Math.Max(0.05, _initialDuration - applied);
                break;
            }

            case DragMode.TrimEnd:
            {
                double newDuration = ClipCollision.Snap(
                    _initialDuration + deltaSeconds, SnapToGrid, GridSizeSeconds);

                double maxByNeighbour = double.IsInfinity(_rightBound)
                    ? double.MaxValue
                    : Math.Max(0.05, _rightBound - _initialStart);

                // And not past the end of the decoded source.
                double maxBySource = clip.SourceDurationSeconds > 0
                    ? Math.Max(0.05, clip.SourceDurationSeconds - clip.ClipOffsetSeconds)
                    : double.MaxValue;

                clip.ClipDurationSeconds =
                    Math.Clamp(newDuration, 0.05, Math.Min(maxByNeighbour, maxBySource));
                break;
            }
        }

        _committed = true;
        InvalidateVisual();
        (Parent as Control)?.InvalidateArrange();
        e.Handled = true;
    }

    protected override void OnPointerReleased(PointerReleasedEventArgs e)
    {
        base.OnPointerReleased(e);

        if (_mode != DragMode.None && _committed && Clip is not null)
        {
            // One undo entry per gesture, not one per pointer move.
            if (EditCommittedCommand?.CanExecute(Clip) == true) EditCommittedCommand.Execute(Clip);
        }

        _mode = DragMode.None;
        _committed = false;
        e.Pointer.Capture(null);
    }

    private DragMode HitTestZone(double x)
    {
        double w = Bounds.Width;
        if (w <= HandleWidth * 2.5) return DragMode.Move; // too narrow for handles
        if (x <= HandleWidth) return DragMode.TrimStart;
        if (x >= w - HandleWidth) return DragMode.TrimEnd;
        return DragMode.Move;
    }

    // ---------------------------------------------------------------- Rendering

    public override void Render(DrawingContext context)
    {
        base.Render(context);

        var clip = Clip;
        if (clip is null) return;

        var rect = new Rect(0, 0, Bounds.Width, Bounds.Height);
        if (rect.Width <= 0 || rect.Height <= 0) return;

        Color accent;
        try { accent = Color.Parse(string.IsNullOrWhiteSpace(clip.ColorHex) ? "#4FC3F7" : clip.ColorHex); }
        catch { accent = Color.Parse("#4FC3F7"); }

        var fillBrush = new SolidColorBrush(accent, 0.10);
        var borderBrush = new SolidColorBrush(accent, IsSelected ? 1.0 : 0.45);
        var waveBrush = new SolidColorBrush(accent, 0.9);

        var rounded = new RoundedRect(rect, 4);
        context.DrawRectangle(fillBrush, new Pen(borderBrush, IsSelected ? 2.0 : 1.0), rounded);

        // Waveform occupies the lower portion, leaving room for the label.
        var waveRect = new Rect(2, 14, Math.Max(0, rect.Width - 4), Math.Max(0, rect.Height - 18));
        WaveformRenderer.DrawPeaks(
            context, waveRect, clip.Peaks,
            clip.ClipOffsetSeconds, clip.ClipDurationSeconds, clip.SourceDurationSeconds,
            waveBrush);

        DrawFadeRamps(context, rect, clip, accent);

        // Label
        var label = new FormattedText(
            clip.Name ?? string.Empty,
            CultureInfo.CurrentCulture,
            FlowDirection.LeftToRight,
            Typeface.Default,
            10,
            new SolidColorBrush(accent))
        {
            MaxTextWidth = Math.Max(10, rect.Width - 10),
            MaxLineCount = 1,
            Trimming = TextTrimming.CharacterEllipsis
        };
        context.DrawText(label, new Point(5, 2));

        if (!clip.HasAudio)
        {
            var warn = new FormattedText(
                "NO AUDIO", CultureInfo.CurrentCulture, FlowDirection.LeftToRight,
                Typeface.Default, 10, new SolidColorBrush(Color.Parse("#FF4444")));
            context.DrawText(warn, new Point(5, rect.Height - 14));
        }

        DrawTrimHandles(context, rect, accent);
    }

    private static void DrawFadeRamps(DrawingContext context, Rect rect, AudioClip clip, Color accent)
    {
        if (clip.ClipDurationSeconds <= 0) return;

        var rampPen = new Pen(new SolidColorBrush(accent, 0.7), 1.2);

        if (clip.FadeInSeconds > 0)
        {
            double w = Math.Min(rect.Width / 2,
                rect.Width * (clip.FadeInSeconds / clip.ClipDurationSeconds));
            if (w > 1)
            {
                context.DrawLine(rampPen, new Point(0, rect.Height), new Point(w, 0));
            }
        }

        if (clip.FadeOutSeconds > 0)
        {
            double w = Math.Min(rect.Width / 2,
                rect.Width * (clip.FadeOutSeconds / clip.ClipDurationSeconds));
            if (w > 1)
            {
                context.DrawLine(rampPen,
                    new Point(rect.Width - w, 0), new Point(rect.Width, rect.Height));
            }
        }
    }

    private void DrawTrimHandles(DrawingContext context, Rect rect, Color accent)
    {
        if (!IsSelected || rect.Width <= HandleWidth * 2.5) return;

        var handleBrush = new SolidColorBrush(accent, 0.55);
        context.FillRectangle(handleBrush, new Rect(0, 0, HandleWidth, rect.Height));
        context.FillRectangle(handleBrush,
            new Rect(rect.Width - HandleWidth, 0, HandleWidth, rect.Height));
    }
}
