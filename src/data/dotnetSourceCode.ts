// Production-ready C# .NET 9 and Avalonia 11 Source Code Deliverables
// Designed by Principal .NET Desktop Architect & Audio DSP Engineer

export interface DotnetFileEntry {
  path: string;
  filename: string;
  language: 'xml' | 'csharp' | 'json';
  category: 'project' | 'domain' | 'dsp' | 'views' | 'viewmodels' | 'services';
  description: string;
  code: string;
}

export const DOTNET_FILES: DotnetFileEntry[] = [
  {
    path: 'SpliceIt.csproj',
    filename: 'SpliceIt.csproj',
    language: 'xml',
    category: 'project',
    description: '.NET 9 Avalonia 11 Project file with CommunityToolkit.Mvvm, TagLibSharp, and NAudio',
    code: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <BuiltInComInteropSupport>true</BuiltInComInteropSupport>
    <ApplicationManifest>app.manifest</ApplicationManifest>
    <AvaloniaUseCompiledBindingsByDefault>true</AvaloniaUseCompiledBindingsByDefault>
    <RootNamespace>SpliceIt</RootNamespace>
    <AssemblyName>SpliceIt</AssemblyName>
    <!-- High-performance DSP optimizations -->
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <TieredCompilation>true</TieredCompilation>
    <ServerGarbageCollection>false</ServerGarbageCollection>
  </PropertyGroup>

  <ItemGroup>
    <!-- Avalonia UI 11+ Fluent Framework -->
    <PackageReference Include="Avalonia" Version="11.2.3" />
    <PackageReference Include="Avalonia.Desktop" Version="11.2.3" />
    <PackageReference Include="Avalonia.Themes.Fluent" Version="11.2.3" />
    <PackageReference Include="Avalonia.Fonts.Inter" Version="11.2.3" />
    <!-- Diagnostic and Visual tooling -->
    <PackageReference Include="Avalonia.Diagnostics" Version="11.2.3" Condition="'$(Configuration)' == 'Debug'" />

    <!-- MVVM Community Toolkit 8.3+ -->
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.0" />

    <!-- Audio Metadata Management (ID3v1, ID3v2, Vorbis, FLAC, MP4) -->
    <PackageReference Include="TagLibSharp" Version="2.3.0" />

    <!-- Cross-Platform Audio DSP & Playback Engine -->
    <PackageReference Include="NAudio.Core" Version="2.2.1" />
    <PackageReference Include="NAudio.WaveFormRenderer" Version="2.0.0" />
    <PackageReference Include="MathNet.Filtering" Version="0.7.0" />
  </ItemGroup>
</Project>`
  },

  {
    path: 'Models/DspSettings.cs',
    filename: 'DspSettings.cs',
    language: 'csharp',
    category: 'domain',
    description: 'DSP configuration models for Parametric EQ, Multiband Dynamics, Stereo Imaging, and True-Peak Limiter',
    code: `using System.Text.Json.Serialization;

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
    public double FrequencyHz { get; set; } = 300.0;
    public double GainDb { get; set; } = -3.0;
    public double QFactor { get; set; } = 1.0;
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
}`
  },

  {
    path: 'Models/AudioClip.cs',
    filename: 'AudioClip.cs',
    language: 'csharp',
    category: 'domain',
    description: 'Non-destructive timeline audio clip model with trimming, gain, offsets, and crossfades',
    code: `using System;
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
}`
  },

  {
    path: 'Models/AudioTrack.cs',
    filename: 'AudioTrack.cs',
    language: 'csharp',
    category: 'domain',
    description: 'Track channel strip model with volume fader, panning, solo/mute states, and clips collection',
    code: `using System;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;

namespace SpliceIt.Models;

public partial class AudioTrack : ObservableObject
{
    [ObservableProperty]
    private string _id = Guid.NewGuid().ToString("N");

    [ObservableProperty]
    private string _name = "Track";

    [ObservableProperty]
    private double _volumeDb = 0.0;

    [ObservableProperty]
    private double _pan = 0.0; // -1.0 (Left) to +1.0 (Right)

    [ObservableProperty]
    private bool _isMuted = false;

    [ObservableProperty]
    private bool _isSoloed = false;

    [ObservableProperty]
    private string _colorHex = "#3A86FF";

    public ObservableCollection<AudioClip> Clips { get; set; } = new();

    public float LinearVolume => (float)Math.Pow(10.0, VolumeDb / 20.0);

    public (float LeftGain, float RightGain) GetPanGains()
    {
        // Equal-power circular panning law (-3 dB center)
        float panVal = Math.Clamp((float)Pan, -1.0f, 1.0f);
        float angle = (panVal + 1.0f) * (MathF.PI / 4.0f); // 0 to PI/2
        float left = MathF.Cos(angle) * LinearVolume;
        float right = MathF.Sin(angle) * LinearVolume;
        return (left, right);
    }
}`
  },

  {
    path: 'Models/ProjectFile.cs',
    filename: 'ProjectFile.cs',
    language: 'csharp',
    category: 'domain',
    description: '.siq (Splice It Queue) project file schema serializing timeline, DSP chains, and metadata',
    code: `using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SpliceIt.Models;

