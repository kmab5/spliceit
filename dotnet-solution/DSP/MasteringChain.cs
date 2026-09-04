using System;
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
        if (_settings.MudScoopBand.Enabled)
        {
            _mudScoopLeft.ConfigurePeakingBell(_sampleRate, _settings.MudScoopBand.FrequencyHz, _settings.MudScoopBand.GainDb, _settings.MudScoopBand.QFactor);
            _mudScoopRight.ConfigurePeakingBell(_sampleRate, _settings.MudScoopBand.FrequencyHz, _settings.MudScoopBand.GainDb, _settings.MudScoopBand.QFactor);
        }

        _limiter.Configure(_sampleRate, _settings.Limiter.CeilingDb, _settings.Limiter.ReleaseMs);
    }

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
}
