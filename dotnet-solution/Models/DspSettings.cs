using CommunityToolkit.Mvvm.ComponentModel;

namespace SpliceIt.Models;

public enum FilterType
{
    HighShelf,
    PeakingBell,
    LowPass,
    HighPass
}

// NOTE (Phase 0): every config type below was a plain POCO. Sliders in
// MainWindow.axaml bind two-way into these, so without INotifyPropertyChanged
// the UI could write values but never reflect changes made anywhere else, and
// nothing could observe a change in order to rebuild the filter coefficients.
// They are now ObservableObject so the DSP chain can react to edits.

public partial class ParametricBandConfig : ObservableObject
{
    [ObservableProperty]
    private FilterType _type = FilterType.PeakingBell;

    [ObservableProperty]
    private double _frequencyHz = 320.0;

    [ObservableProperty]
    private double _gainDb = -3.5;

    [ObservableProperty]
    private double _qFactor = 1.414;

    [ObservableProperty]
    private bool _enabled = true;
}

public partial class MultibandBandConfig : ObservableObject
{
    [ObservableProperty]
    private double _thresholdDb = -18.0;

    [ObservableProperty]
    private double _ratio = 3.0; // 3:1

    [ObservableProperty]
    private double _attackMs = 15.0;

    [ObservableProperty]
    private double _releaseMs = 120.0;

    [ObservableProperty]
    private double _makeupGainDb = 0.0;
}

public partial class MultibandCompressorConfig : ObservableObject
{
    [ObservableProperty]
    private bool _enabled = true;

    [ObservableProperty]
    private double _lowCrossoverHz = 250.0;

    [ObservableProperty]
    private double _highCrossoverHz = 4000.0;

    public MultibandBandConfig LowBand { get; set; } = new();
    public MultibandBandConfig MidBand { get; set; } = new();
    public MultibandBandConfig HighBand { get; set; } = new();
}

public partial class StereoImagingConfig : ObservableObject
{
    [ObservableProperty]
    private bool _enabled = true;

    /// <summary>
    /// Stereo width coefficient: 0.0 = Pure Mono, 1.0 = Neutral Stereo, 2.0 = Exaggerated Wide.
    /// </summary>
    [ObservableProperty]
    private double _widthFactor = 1.0;
}

public partial class TruePeakLimiterConfig : ObservableObject
{
    [ObservableProperty]
    private bool _enabled = true;

    [ObservableProperty]
    private double _ceilingDb = -0.3; // -0.3 dBFS True-Peak Ceiling

    [ObservableProperty]
    private double _releaseMs = 50.0;

    /// <summary>
    /// Streaming and Broadcast Loudness target (e.g. -14.0 LUFS for YouTube / Spotify).
    /// </summary>
    [ObservableProperty]
    private double _targetLufs = -14.0;
}

public partial class DspSettings : ObservableObject
{
    [ObservableProperty]
    private bool _masterBypass = false;

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