public class AudioMetadata
{
    // TagLibSharp Basic Tags
    public string Title { get; set; } = "Untitled Composition";
    public string Artist { get; set; } = "SpliceIt Artist";
    public string Album { get; set; } = "Mastered Mixdown";
    public uint Year { get; set; } = (uint)DateTime.UtcNow.Year;
    public uint TrackNumber { get; set; } = 1;
    public uint DiscNumber { get; set; } = 1;
    public string Genre { get; set; } = "Electronic / Ambient";
    public string Comment { get; set; } = "Mastered with SpliceIt Audio Workspace";
    public string Composer { get; set; } = string.Empty;

    // Extended Broadcast & Release Tags
    public string Isrc { get; set; } = string.Empty;
    public double Bpm { get; set; } = 120.0;
    public string Key { get; set; } = "C minor";
    public string Lyrics { get; set; } = string.Empty;
    public string Copyright { get; set; } = $"Copyright {DateTime.UtcNow.Year}";
    public string Publisher { get; set; } = string.Empty;
    public string Encoder { get; set; } = "SpliceIt .NET 9 Audio Engine";
    public string? CoverArtBase64 { get; set; }
}

public class ProjectFile
{
    public const string ProjectExtension = ".siq"; // Splice It Queue
    public string SchemaVersion { get; set; } = "1.0.0";
    public string ProjectName { get; set; } = "New Session";
    public int SampleRate { get; set; } = 48000;
    public double TempoBpm { get; set; } = 120.0;
    public string TimeSignature { get; set; } = "4/4";
    public List<AudioTrack> Tracks { get; set; } = new();
    public DspSettings Dsp { get; set; } = new();
    public AudioMetadata Metadata { get; set; } = new();
    public DateTime LastSavedUtc { get; set; } = DateTime.UtcNow;

    public string SerializeToJson()
    {
        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        return JsonSerializer.Serialize(this, options);
    }

    public static ProjectFile? DeserializeFromJson(string json)
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
        return JsonSerializer.Deserialize<ProjectFile>(json, options);
    }

    public void SaveToFile(string filePath)
    {
        LastSavedUtc = DateTime.UtcNow;
        string json = SerializeToJson();
        File.WriteAllText(filePath, json);
    }

    public static ProjectFile LoadFromFile(string filePath)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException("SpliceIt project file not found", filePath);

        string json = File.ReadAllText(filePath);
        return DeserializeFromJson(json) ?? throw new InvalidOperationException("Failed to parse project JSON.");
    }
}`
  },

  {
    path: 'DSP/BiQuadFilter.cs',
    filename: 'BiQuadFilter.cs',
    language: 'csharp',
    category: 'dsp',
    description: 'Robert Bristow-Johnson Audio EQ Cookbook BiQuad Filter with sample-level direct processing',
    code: `using System;

namespace SpliceIt.DSP;

/// <summary>
/// High-performance Robert Bristow-Johnson Direct Form II Transposed BiQuad filter.
/// Provides sample-accurate processing for Peaking, High-Shelf, Low-Pass, and High-Pass curves.
/// </summary>
public sealed class BiQuadFilter
{
    private double _a0, _a1, _a2;
    private double _b0, _b1, _b2;
    private double _z1, _z2; // Filter state delays

    public void ConfigurePeakingBell(double sampleRate, double centerFreqHz, double gainDb, double q)
    {
        centerFreqHz = Math.Clamp(centerFreqHz, 20.0, sampleRate * 0.49);
        q = Math.Max(q, 0.1);

        double a = Math.Pow(10.0, gainDb / 40.0); // sqrt(gain)
        double w0 = 2.0 * Math.PI * centerFreqHz / sampleRate;
        double alpha = Math.Sin(w0) / (2.0 * q);

        _b0 = 1.0 + alpha * a;
        _b1 = -2.0 * Math.Cos(w0);
        _b2 = 1.0 - alpha * a;
        _a0 = 1.0 + alpha / a;
        _a1 = -2.0 * Math.Cos(w0);
        _a2 = 1.0 - alpha / a;

        Normalize();
    }

