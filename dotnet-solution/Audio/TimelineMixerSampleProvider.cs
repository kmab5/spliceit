using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using NAudio.Wave;
using SpliceIt.Models;
using SpliceIt.Services;

namespace SpliceIt.Audio;

/// <summary>
/// Composites every clip on the timeline into a single interleaved stereo
/// stream, applying clip gain, fade envelopes, track volume and equal-power pan.
///
/// The same provider drives realtime playback and offline export, so a render
/// cannot drift from what was auditioned — the failure mode the React app had
/// before its master fader was wired into both paths.
/// </summary>
public sealed class TimelineMixerSampleProvider : ISampleProvider
{
    private sealed class ClipRender
    {
        public required float[] Samples { get; init; }
        public required long StartFrame { get; init; }
        public required long EndFrame { get; init; }
        public required long SourceOffsetFrame { get; init; }
        public required float Gain { get; init; }
        public required long FadeInFrames { get; init; }
        public required long FadeOutFrames { get; init; }
        public required CrossfadeCurve Curve { get; init; }
    }

    private sealed class TrackRender
    {
        public required float PanLeft { get; init; }
        public required float PanRight { get; init; }
        public required List<ClipRender> Clips { get; init; }
    }

    private readonly List<TrackRender> _tracks;
    private readonly int _sampleRate;
    private long _positionFrames;

    public WaveFormat WaveFormat { get; }

    /// <summary>Total timeline length in frames. Read past this returns silence/EOF.</summary>
    public long LengthFrames { get; }

    public bool LoopEnabled { get; set; }
    public long LoopStartFrame { get; set; }
    public long LoopEndFrame { get; set; }

    /// <summary>Master fader, applied last. Set to 0 for mute.</summary>
    public float MasterGain { get; set; } = 1.0f;

    public long PositionFrames
    {
        get => Interlocked.Read(ref _positionFrames);
        set => Interlocked.Exchange(ref _positionFrames, Math.Max(0, value));
    }

    public double CurrentTimeSeconds => (double)PositionFrames / _sampleRate;

    public double TotalSeconds => (double)LengthFrames / _sampleRate;

    public TimelineMixerSampleProvider(
        ProjectFile project,
        AudioSampleCache cache,
        int sampleRate,
        double timelineSeconds)
    {
        _sampleRate = sampleRate;
        WaveFormat = WaveFormat.CreateIeeeFloatWaveFormat(sampleRate, 2);
        _tracks = BuildTracks(project, cache, sampleRate);

        double longestClipEnd = project.Tracks
            .SelectMany(t => t.Clips)
            .Select(c => c.EndSeconds)
            .DefaultIfEmpty(0.0)
            .Max();

        double total = Math.Max(timelineSeconds, longestClipEnd);
        LengthFrames = (long)Math.Ceiling(Math.Max(0.0, total) * sampleRate);
    }

    private static List<TrackRender> BuildTracks(
        ProjectFile project, AudioSampleCache cache, int sampleRate)
    {
        var result = new List<TrackRender>();

        // Solo wins over mute, matching every DAW convention and the React engine.
        bool soloActive = project.Tracks.Any(t => t.IsSoloed);

        foreach (var track in project.Tracks)
        {
            if (soloActive ? !track.IsSoloed : track.IsMuted) continue;

            var (panL, panR) = track.GetPanGains();
            var clips = new List<ClipRender>();

            foreach (var clip in track.Clips)
            {
                var data = cache.Get(clip.SourceFilePath);
                // A clip whose audio was never imported (or whose file moved)
                // is skipped rather than faked with a tone.
                if (data is null || data.Samples.Length == 0) continue;

                long startFrame = SecondsToFrames(clip.TimelineStartSeconds, sampleRate);
                long durationFrames = SecondsToFrames(clip.ClipDurationSeconds, sampleRate);
                if (durationFrames <= 0) continue;

                long offsetFrame = SecondsToFrames(clip.ClipOffsetSeconds, sampleRate);
                if (offsetFrame >= data.FrameCount) continue;

                // Never read past the end of the decoded source.
                durationFrames = Math.Min(durationFrames, data.FrameCount - offsetFrame);
                if (durationFrames <= 0) continue;

                long fadeIn = Math.Min(
                    SecondsToFrames(clip.FadeInSeconds, sampleRate), durationFrames);
                long fadeOut = Math.Min(
                    SecondsToFrames(clip.FadeOutSeconds, sampleRate), durationFrames);

                clips.Add(new ClipRender
                {
                    Samples = data.Samples,
                    StartFrame = startFrame,
                    EndFrame = startFrame + durationFrames,
                    SourceOffsetFrame = offsetFrame,
                    Gain = (float)Math.Pow(10.0, clip.GainDb / 20.0),
                    FadeInFrames = fadeIn,
                    FadeOutFrames = fadeOut,
                    Curve = clip.CrossfadeType
                });
            }

            if (clips.Count > 0)
            {
                result.Add(new TrackRender { PanLeft = panL, PanRight = panR, Clips = clips });
            }
        }

        return result;
    }

