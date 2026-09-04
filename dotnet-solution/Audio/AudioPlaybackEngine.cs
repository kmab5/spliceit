using System;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using SpliceIt.Models;
using SpliceIt.Services;

namespace SpliceIt.Audio;

/// <summary>
/// Realtime transport built on WasapiOut.
///
/// Before Phase 1 the transport was a boolean and a status string — nothing was
/// ever audible. The previous package set made this impossible anyway, since
/// NAudio.Core ships no output device at all.
/// </summary>
public sealed class AudioPlaybackEngine : IDisposable
{
    private readonly object _lock = new();
    private WasapiOut? _output;
    private TimelineMixerSampleProvider? _mixer;
    private bool _disposed;

    public int SampleRate { get; init; } = 48000;

    /// <summary>Raised when the timeline runs out or playback is stopped externally.</summary>
    public event EventHandler? PlaybackEnded;

    public bool IsPlaying
    {
        get
        {
            lock (_lock)
            {
                return _output is not null && _output.PlaybackState == PlaybackState.Playing;
            }
        }
    }

    public double CurrentTimeSeconds
    {
        get
        {
            lock (_lock)
            {
                return _mixer?.CurrentTimeSeconds ?? 0.0;
            }
        }
    }

    public void Play(
        ProjectFile project,
        AudioSampleCache cache,
        double startSeconds,
        double timelineSeconds,
        bool loopEnabled = false,
        double loopStartSeconds = 0,
        double loopEndSeconds = 0,
        double masterVolumeDb = 0,
        bool masterMuted = false)
    {
        lock (_lock)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            StopInternal();

            var mixer = new TimelineMixerSampleProvider(project, cache, SampleRate, timelineSeconds)
            {
                PositionFrames = (long)Math.Round(Math.Max(0, startSeconds) * SampleRate),
                LoopEnabled = loopEnabled,
                LoopStartFrame = (long)Math.Round(Math.Max(0, loopStartSeconds) * SampleRate),
                LoopEndFrame = (long)Math.Round(Math.Max(0, loopEndSeconds) * SampleRate),
                MasterGain = masterMuted ? 0f : (float)Math.Pow(10.0, masterVolumeDb / 20.0)
            };

            var output = new WasapiOut(AudioClientShareMode.Shared, useEventSync: true, latency: 100);
            output.PlaybackStopped += OnPlaybackStopped;
            output.Init(mixer);
            output.Play();

            _mixer = mixer;
            _output = output;
        }
    }

    /// <summary>Moves the playhead without tearing down the output device.</summary>
    public void Seek(double seconds)
    {
        lock (_lock)
        {
            if (_mixer is null) return;
            _mixer.PositionFrames = (long)Math.Round(Math.Max(0, seconds) * SampleRate);
        }
    }

    public void SetMasterOutput(double volumeDb, bool muted)
    {
        lock (_lock)
        {
            if (_mixer is null) return;
            _mixer.MasterGain = muted ? 0f : (float)Math.Pow(10.0, volumeDb / 20.0);
        }
    }

    public void SetLoop(bool enabled, double startSeconds, double endSeconds)
    {
        lock (_lock)
        {
            if (_mixer is null) return;
            _mixer.LoopEnabled = enabled;
            _mixer.LoopStartFrame = (long)Math.Round(Math.Max(0, startSeconds) * SampleRate);
            _mixer.LoopEndFrame = (long)Math.Round(Math.Max(0, endSeconds) * SampleRate);
        }
    }

    public void Stop()
    {
        lock (_lock)
        {
            StopInternal();
        }
    }

    private void StopInternal()
    {
        if (_output is null) return;

        // Detach first so tearing down the device does not re-enter the handler.
        _output.PlaybackStopped -= OnPlaybackStopped;
        try
        {
            _output.Stop();
        }
        catch
        {
            // Device may already be gone (unplugged, session ended).
        }
        _output.Dispose();
        _output = null;
        _mixer = null;
    }

    private void OnPlaybackStopped(object? sender, StoppedEventArgs e)
    {
        PlaybackEnded?.Invoke(this, EventArgs.Empty);
    }

    public void Dispose()
    {
        lock (_lock)
        {
            if (_disposed) return;
            StopInternal();
            _disposed = true;
        }
    }
}