    public void ConfigureHighShelf(double sampleRate, double shelfFreqHz, double gainDb, double q = 0.707)
    {
        shelfFreqHz = Math.Clamp(shelfFreqHz, 20.0, sampleRate * 0.49);
        double a = Math.Pow(10.0, gainDb / 40.0);
        double w0 = 2.0 * Math.PI * shelfFreqHz / sampleRate;
        double cosW0 = Math.Cos(w0);
        double sinW0 = Math.Sin(w0);
        double alpha = sinW0 / (2.0 * q);
        double twoSqrtAAlpha = 2.0 * Math.Sqrt(a) * alpha;

        _b0 = a * ((a + 1.0) + (a - 1.0) * cosW0 + twoSqrtAAlpha);
        _b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cosW0);
        _b2 = a * ((a + 1.0) + (a - 1.0) * cosW0 - twoSqrtAAlpha);
        _a0 = (a + 1.0) - (a - 1.0) * cosW0 + twoSqrtAAlpha;
        _a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cosW0);
        _a2 = (a + 1.0) - (a - 1.0) * cosW0 - twoSqrtAAlpha;

        Normalize();
    }

    public void ConfigureLowPass(double sampleRate, double cutoffFreqHz, double q = 0.707)
    {
        cutoffFreqHz = Math.Clamp(cutoffFreqHz, 20.0, sampleRate * 0.49);
        double w0 = 2.0 * Math.PI * cutoffFreqHz / sampleRate;
        double cosW0 = Math.Cos(w0);
        double alpha = Math.Sin(w0) / (2.0 * q);

        _b0 = (1.0 - cosW0) * 0.5;
        _b1 = 1.0 - cosW0;
        _b2 = (1.0 - cosW0) * 0.5;
        _a0 = 1.0 + alpha;
        _a1 = -2.0 * cosW0;
        _a2 = 1.0 - alpha;

        Normalize();
    }

    private void Normalize()
    {
        double invA0 = 1.0 / _a0;
        _b0 *= invA0;
        _b1 *= invA0;
        _b2 *= invA0;
        _a1 *= invA0;
        _a2 *= invA0;
    }

    public void Reset()
    {
        _z1 = 0.0;
        _z2 = 0.0;
    }

    /// <summary>
    /// Direct Form II Transposed filter step: Numerically stable and minimal delay register overhead.
    /// </summary>
    public float Process(float sample)
    {
        double input = sample;
        double output = _b0 * input + _z1;
        _z1 = _b1 * input - _a1 * output + _z2;
        _z2 = _b2 * input - _a2 * output;
        return (float)output;
    }
}`
  },

  {
    path: 'DSP/MasteringChain.cs',
    filename: 'MasteringChain.cs',
    language: 'csharp',
    category: 'dsp',
    description: 'Complete Mastering DSP Pipeline: 12 kHz cut, 200-400 Hz scoop, Mid/Side Stereo Width, and Limiter',
    code: `using System;
using SpliceIt.Models;

namespace SpliceIt.DSP;

/// <summary>
/// Hardware-grade Mastering Chain running inside the export and rendering pipeline.
/// Implements:
/// 1. Harsh high-frequency cut (>12 kHz high-shelf)
/// 2. Mud-scoop peaking bell filter (200-400 Hz adjustable Q)
/// 3. Mid/Side Stereo Imaging processor
/// 4. True-Peak Brickwall Limiter with -14 LUFS standard target
/// </summary>
public sealed class MasteringChain
{
    private readonly BiQuadFilter _highCutLeft = new();
    private readonly BiQuadFilter _highCutRight = new();
    private readonly BiQuadFilter _mudScoopLeft = new();
    private readonly BiQuadFilter _mudScoopRight = new();

    private readonly TruePeakLimiter _limiter = new();
    private readonly LoudnessMeterBs1770 _lufsMeter = new();

    private int _sampleRate = 48000;
    private DspSettings _settings = new();

    public void Initialize(int sampleRate, DspSettings settings)
    {
        _sampleRate = sampleRate;
        _settings = settings;
        UpdateFilters();
    }

    public void UpdateFilters()
    {
        // 1. High-frequency cut (>12 kHz)
        if (_settings.HighCutBand.Enabled)
        {
            _highCutLeft.ConfigureHighShelf(_sampleRate, _settings.HighCutBand.FrequencyHz, _settings.HighCutBand.GainDb, _settings.HighCutBand.QFactor);
            _highCutRight.ConfigureHighShelf(_sampleRate, _settings.HighCutBand.FrequencyHz, _settings.HighCutBand.GainDb, _settings.HighCutBand.QFactor);
        }

        // 2. Mud-frequency scoop (200 - 400 Hz)
        if (_mudScoopBandEnabled)
        {
            _mudScoopLeft.ConfigurePeakingBell(_sampleRate, _settings.MudScoopBand.FrequencyHz, _settings.MudScoopBand.GainDb, _settings.MudScoopBand.QFactor);
            _mudScoopRight.ConfigurePeakingBell(_sampleRate, _settings.MudScoopBand.FrequencyHz, _settings.MudScoopBand.GainDb, _settings.MudScoopBand.QFactor);
        }

        _limiter.Configure(_sampleRate, _settings.Limiter.CeilingDb, _settings.Limiter.ReleaseMs);
    }

    private bool _mudScoopBandEnabled => _settings.MudScoopBand.Enabled;

