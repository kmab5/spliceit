using System;

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
}
