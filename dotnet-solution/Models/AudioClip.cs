using System;
using System.Text.Json.Serialization;
using CommunityToolkit.Mvvm.ComponentModel;

namespace SpliceIt.Models;

public enum CrossfadeCurve
{
    Linear,
    Exponential,
    EqualPower
}

public partial class AudioClip : ObservableObject
{
    [ObservableProperty]
    private string _id = Guid.NewGuid().ToString("N");

    [ObservableProperty]
    private string _name = "Clip";

    [ObservableProperty]
    private string _sourceFilePath = string.Empty;

    [ObservableProperty]
    private int _trackIndex = 0;

    /// <summary>
    /// Timeline start coordinate in seconds.
    /// </summary>
    [ObservableProperty]
    private double _timelineStartSeconds = 0.0;

    /// <summary>
    /// Non-destructive source audio read offset in seconds.
    /// </summary>
    [ObservableProperty]
    private double _clipOffsetSeconds = 0.0;

    /// <summary>
    /// Visible playback duration on the timeline.
    /// </summary>
    [ObservableProperty]
    private double _clipDurationSeconds = 10.0;

    /// <summary>
    /// Total duration of original source file.
    /// </summary>
    [ObservableProperty]
    private double _sourceDurationSeconds = 10.0;

    /// <summary>
    /// Clip-specific gain in dB.
    /// </summary>
    [ObservableProperty]
    private double _gainDb = 0.0;

    [ObservableProperty]
    private double _fadeInSeconds = 0.05;

    [ObservableProperty]
    private double _fadeOutSeconds = 0.05;

    [ObservableProperty]
    private CrossfadeCurve _crossfadeType = CrossfadeCurve.EqualPower;

    [ObservableProperty]
    private string _colorHex = "#00D2FF";

    /// <summary>
    /// Peak envelope of the decoded source, populated from AudioSampleCache on
    /// import or project load. Not serialised — it is derived data.
    /// </summary>
    [ObservableProperty]
    [property: JsonIgnore]
    private float[]? _peaks;

    /// <summary>Whether decoded audio is actually available for this clip.</summary>
    [ObservableProperty]
    [property: JsonIgnore]
    private bool _hasAudio;

    [JsonIgnore]
    public double EndSeconds => TimelineStartSeconds + ClipDurationSeconds;

    /// <summary>
    /// Evaluates gain factor at a specific timeline second for volume envelopes and fades.
    /// </summary>
    public float CalculateEnvelopeGain(double currentTimelineSec)
    {
        if (currentTimelineSec < TimelineStartSeconds || currentTimelineSec > EndSeconds)
            return 0.0f;

        double relSec = currentTimelineSec - TimelineStartSeconds;
        double remainingSec = EndSeconds - currentTimelineSec;
        float baseGain = (float)Math.Pow(10.0, GainDb / 20.0);

        // Fade-In envelope
        if (FadeInSeconds > 0 && relSec < FadeInSeconds)
        {
            float t = (float)(relSec / FadeInSeconds);
            baseGain *= CrossfadeType switch
            {
                CrossfadeCurve.Linear => t,
                CrossfadeCurve.Exponential => t * t,
                CrossfadeCurve.EqualPower => MathF.Sin(t * MathF.PI * 0.5f),
                _ => t
            };
        }

        // Fade-Out envelope
        if (FadeOutSeconds > 0 && remainingSec < FadeOutSeconds)
        {
            float t = (float)(remainingSec / FadeOutSeconds);
            baseGain *= CrossfadeType switch
            {
                CrossfadeCurve.Linear => t,
                CrossfadeCurve.Exponential => t * t,
                CrossfadeCurve.EqualPower => MathF.Sin(t * MathF.PI * 0.5f),
                _ => t
            };
        }

        return baseGain;
    }
}
