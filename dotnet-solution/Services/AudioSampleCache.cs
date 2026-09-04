using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using SpliceIt.Models;

namespace SpliceIt.Services;

/// <summary>
/// Decoded-audio store keyed by absolute source path.
///
/// Clips reference audio by path rather than owning sample arrays, so the same
/// file used by twenty clips is decoded and held exactly once. This is also what
/// keeps .siq project files small — only the path is serialised.
/// </summary>
public sealed class AudioSampleCache
{
    private readonly ConcurrentDictionary<string, AudioSampleData> _cache =
        new(StringComparer.OrdinalIgnoreCase);

    public bool TryGet(string sourcePath, out AudioSampleData? data)
    {
        if (string.IsNullOrWhiteSpace(sourcePath))
        {
            data = null;
            return false;
        }
        return _cache.TryGetValue(sourcePath, out data);
    }

    public AudioSampleData? Get(string sourcePath) =>
        TryGet(sourcePath, out var d) ? d : null;

    public void Put(AudioSampleData data) => _cache[data.SourcePath] = data;

    public bool Contains(string sourcePath) =>
        !string.IsNullOrWhiteSpace(sourcePath) && _cache.ContainsKey(sourcePath);

    public void Remove(string sourcePath) => _cache.TryRemove(sourcePath, out _);

    public void Clear() => _cache.Clear();

    public IReadOnlyCollection<AudioSampleData> All => _cache.Values.ToList();

    /// <summary>Approximate memory footprint, for a status readout.</summary>
    public long ApproximateBytes =>
        _cache.Values.Sum(v => v.Samples.LongLength * sizeof(float));
}