    private static long SecondsToFrames(double seconds, int sampleRate) =>
        (long)Math.Round(Math.Max(0.0, seconds) * sampleRate);

    public int Read(float[] buffer, int offset, int count)
    {
        int framesRequested = count / 2;
        if (framesRequested <= 0) return 0;

        long position = PositionFrames;

        if (LoopEnabled && LoopEndFrame > LoopStartFrame && position >= LoopEndFrame)
        {
            position = LoopStartFrame;
        }

        if (position >= LengthFrames) return 0;

        int framesToRender = (int)Math.Min(framesRequested, LengthFrames - position);

        if (LoopEnabled && LoopEndFrame > LoopStartFrame && position < LoopEndFrame)
        {
            // Stop the block at the loop boundary; the next Read wraps.
            framesToRender = (int)Math.Min(framesToRender, LoopEndFrame - position);
        }

        if (framesToRender <= 0) return 0;

        Array.Clear(buffer, offset, framesToRender * 2);

        foreach (var track in _tracks)
        {
            foreach (var clip in track.Clips)
            {
                long overlapStart = Math.Max(position, clip.StartFrame);
                long overlapEnd = Math.Min(position + framesToRender, clip.EndFrame);
                if (overlapEnd <= overlapStart) continue;

                long clipLength = clip.EndFrame - clip.StartFrame;

                for (long f = overlapStart; f < overlapEnd; f++)
                {
                    long relative = f - clip.StartFrame;
                    long srcFrame = clip.SourceOffsetFrame + relative;
                    long srcIndex = srcFrame * 2;
                    if (srcIndex < 0 || srcIndex + 1 >= clip.Samples.LongLength) continue;

                    float env = clip.Gain * FadeGain(relative, clipLength, clip);

                    int dst = offset + (int)(f - position) * 2;
                    buffer[dst] += clip.Samples[srcIndex] * env * track.PanLeft;
                    buffer[dst + 1] += clip.Samples[srcIndex + 1] * env * track.PanRight;
                }
            }
        }

        float master = MasterGain;
        if (Math.Abs(master - 1.0f) > 0.0001f)
        {
            int total = framesToRender * 2;
            for (int i = 0; i < total; i++)
            {
                buffer[offset + i] *= master;
            }
        }

        PositionFrames = position + framesToRender;
        return framesToRender * 2;
    }

    private static float FadeGain(long relativeFrame, long clipLengthFrames, ClipRender clip)
    {
        float gain = 1.0f;

        if (clip.FadeInFrames > 0 && relativeFrame < clip.FadeInFrames)
        {
            gain *= ApplyCurve((float)relativeFrame / clip.FadeInFrames, clip.Curve);
        }

        long remaining = clipLengthFrames - relativeFrame;
        if (clip.FadeOutFrames > 0 && remaining < clip.FadeOutFrames)
        {
            gain *= ApplyCurve((float)remaining / clip.FadeOutFrames, clip.Curve);
        }

        return gain;
    }

    private static float ApplyCurve(float t, CrossfadeCurve curve)
    {
        t = Math.Clamp(t, 0f, 1f);
        return curve switch
        {
            CrossfadeCurve.Linear => t,
            CrossfadeCurve.Exponential => t * t,
            CrossfadeCurve.EqualPower => MathF.Sin(t * MathF.PI * 0.5f),
            _ => t
        };
    }
}
