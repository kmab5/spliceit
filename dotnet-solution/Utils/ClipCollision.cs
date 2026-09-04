using System;
using System.Collections.Generic;
using System.Linq;
using SpliceIt.Models;

namespace SpliceIt.Utils;

/// <summary>
/// Non-overlap rules for clips sharing a track.
/// Direct port of clipCollision.ts so drag, trim and paste behave identically
/// in both front-ends.
/// </summary>
public static class ClipCollision
{
    private const double Epsilon = 0.001;   // 1 ms — lets clips abut exactly
    private const double BoundsEpsilon = 0.002;

    public static bool Overlaps(
        double start, double duration, IEnumerable<AudioClip> clips, string? ignoreClipId = null)
    {
        double end = start + duration;
        return clips.Any(c =>
        {
            if (ignoreClipId is not null && c.Id == ignoreClipId) return false;
            double cStart = c.TimelineStartSeconds;
            double cEnd = c.TimelineStartSeconds + c.ClipDurationSeconds;
            return start < cEnd - Epsilon && end > cStart + Epsilon;
        });
    }

    /// <summary>
    /// Hard limits a clip may slide or trim to without colliding with a
    /// neighbour. RightBound is PositiveInfinity when nothing follows.
    /// </summary>
    public static (double LeftBound, double RightBound) GetMovementBounds(
        string clipId, double initialStart, double initialDuration, IEnumerable<AudioClip> trackClips)
    {
        var others = trackClips.Where(c => c.Id != clipId).ToList();

        var leftClips = others
            .Where(c => c.TimelineStartSeconds + c.ClipDurationSeconds <= initialStart + BoundsEpsilon)
            .ToList();
        double leftBound = leftClips.Count > 0
            ? leftClips.Max(c => c.TimelineStartSeconds + c.ClipDurationSeconds)
            : 0.0;

        var rightClips = others
            .Where(c => c.TimelineStartSeconds >= initialStart + initialDuration - BoundsEpsilon)
            .ToList();
        double rightBound = rightClips.Count > 0
            ? rightClips.Min(c => c.TimelineStartSeconds)
            : double.PositiveInfinity;

        return (leftBound, rightBound);
    }

    /// <summary>Earliest free slot at or after preferredStart that fits duration.</summary>
    public static double FindNextAvailableSlot(
        double preferredStart, double duration, IEnumerable<AudioClip> clips, string? ignoreClipId = null)
    {
        var sorted = clips
            .Where(c => ignoreClipId is null || c.Id != ignoreClipId)
            .OrderBy(c => c.TimelineStartSeconds)
            .ToList();

        if (sorted.Count == 0) return Math.Max(0, preferredStart);

        if (preferredStart >= 0 &&
            preferredStart + duration <= sorted[0].TimelineStartSeconds + Epsilon)
        {
            return preferredStart;
        }

        double candidate = Math.Max(0, preferredStart);

        for (int i = 0; i < sorted.Count; i++)
        {
            var cur = sorted[i];
            double curEnd = cur.TimelineStartSeconds + cur.ClipDurationSeconds;

            if (candidate < curEnd - Epsilon &&
                candidate + duration > cur.TimelineStartSeconds + Epsilon)
            {
                candidate = curEnd;
            }

            double nextStart = i + 1 < sorted.Count
                ? sorted[i + 1].TimelineStartSeconds
                : double.PositiveInfinity;

            if (candidate + duration <= nextStart + Epsilon) return candidate;
        }

        return candidate;
    }

    /// <summary>Rounds to the nearest grid division when snapping is on.</summary>
    public static double Snap(double seconds, bool snapEnabled, double gridSize)
    {
        if (!snapEnabled || gridSize <= 0) return Math.Max(0, seconds);
        return Math.Max(0, Math.Round(seconds / gridSize) * gridSize);
    }
}
