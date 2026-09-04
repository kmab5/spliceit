import { AudioClipModel } from '../types';

/**
 * Checks if a proposed range [start, start + duration] overlaps with any other clip on the track.
 */
export function checkClipOverlap(
  start: number,
  duration: number,
  clips: AudioClipModel[],
  ignoreClipId?: string
): boolean {
  const end = start + duration;
  const epsilon = 0.001; // 1ms tolerance to allow perfectly abutting clips
  return clips.some((c) => {
    if (ignoreClipId && c.id === ignoreClipId) return false;
    const cStart = c.timelineStart;
    const cEnd = c.timelineStart + c.clipDuration;
    return start < cEnd - epsilon && end > cStart + epsilon;
  });
}

/**
 * Calculates strict boundaries [leftBound, rightBound] for a clip to slide/trim
 * without overlapping any other clip on the track.
 */
export function getClipMovementBounds(
  clipId: string,
  initialStart: number,
  initialDuration: number,
  trackClips: AudioClipModel[]
): { leftBound: number; rightBound: number } {
  const otherClips = trackClips.filter((c) => c.id !== clipId);
  const epsilon = 0.002;

  // Clips strictly to the left of this clip's current position
  const leftClips = otherClips.filter((c) => c.timelineStart + c.clipDuration <= initialStart + epsilon);
  const leftBound = leftClips.length > 0
    ? Math.max(...leftClips.map((c) => c.timelineStart + c.clipDuration))
    : 0;

  // Clips strictly to the right of this clip's current position
  const rightClips = otherClips.filter((c) => c.timelineStart >= initialStart + initialDuration - epsilon);
  const rightBound = rightClips.length > 0
    ? Math.min(...rightClips.map((c) => c.timelineStart))
    : Infinity;

  return { leftBound, rightBound };
}

/**
 * Finds the earliest non-overlapping timeline position (>= preferredStart) for a clip of given duration.
 */
export function findNextAvailableSlot(
  preferredStart: number,
  duration: number,
  clips: AudioClipModel[],
  ignoreClipId?: string
): number {
  const sorted = clips
    .filter((c) => !ignoreClipId || c.id !== ignoreClipId)
    .sort((a, b) => a.timelineStart - b.timelineStart);

  if (sorted.length === 0) {
    return Math.max(0, preferredStart);
  }

  // Check if preferredStart fits before first clip
  if (preferredStart + duration <= sorted[0].timelineStart + 0.001 && preferredStart >= 0) {
    return preferredStart;
  }

  // Check gaps between clips starting from or after preferredStart
  let candidate = Math.max(0, preferredStart);

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const curEnd = cur.timelineStart + cur.clipDuration;

    // If candidate falls inside this clip, advance candidate to end of this clip
    if (candidate < curEnd - 0.001 && candidate + duration > cur.timelineStart + 0.001) {
      candidate = curEnd;
    }

    // Check gap after this clip and before next clip
    const nextStart = i + 1 < sorted.length ? sorted[i + 1].timelineStart : Infinity;
    if (candidate + duration <= nextStart + 0.001) {
      return candidate;
    }
  }

  return candidate;
}