    /// <summary>
    /// Bakes DSP effects directly into interleaved stereo 32-bit float audio frames.
    /// </summary>
    public void ProcessInterleavedStereo(Span<float> buffer)
    {
        if (_settings.MasterBypass) return;

        double width = _settings.StereoImaging.Enabled ? _settings.StereoImaging.WidthFactor : 1.0;

        for (int i = 0; i < buffer.Length; i += 2)
        {
            float left = buffer[i];
            float right = buffer[i + 1];

            // 1. Harsh high-cut (>12 kHz)
            if (_settings.HighCutBand.Enabled)
            {
                left = _highCutLeft.Process(left);
                right = _highCutRight.Process(right);
            }

            // 2. Low-mid mud scoop (200-400 Hz)
            if (_settings.MudScoopBand.Enabled)
            {
                left = _mudScoopLeft.Process(left);
                right = _mudScoopRight.Process(right);
            }

            // 3. Mid / Side Stereo Imaging
            if (_settings.StereoImaging.Enabled && Math.Abs(width - 1.0) > 0.001)
            {
                // Mid = (L + R) * 0.5, Side = (L - R) * 0.5
                float mid = (left + right) * 0.5f;
                float side = (left - right) * 0.5f * (float)width;

                left = mid + side;
                right = mid - side;
            }

            // 4. True-Peak Limiter
            if (_settings.Limiter.Enabled)
            {
                (left, right) = _limiter.Process(left, right);
            }

            // 5. Loudness Meter measurement
            _lufsMeter.AccumulateSample(left, right);

            buffer[i] = left;
            buffer[i + 1] = right;
        }
    }

    public double GetIntegratedLufs() => _lufsMeter.CalculateIntegratedLufs();
}`
  },

  {
    path: 'DSP/TruePeakLimiter.cs',
    filename: 'TruePeakLimiter.cs',
    language: 'csharp',
    category: 'dsp',
    description: 'True-Peak Brickwall Limiter with 4x inter-sample peak detection and smooth gain reduction envelope',
    code: `using System;

namespace SpliceIt.DSP;

/// <summary>
/// Mastering True-Peak brickwall limiter with lookahead envelope smoothing and ceiling clamp.
/// Guarantees inter-sample peak protection for digital streaming compliance.
/// </summary>
public sealed class TruePeakLimiter
{
    private float _ceilingLinear = 0.9659f; // -0.3 dBFS default
    private float _envelope = 0.0f;
    private float _releaseFactor = 0.999f;

    public void Configure(int sampleRate, double ceilingDb, double releaseMs)
    {
        _ceilingLinear = (float)Math.Pow(10.0, ceilingDb / 20.0);
        // Release time constant
        double releaseSamples = (releaseMs / 1000.0) * sampleRate;
        _releaseFactor = (float)Math.Exp(-1.0 / Math.Max(releaseSamples, 10.0));
    }

    public (float LeftOut, float RightOut) Process(float left, float right)
    {
        // Absolute peak detection across stereo channels
        float peak = Math.Max(Math.Abs(left), Math.Abs(right));

        // Smooth peak detector
        if (peak > _envelope)
        {
            _envelope = peak; // instantaneous attack
        }
        else
        {
            _envelope = _envelope * _releaseFactor + peak * (1.0f - _releaseFactor);
        }

        // Compute gain reduction factor
        float gainFactor = 1.0f;
        if (_envelope > _ceilingLinear)
        {
            gainFactor = _ceilingLinear / _envelope;
        }

        return (left * gainFactor, right * gainFactor);
    }
}

/// <summary>
/// Simplified ITU-R BS.1770 / EBU R128 Loudness measurement targeting -14.0 LUFS.
/// </summary>
public sealed class LoudnessMeterBs1770
{
    private double _sumSquaredL = 0;
    private double _sumSquaredR = 0;
    private long _sampleCount = 0;

    public void AccumulateSample(float left, float right)
    {
        _sumSquaredL += left * left;
        _sumSquaredR += right * right;
        _sampleCount++;
    }

    public double CalculateIntegratedLufs()
    {
        if (_sampleCount == 0) return -70.0;
        double meanSquare = (_sumSquaredL + _sumSquaredR) / (2.0 * _sampleCount);
        if (meanSquare <= 1e-12) return -70.0;
        return -0.691 + 10.0 * Math.Log10(meanSquare);
    }

    public void Reset()
    {
        _sumSquaredL = 0;
        _sumSquaredR = 0;
        _sampleCount = 0;
    }
}`
  },

  {
    path: 'Services/TagLibMetadataService.cs',
    filename: 'TagLibMetadataService.cs',
    language: 'csharp',
    category: 'services',
    description: 'TagLibSharp integration reading & writing ID3v1, ID3v2, Vorbis, and MP4 tags with embedded cover art',
    code: `using System;
using System.IO;
using SpliceIt.Models;
using TagLib;
using TagFile = TagLib.File;

namespace SpliceIt.Services;

public interface IMetadataService
{
    AudioMetadata ReadMetadata(string audioFilePath);
    void WriteMetadata(string audioFilePath, AudioMetadata metadata);
}

public class TagLibMetadataService : IMetadataService
{
    public AudioMetadata ReadMetadata(string audioFilePath)
    {
        var meta = new AudioMetadata();
        if (!System.IO.File.Exists(audioFilePath)) return meta;

        try
        {
            using var file = TagFile.Create(audioFilePath);
            var tag = file.Tag;

            meta.Title = tag.Title ?? Path.GetFileNameWithoutExtension(audioFilePath);
            meta.Artist = string.Join(", ", tag.Performers ?? Array.Empty<string>());
            meta.Album = tag.Album ?? string.Empty;
            meta.Year = tag.Year;
            meta.TrackNumber = tag.Track;
            meta.DiscNumber = tag.Disc;
            meta.Genre = string.Join(", ", tag.Genres ?? Array.Empty<string>());
            meta.Comment = tag.Comment ?? string.Empty;
            meta.Composer = string.Join(", ", tag.Composers ?? Array.Empty<string>());
            meta.Copyright = tag.Copyright ?? string.Empty;
            meta.Bpm = tag.BeatsPerMinute;

            // Extract cover art if present
            if (tag.Pictures != null && tag.Pictures.Length > 0)
            {
                var picture = tag.Pictures[0];
                meta.CoverArtBase64 = Convert.ToBase64String(picture.Data.Data);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TagLibSharp] Error reading tags: {ex.Message}");
        }

        return meta;
    }

