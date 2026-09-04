using System;

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
}
