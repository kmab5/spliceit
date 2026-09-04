using System.Text.Json.Serialization;

namespace SpliceIt.Models;

public enum FilterType
{
    HighShelf,
    PeakingBell,
    LowPass,
    HighPass
}

public class ParametricBandConfig
{
    public FilterType Type { get; set; } = FilterType.PeakingBell;
    public double FrequencyHz { get; set; } = 320.0;
    public double GainDb { get; set; } = -3.5;
    public double QFactor { get; set; } = 1.414;
    public bool Enabled { get; set; } = true;
}

public class MultibandBandConfig
{
    public double ThresholdDb { get; set; } = -18.0;
    public double Ratio { get; set; } = 3.0; // 3:1
    public double AttackMs { get; set; } = 15.0;
    public double ReleaseMs { get; set; } = 120.0;
    public double MakeupGainDb { get; set; } = 0.0;
}

public class MultibandCompressorConfig
{
    public bool Enabled { get; set; } = true;
    public double LowCrossoverHz { get; set; } = 250.0;
    public double HighCrossoverHz { get; set; } = 4000.0;
    public MultibandBandConfig LowBand { get; set; } = new();
    public MultibandBandConfig MidBand { get; set; } = new();
    public MultibandBandConfig HighBand { get; set; } = new();
}

public class StereoImagingConfig
{
    public bool Enabled { get; set; } = true;
    /// <summary>
    /// Stereo width coefficient: 0.0 = Pure Mono, 1.0 = Neutral Stereo, 2.0 = Exaggerated Wide.
    /// </summary>
    public double WidthFactor { get; set; } = 1.0;
}

public class TruePeakLimiterConfig
{
    public bool Enabled { get; set; } = true;
    public double CeilingDb { get; set; } = -0.3; // -0.3 dBFS True-Peak Ceiling
    public double ReleaseMs { get; set; } = 50.0;
    /// <summary>
    /// Streaming and Broadcast Loudness target (e.g. -14.0 LUFS for YouTube / Spotify).
    /// </summary>
    public double TargetLufs { get; set; } = -14.0;
}

public class DspSettings
{
    public bool MasterBypass { get; set; } = false;

    // Directives: Harsh high-cut (>12 kHz)
    public ParametricBandConfig HighCutBand { get; set; } = new()
    {
        Type = FilterType.HighShelf,
        FrequencyHz = 12000.0,
        GainDb = -4.5,
        QFactor = 0.707,
        Enabled = true
    };

    // Directives: Mud scoop (200 Hz - 400 Hz)
    public ParametricBandConfig MudScoopBand { get; set; } = new()
    {
        Type = FilterType.PeakingBell,
        FrequencyHz = 320.0,
        GainDb = -3.5,
        QFactor = 1.414,
        Enabled = true
    };

    public MultibandCompressorConfig Multiband { get; set; } = new();
    public StereoImagingConfig StereoImaging { get; set; } = new();
    public TruePeakLimiterConfig Limiter { get; set; } = new();
}