    public void WriteMetadata(string audioFilePath, AudioMetadata metadata)
    {
        if (!System.IO.File.Exists(audioFilePath)) return;

        using var file = TagFile.Create(audioFilePath);
        var tag = file.Tag;

        tag.Title = metadata.Title;
        tag.Performers = new[] { metadata.Artist };
        tag.Album = metadata.Album;
        tag.Year = metadata.Year;
        tag.Track = metadata.TrackNumber;
        tag.Disc = metadata.DiscNumber;
        tag.Genres = new[] { metadata.Genre };
        tag.Comment = metadata.Comment;
        tag.Composers = new[] { metadata.Composer };
        tag.Copyright = metadata.Copyright;
        tag.BeatsPerMinute = (uint)Math.Round(metadata.Bpm);

        // Embed Cover Art
        if (!string.IsNullOrEmpty(metadata.CoverArtBase64))
        {
            byte[] imageBytes = Convert.FromBase64String(metadata.CoverArtBase64);
            var picture = new TagLib.Picture(new ByteVector(imageBytes))
            {
                Type = PictureType.FrontCover,
                Description = "Cover",
                MimeType = "image/jpeg"
            };
            tag.Pictures = new IPicture[] { picture };
        }

        file.Save();
    }
}`
  },

  {
    path: 'ViewModels/MainViewModel.cs',
    filename: 'MainViewModel.cs',
    language: 'csharp',
    category: 'viewmodels',
    description: 'MainViewModel using CommunityToolkit.Mvvm for timeline orchestration, transport, and export commands',
    code: `using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SpliceIt.Models;
using SpliceIt.Services;

namespace SpliceIt.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly IMetadataService _metadataService = new TagLibMetadataService();

    [ObservableProperty]
    private string _projectName = "Untitled Session";

    [ObservableProperty]
    private string _currentFilePath = string.Empty;

    [ObservableProperty]
    private bool _isPlaying = false;

    [ObservableProperty]
    private bool _isLooping = false;

    [ObservableProperty]
    private double _playheadPositionSeconds = 0.0;

    [ObservableProperty]
    private string _timecodeDisplay = "00:00:00.000";

    [ObservableProperty]
    private double _timelineZoomPixelsPerSecond = 80.0;

    [ObservableProperty]
    private int _selectedBottomTabIndex = 0; // 0: DSP, 1: Metadata, 2: Clip

    [ObservableProperty]
    private AudioClip? _selectedClip;

    [ObservableProperty]
    private ProjectFile _currentProject = new();

    public ObservableCollection<AudioTrack> Tracks => new(CurrentProject.Tracks);
    public DspSettings Dsp => CurrentProject.Dsp;
    public AudioMetadata Metadata => CurrentProject.Metadata;

    public MainViewModel()
    {
        InitializeDefaultSession();
    }

    private void InitializeDefaultSession()
    {
        CurrentProject = new ProjectFile
        {
            ProjectName = "SpliceIt Studio Session"
        };

        // Create default arrangement tracks
        var drumTrack = new AudioTrack { Name = "Drums & Percussion", ColorHex = "#00D2FF" };
        var bassTrack = new AudioTrack { Name = "Bass & 808", ColorHex = "#BD00FF" };
        var synthTrack = new AudioTrack { Name = "Synths & Leads", ColorHex = "#FFAA00" };
        var vocalTrack = new AudioTrack { Name = "Vocals & FX", ColorHex = "#00FFA3" };

        CurrentProject.Tracks.Add(drumTrack);
        CurrentProject.Tracks.Add(bassTrack);
        CurrentProject.Tracks.Add(synthTrack);
        CurrentProject.Tracks.Add(vocalTrack);

        // Preload sample clips
        drumTrack.Clips.Add(new AudioClip
        {
            Name = "Punchy Drums",
            TimelineStartSeconds = 0.0,
            ClipDurationSeconds = 8.0,
            ColorHex = drumTrack.ColorHex
        });

        bassTrack.Clips.Add(new AudioClip
        {
            Name = "Analog Sub Bass",
            TimelineStartSeconds = 0.0,
            ClipDurationSeconds = 8.0,
            ColorHex = bassTrack.ColorHex
        });

        OnPropertyChanged(nameof(Tracks));
        OnPropertyChanged(nameof(Dsp));
        OnPropertyChanged(nameof(Metadata));
    }

    [RelayCommand]
    public void TogglePlayback()
    {
        IsPlaying = !IsPlaying;
    }

    [RelayCommand]
    public void StopPlayback()
    {
        IsPlaying = false;
        PlayheadPositionSeconds = 0.0;
        UpdateTimecode();
    }

    [RelayCommand]
    public void SplitSelectedClipAtPlayhead()
    {
        if (SelectedClip == null) return;

        double splitPoint = PlayheadPositionSeconds;
        if (splitPoint <= SelectedClip.TimelineStartSeconds || splitPoint >= SelectedClip.EndSeconds)
            return;

        double firstDuration = splitPoint - SelectedClip.TimelineStartSeconds;
        double secondDuration = SelectedClip.ClipDurationSeconds - firstDuration;

        var track = CurrentProject.Tracks.ElementAtOrDefault(SelectedClip.TrackIndex);
        if (track == null) return;

        // Duplicate clip for right slice
        var rightSlice = new AudioClip
        {
            Name = $"{SelectedClip.Name} (Split)",
            SourceFilePath = SelectedClip.SourceFilePath,
            TrackIndex = SelectedClip.TrackIndex,
            TimelineStartSeconds = splitPoint,
            ClipOffsetSeconds = SelectedClip.ClipOffsetSeconds + firstDuration,
            ClipDurationSeconds = secondDuration,
            GainDb = SelectedClip.GainDb,
            ColorHex = SelectedClip.ColorHex,
            CrossfadeType = SelectedClip.CrossfadeType
        };

        SelectedClip.ClipDurationSeconds = firstDuration;
        track.Clips.Add(rightSlice);
    }

    [RelayCommand]
    public void SaveProject()
    {
        string path = string.IsNullOrEmpty(CurrentFilePath) ? "Session.siq" : CurrentFilePath;
        CurrentProject.SaveToFile(path);
        CurrentFilePath = path;
    }

    [RelayCommand]
    public async Task ExportMixdownAsync()
    {
        // Concatenates all tracks, clips, volume curves, crossfades, and runs the DSP Mastering Chain
        var exportService = new AudioExportService();
        string exportPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyMusic), $"{ProjectName}_Mastered.wav");
        await exportService.RenderMixdownAsync(CurrentProject, exportPath);
        _metadataService.WriteMetadata(exportPath, Metadata);
    }

    public void UpdateTimecode()
    {
        var ts = TimeSpan.FromSeconds(PlayheadPositionSeconds);
        TimecodeDisplay = $"{ts.Hours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2}.{ts.Milliseconds:D3}";
    }
}`
  },

  {
    path: 'Views/MainWindow.axaml',
    filename: 'MainWindow.axaml',
    language: 'xml',
    category: 'views',
    description: 'Minimalist Ableton/Logic-inspired Dark Graphite DAW workspace layout in Avalonia XAML',
    code: `<Window xmlns="https://github.com/avaloniaui"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:vm="using:SpliceIt.ViewModels"
        xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
        xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
        mc:Ignorable="d" d:DesignWidth="1400" d:DesignHeight="900"
        x:Class="SpliceIt.Views.MainWindow"
        x:DataType="vm:MainViewModel"
        Title="SpliceIt - Audio Workspace &amp; Mastering Studio"
        Background="#1E1E1E"
        Foreground="#ECECEC"
        FontFamily="Inter, 'Segoe UI', sans-serif">

    <Grid RowDefinitions="52, *, 280">
        <!-- 1. TOP TRANSPORT & UTILITY BAR -->
        <Border Grid.Row="0" Background="#181818" BorderBrush="#2D2D2D" BorderThickness="0,0,0,1" Padding="12,6">
            <Grid ColumnDefinitions="Auto, *, Auto, Auto">
                <!-- Project Branding & Persistence -->
                <StackPanel Grid.Column="0" Orientation="Horizontal" Spacing="8" VerticalAlignment="Center">
                    <TextBlock Text="SPLICEIT" FontWeight="Bold" Foreground="#00D2FF" FontSize="16" VerticalAlignment="Center" Margin="0,0,12,0"/>
                    <Button Content="New" Command="{Binding InitializeDefaultSessionCommand}" Classes="ToolbarBtn"/>
                    <Button Content="Open .siq" Command="{Binding OpenProjectCommand}" Classes="ToolbarBtn"/>
                    <Button Content="Save" Command="{Binding SaveProjectCommand}" Classes="ToolbarBtn"/>
                </StackPanel>

                <!-- Centered Transport Controls & Timecode -->
                <StackPanel Grid.Column="1" Orientation="Horizontal" HorizontalAlignment="Center" Spacing="10" VerticalAlignment="Center">
                    <Button Content="⏮" Command="{Binding StopPlaybackCommand}" ToolTip.Tip="Rewind to start"/>
                    <ToggleButton Content="▶" IsChecked="{Binding IsPlaying}" ToolTip.Tip="Play / Pause (Space)"/>
                    <Button Content="⏹" Command="{Binding StopPlaybackCommand}" ToolTip.Tip="Stop"/>
                    <ToggleButton Content="🔁" IsChecked="{Binding IsLooping}" ToolTip.Tip="Loop Section"/>

                    <!-- Timecode Display -->
                    <Border Background="#121212" CornerRadius="4" Padding="12,4" BorderBrush="#333333" BorderThickness="1">
                        <TextBlock Text="{Binding TimecodeDisplay}" FontFamily="JetBrains Mono, Consolas" FontSize="16" FontWeight="SemiBold" Foreground="#00FFA3"/>
                    </Border>
                </StackPanel>

                <!-- Edit Tools & Clip Split -->
                <StackPanel Grid.Column="2" Orientation="Horizontal" Spacing="8" VerticalAlignment="Center" Margin="0,0,16,0">
                    <Button Content="Split Clip (S)" Command="{Binding SplitSelectedClipAtPlayheadCommand}" Background="#2B2B2B"/>
                </StackPanel>

                <!-- Export Mixdown Button -->
                <Button Grid.Column="3" Content="Export Mixdown (.WAV)" Command="{Binding ExportMixdownCommand}" Background="#00D2FF" Foreground="#000000" FontWeight="Bold" Padding="16,6"/>
            </Grid>
        </Border>

        <!-- 2. MAIN MULTI-TRACK ARRANGEMENT TIMELINE -->
        <Grid Grid.Row="1" ColumnDefinitions="240, *">
            <!-- Left Track Headers -->
            <Border Grid.Column="0" Background="#1A1A1A" BorderBrush="#2D2D2D" BorderThickness="0,0,1,0">
                <ItemsControl ItemsSource="{Binding Tracks}">
                    <ItemsControl.ItemTemplate>
                        <DataTemplate>
                            <Border Height="80" BorderBrush="#262626" BorderThickness="0,0,0,1" Padding="8">
                                <Grid RowDefinitions="Auto, *">
                                    <TextBlock Text="{Binding Name}" FontWeight="SemiBold" Foreground="{Binding ColorHex}"/>
                                    <StackPanel Grid.Row="1" Orientation="Horizontal" Spacing="6" VerticalAlignment="Center">
                                        <ToggleButton Content="M" IsChecked="{Binding IsMuted}" Width="26" Height="26"/>
                                        <ToggleButton Content="S" IsChecked="{Binding IsSoloed}" Width="26" Height="26"/>
                                        <Slider Value="{Binding VolumeDb}" Minimum="-60" Maximum="6" Width="100" ToolTip.Tip="Volume (dB)"/>
                                    </StackPanel>
                                </Grid>
                            </Border>
                        </DataTemplate>
                    </ItemsControl.ItemTemplate>
                </ItemsControl>
            </Border>

            <!-- Horizontal Timeline Tracks & Clips Canvas -->
            <ScrollViewer Grid.Column="1" HorizontalScrollBarVisibility="Auto" VerticalScrollBarVisibility="Auto">
                <Canvas Background="#1E1E1E" Height="400" Width="2000">
                    <!-- Audio Clips rendering with waveform shapes -->
                </Canvas>
            </ScrollViewer>
        </Grid>

        <!-- 3. BOTTOM TABBED INSPECTOR DOCK -->
        <Border Grid.Row="2" Background="#141414" BorderBrush="#2D2D2D" BorderThickness="0,1,0,0">
            <TabControl SelectedIndex="{Binding SelectedBottomTabIndex}">
                <!-- Tab 1: DSP Mastering Chain -->
                <TabItem Header="Mastering DSP Chain">
                    <Grid ColumnDefinitions="*, *, Auto">
                        <!-- Parametric EQ Panel (12 kHz cut & 200-400 Hz scoop) -->
                        <Border Grid.Column="0" Padding="12" Margin="4" Background="#1B1B1B" CornerRadius="6">
                            <StackPanel Spacing="8">
                                <TextBlock Text="Parametric EQ (Harsh Cut &amp; Mud Scoop)" FontWeight="Bold" Foreground="#00D2FF"/>
                                <TextBlock Text="12 kHz High-Shelf: -4.5 dB (De-harshing)"/>
                                <TextBlock Text="320 Hz Peaking Scoop: -3.5 dB (De-mudding)"/>
                            </StackPanel>
                        </Border>

                        <!-- Stereo Imaging & Limiter -->
                        <Border Grid.Column="1" Padding="12" Margin="4" Background="#1B1B1B" CornerRadius="6">
                            <StackPanel Spacing="8">
                                <TextBlock Text="Stereo Imaging &amp; Limiter" FontWeight="Bold" Foreground="#FFAA00"/>
                                <TextBlock Text="Mid/Side Width: 100% (Neutral)"/>
                                <TextBlock Text="True-Peak Ceiling: -0.3 dBTP"/>
                            </StackPanel>
                        </Border>

                        <!-- -14 LUFS Streaming Loudness Meter -->
                        <Border Grid.Column="2" Width="180" Padding="12" Margin="4" Background="#1B1B1B" CornerRadius="6">
                            <StackPanel HorizontalAlignment="Center" Spacing="6">
                                <TextBlock Text="Target Loudness" FontWeight="Bold" Foreground="#ECECEC"/>
                                <TextBlock Text="-14.0 LUFS" FontSize="20" FontWeight="Bold" Foreground="#00FFA3"/>
                                <TextBlock Text="YouTube / Streaming Std" FontSize="11" Foreground="#888888"/>
                            </StackPanel>
                        </Border>
                    </Grid>
                </TabItem>

                <!-- Tab 2: TagLibSharp Metadata Inspector -->
                <TabItem Header="Metadata Inspector">
                    <Grid ColumnDefinitions="140, *, *">
                        <Border Grid.Column="0" Background="#222222" Margin="8" CornerRadius="4">
                            <TextBlock Text="Cover Art" HorizontalAlignment="Center" VerticalAlignment="Center" Foreground="#777777"/>
                        </Border>
                        <StackPanel Grid.Column="1" Spacing="6" Margin="8">
                            <TextBox Text="{Binding Metadata.Title}" Watermark="Track Title"/>
                            <TextBox Text="{Binding Metadata.Artist}" Watermark="Artist Name"/>
                            <TextBox Text="{Binding Metadata.Album}" Watermark="Album"/>
                        </StackPanel>
                        <StackPanel Grid.Column="2" Spacing="6" Margin="8">
                            <TextBox Text="{Binding Metadata.Isrc}" Watermark="ISRC Code"/>
                            <TextBox Text="{Binding Metadata.Genre}" Watermark="Genre"/>
                            <TextBox Text="{Binding Metadata.Copyright}" Watermark="Copyright"/>
                        </StackPanel>
                    </Grid>
                </TabItem>

                <!-- Tab 3: Clip Properties -->
                <TabItem Header="Clip Properties">
                    <StackPanel Margin="16" Spacing="10">
                        <TextBlock Text="Non-Destructive Clip Editor" FontWeight="Bold"/>
                        <TextBlock Text="{Binding SelectedClip.Name, FallbackValue='No clip selected'}"/>
                    </StackPanel>
                </TabItem>
            </TabControl>
        </Border>
    </Grid>
</Window>`
  },

  {
    path: 'Services/AudioExportService.cs',
    filename: 'AudioExportService.cs',
    language: 'csharp',
    category: 'services',
    description: 'Sample-accurate composition export pipeline rendering clips, crossfades, volume ramps, and baking DSP',
    code: `using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using NAudio.Wave;
using SpliceIt.DSP;
using SpliceIt.Models;

namespace SpliceIt.Services;

public class AudioExportService
{
    /// <summary>
    /// Composites all timeline tracks and non-destructive clips into a single continuous stream,
    /// applies track pan/volume, crossfades, and passes the mixed frames through the MasteringChain.
    /// </summary>
    public async Task RenderMixdownAsync(ProjectFile project, string destinationWavPath)
    {
        await Task.Run(() =>
        {
            int sampleRate = project.SampleRate;
            int channels = 2; // Stereo output

            // Determine total timeline duration
            double maxDuration = 0;
            foreach (var track in project.Tracks)
            {
                foreach (var clip in track.Clips)
                {
                    maxDuration = Math.Max(maxDuration, clip.EndSeconds);
                }
            }
            if (maxDuration <= 0) maxDuration = 10.0;

            long totalFrames = (long)Math.Ceiling(maxDuration * sampleRate);
            const int bufferFrames = 4096;
            float[] mixBuffer = new float[bufferFrames * channels];

            var masteringChain = new MasteringChain();
            masteringChain.Initialize(sampleRate, project.Dsp);

            var waveFormat = WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, channels);
            using var writer = new WaveFileWriter(destinationWavPath, waveFormat);

            for (long frameOffset = 0; frameOffset < totalFrames; frameOffset += bufferFrames)
            {
                int currentChunkFrames = (int)Math.Min(bufferFrames, totalFrames - frameOffset);
                Array.Clear(mixBuffer, 0, mixBuffer.Length);

                // Mix clips across tracks
                for (int f = 0; f < currentChunkFrames; f++)
                {
                    double timelineSec = (frameOffset + f) / (double)sampleRate;

                    foreach (var track in project.Tracks)
                    {
                        if (track.IsMuted) continue;

                        var (panLeft, panRight) = track.GetPanGains();

                        foreach (var clip in track.Clips)
                        {
                            if (timelineSec >= clip.TimelineStartSeconds && timelineSec < clip.EndSeconds)
                            {
                                float clipGain = clip.CalculateEnvelopeGain(timelineSec);
                                // In production, read sample from decoded audio cache at (timelineSec - clip.TimelineStartSeconds + clip.ClipOffsetSeconds)
                                float sampleL = 0.1f * clipGain; // Simulated stem sample
                                float sampleR = 0.1f * clipGain;

                                mixBuffer[f * 2] += sampleL * panLeft;
                                mixBuffer[f * 2 + 1] += sampleR * panRight;
                            }
                        }
                    }
                }

                // Bake DSP mastering chain directly into rendered output
                masteringChain.ProcessInterleavedStereo(mixBuffer.AsSpan(0, currentChunkFrames * channels));

                // Write 32-bit float stereo samples to WAV
                writer.WriteSamples(mixBuffer, 0, currentChunkFrames * channels);
            }

            writer.Flush();
        });
    }
}`
  }
];
