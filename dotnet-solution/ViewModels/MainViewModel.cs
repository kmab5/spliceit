using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Avalonia.Threading;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SpliceIt.Audio;
using SpliceIt.Models;
using SpliceIt.Services;
using SpliceIt.Utils;

namespace SpliceIt.ViewModels;

public partial class MainViewModel : ObservableObject, IDisposable
{
    private readonly AudioExportService _exportService = new();
    private readonly AudioImportService _importService = new();
    private readonly AudioSampleCache _sampleCache = new();
    private readonly AudioPlaybackEngine _playbackEngine = new();
    private readonly IFilePickerService? _filePicker;

    // Drives the playhead readout while audio is running.
    private readonly DispatcherTimer _transportTimer;

    [ObservableProperty]
    private string _projectName = "SpliceIt Session";

    [ObservableProperty]
    private bool _isPlaying = false;

    [ObservableProperty]
    private bool _isLooping = false;

    [ObservableProperty]
    private double _currentPlayheadSeconds = 0.0;

    [ObservableProperty]
    private double _timelineDurationSeconds = 16.0;

    [ObservableProperty]
    private double _zoomFactor = 80.0; // Pixels per second

    [ObservableProperty]
    private bool _isSnapToGrid = true;

    [ObservableProperty]
    private double _gridSizeSeconds = 0.25;

    /// <summary>Pixel width of the whole timeline; drives scroll extents.</summary>
    [ObservableProperty]
    private double _timelineWidthPixels = 16.0 * 80.0;

    /// <summary>
    /// Playhead X in pixels. Computed here rather than via a MultiBinding
    /// converter because Canvas.Left needs a plain double.
    /// </summary>
    [ObservableProperty]
    private double _playheadPixels;

    /// <summary>Canvas.Left for the needle control, offset by half its width.</summary>
    [ObservableProperty]
    private double _playheadCanvasLeft = -9.5;

    [ObservableProperty]
    private double _loopStartSeconds = 0.0;

    [ObservableProperty]
    private double _loopEndSeconds = 8.0;

    [ObservableProperty]
    private double _masterVolumeDb = 0.0;

    [ObservableProperty]
    private bool _isMasterMuted = false;

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(HasSelectedClip))]
    private AudioClip? _selectedClip;

    /// <summary>
    /// Plain bool for XAML visibility. Avoids depending on ObjectConverters,
    /// whose XAML namespace mapping varies between Avalonia versions.
    /// </summary>
    public bool HasSelectedClip => SelectedClip is not null;

    [ObservableProperty]
    private string _statusMessage = "Ready - .NET 9 & Avalonia 11 Audio Engine";

    [ObservableProperty]
    private int _exportProgress = 0;

    [ObservableProperty]
    private bool _isExporting = false;

    [ObservableProperty]
    private bool _isImporting = false;

    public ObservableCollection<AudioTrack> Tracks { get; } = new();

    [ObservableProperty]
    private DspSettings _dspSettings = new();

    [ObservableProperty]
    private AudioMetadata _metadata = new();

    /// <summary>Design-time and fallback constructor.</summary>
    public MainViewModel() : this(null) { }

    public MainViewModel(IFilePickerService? filePicker)
    {
        _filePicker = filePicker;

        _transportTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(33) };
        _transportTimer.Tick += OnTransportTick;

        _playbackEngine.PlaybackEnded += OnPlaybackEnded;

        InitializeEmptySession();
    }

    private void InitializeEmptySession()
    {
        // The previous build seeded three fake tracks holding clips that pointed
        // at no file. Now that audio is real, inventing silent placeholder clips
        // would just be lying in a new way — start empty and let import fill it.
        Tracks.Add(new AudioTrack { Name = "Audio Track 1", ColorHex = "#00D2FF" });
        StatusMessage = "Ready - import audio to begin (Ctrl+I)";
    }

    // ---------------------------------------------------------------- Transport

    private void OnTransportTick(object? sender, EventArgs e)
    {
        if (!_playbackEngine.IsPlaying) return;
        CurrentPlayheadSeconds = _playbackEngine.CurrentTimeSeconds;
    }

    private void OnPlaybackEnded(object? sender, EventArgs e)
    {
        Dispatcher.UIThread.Post(() =>
        {
            _transportTimer.Stop();
            IsPlaying = false;
            StatusMessage = "Playback finished";
        });
    }

    private ProjectFile BuildProjectSnapshot() => new()
    {
        ProjectName = ProjectName,
        Tracks = Tracks.ToList(),
        Dsp = DspSettings,
        Metadata = Metadata
    };

    [RelayCommand]
    private void TogglePlay()
    {
        if (IsPlaying)
        {
            _playbackEngine.Stop();
            _transportTimer.Stop();
            IsPlaying = false;
            StatusMessage = "Paused";
            return;
        }

        if (!Tracks.SelectMany(t => t.Clips).Any(c => c.HasAudio))
        {
            StatusMessage = "Nothing to play — import an audio file first";
            return;
        }

        try
        {
            _playbackEngine.Play(
                BuildProjectSnapshot(),
                _sampleCache,
                CurrentPlayheadSeconds,
                TimelineDurationSeconds,
                IsLooping,
                LoopStartSeconds,
                LoopEndSeconds,
                MasterVolumeDb,
                IsMasterMuted);

            _transportTimer.Start();
            IsPlaying = true;
            StatusMessage = "Playing...";
        }
        catch (Exception ex)
        {
            IsPlaying = false;
            StatusMessage = $"Playback failed: {ex.Message}";
        }
    }

    [RelayCommand]
    private void Stop()
    {
        _playbackEngine.Stop();
        _transportTimer.Stop();
        IsPlaying = false;
        CurrentPlayheadSeconds = 0.0;
        StatusMessage = "Stopped";
    }

    partial void OnMasterVolumeDbChanged(double value) =>
        _playbackEngine.SetMasterOutput(value, IsMasterMuted);

    partial void OnIsMasterMutedChanged(bool value) =>
        _playbackEngine.SetMasterOutput(MasterVolumeDb, value);

    partial void OnIsLoopingChanged(bool value) =>
        _playbackEngine.SetLoop(value, LoopStartSeconds, LoopEndSeconds);

    partial void OnLoopStartSecondsChanged(double value) =>
        _playbackEngine.SetLoop(IsLooping, value, LoopEndSeconds);

    partial void OnLoopEndSecondsChanged(double value) =>
        _playbackEngine.SetLoop(IsLooping, LoopStartSeconds, value);

    partial void OnZoomFactorChanged(double value) => RecalculateTimelineWidth();

    partial void OnTimelineDurationSecondsChanged(double value) => RecalculateTimelineWidth();

    private void RecalculateTimelineWidth()
    {
        TimelineWidthPixels = Math.Max(800.0, TimelineDurationSeconds * ZoomFactor);
        RecalculatePlayheadPixels();
    }

    private void RecalculatePlayheadPixels()
    {
        PlayheadPixels = CurrentPlayheadSeconds * ZoomFactor;
        // The needle control is 19px wide; centre it on the true position.
        PlayheadCanvasLeft = PlayheadPixels - 9.5;
    }

    partial void OnCurrentPlayheadSecondsChanged(double value) => RecalculatePlayheadPixels();

    // ------------------------------------------------------------------- Zoom

    [RelayCommand]
    private void ZoomIn() => ZoomFactor = Math.Min(250, ZoomFactor + 15);

    [RelayCommand]
    private void ZoomOut() => ZoomFactor = Math.Max(15, ZoomFactor - 15);

    /// <summary>Ctrl+wheel zoom, matching the React arrangement view.</summary>
    public void ZoomByDelta(double wheelDelta)
    {
        double factor = wheelDelta > 0 ? 1.15 : 0.85;
        ZoomFactor = Math.Clamp(Math.Round(ZoomFactor * factor), 15, 250);
    }

    // -------------------------------------------------------------- Navigation

    [RelayCommand]
    private void GoToStart() => Scrub(0);

    [RelayCommand]
    private void GoToEnd() => Scrub(TimelineDurationSeconds);

    /// <summary>Moves the playhead, keeping a live transport in sync.</summary>
    public void Scrub(double seconds)
    {
        double clamped = Math.Clamp(seconds, 0, Math.Max(0, TimelineDurationSeconds));
        CurrentPlayheadSeconds = clamped;
        if (IsPlaying) _playbackEngine.Seek(clamped);
    }

    // ------------------------------------------------------------ Track edits

    [RelayCommand]
    private void AddTrack()
    {
        string[] palette = { "#00D2FF", "#BD00FF", "#FFAA00", "#00FFA3", "#FF0055" };
        Tracks.Add(new AudioTrack
        {
            Name = $"Audio Track {Tracks.Count + 1}",
            ColorHex = palette[Tracks.Count % palette.Length]
        });
    }

    [RelayCommand]
    private void DeleteTrack(AudioTrack? track)
    {
        if (track is null) return;
        if (SelectedClip is not null && track.Clips.Contains(SelectedClip)) SelectedClip = null;
        Tracks.Remove(track);
        ReindexTracks();
    }

    [RelayCommand]
    private void MoveTrackUp(AudioTrack? track)
    {
        if (track is null) return;
        int i = Tracks.IndexOf(track);
        if (i <= 0) return;
        Tracks.Move(i, i - 1);
        ReindexTracks();
    }

    [RelayCommand]
    private void MoveTrackDown(AudioTrack? track)
    {
        if (track is null) return;
        int i = Tracks.IndexOf(track);
        if (i < 0 || i >= Tracks.Count - 1) return;
        Tracks.Move(i, i + 1);
        ReindexTracks();
    }

    [RelayCommand]
    private void DeleteSelectedClip()
    {
        if (SelectedClip is null) return;
        var owner = Tracks.FirstOrDefault(t => t.Clips.Contains(SelectedClip));
        owner?.Clips.Remove(SelectedClip);
        SelectedClip = null;
        StatusMessage = "Clip deleted";
    }

    [RelayCommand]
    private void DuplicateSelectedClip()
    {
        if (SelectedClip is null) return;
        var owner = Tracks.FirstOrDefault(t => t.Clips.Contains(SelectedClip));
        if (owner is null) return;

        var source = SelectedClip;
        double slot = ClipCollision.FindNextAvailableSlot(
            source.TimelineStartSeconds + source.ClipDurationSeconds,
            source.ClipDurationSeconds,
            owner.Clips);

        var copy = new AudioClip
        {
            Name = $"{source.Name} (Copy)",
            SourceFilePath = source.SourceFilePath,
            TimelineStartSeconds = slot,
            ClipOffsetSeconds = source.ClipOffsetSeconds,
            ClipDurationSeconds = source.ClipDurationSeconds,
            SourceDurationSeconds = source.SourceDurationSeconds,
            GainDb = source.GainDb,
            FadeInSeconds = source.FadeInSeconds,
            FadeOutSeconds = source.FadeOutSeconds,
            CrossfadeType = source.CrossfadeType,
            ColorHex = source.ColorHex,
            Peaks = source.Peaks,
            HasAudio = source.HasAudio
        };

        owner.Clips.Add(copy);
        SelectedClip = copy;

        if (copy.EndSeconds + 4 > TimelineDurationSeconds)
            TimelineDurationSeconds = Math.Ceiling(copy.EndSeconds + 4);
    }

    [RelayCommand]
    private void SelectClip(AudioClip? clip)
    {
        if (clip is not null) SelectedClip = clip;
    }

    [RelayCommand]
    private void ScrubTo(double seconds) => Scrub(seconds);

    [RelayCommand]
    private void CommitClipEdit(AudioClip? clip)
    {
        if (clip is not null) OnClipEdited(clip);
    }

    /// <summary>Called after a clip drag/trim so the timeline can grow to fit.</summary>
    public void OnClipEdited(AudioClip clip)
    {
        if (clip.EndSeconds + 4 > TimelineDurationSeconds)
            TimelineDurationSeconds = Math.Ceiling(clip.EndSeconds + 4);

        StatusMessage =
            $"{clip.Name}: start {clip.TimelineStartSeconds:F2}s, length {clip.ClipDurationSeconds:F2}s";
    }

    private void ReindexTracks()
    {
        for (int i = 0; i < Tracks.Count; i++)
        {
            foreach (var c in Tracks[i].Clips) c.TrackIndex = i;
        }
    }

    // ------------------------------------------------------------------- Import

    [RelayCommand(CanExecute = nameof(CanImportAudio))]
    private async Task ImportAudioAsync()
    {
        if (_filePicker is null)
        {
            StatusMessage = "File picker unavailable";
            return;
        }

        var paths = await _filePicker.OpenAudioFilesAsync();
        if (paths.Count == 0) return;

        IsImporting = true;
        try
        {
            foreach (string path in paths)
            {
                StatusMessage = $"Decoding {Path.GetFileName(path)}...";

                AudioSampleData data;
                try
                {
                    data = await _importService.ImportAsync(path);
                }
                catch (Exception ex)
                {
                    StatusMessage = $"Could not decode {Path.GetFileName(path)}: {ex.Message}";
                    continue;
                }

                _sampleCache.Put(data);
                AddClipForSample(data);
            }

            StatusMessage = $"Imported {paths.Count} file(s) — {_sampleCache.ApproximateBytes / (1024 * 1024)} MB decoded";
        }
        finally
        {
            IsImporting = false;
        }
    }

    private bool CanImportAudio() => !IsImporting && !IsExporting;

    partial void OnIsImportingChanged(bool value) =>
        ImportAudioCommand.NotifyCanExecuteChanged();

    /// <summary>Appends an imported file to a new track, placed after existing content.</summary>
    private void AddClipForSample(AudioSampleData data)
    {
        string[] palette = { "#00D2FF", "#BD00FF", "#FFAA00", "#00FFA3", "#FF0055" };

        var track = new AudioTrack
        {
            Name = Path.GetFileNameWithoutExtension(data.SourcePath),
            ColorHex = palette[Tracks.Count % palette.Length]
        };

        track.Clips.Add(new AudioClip
        {
            Name = Path.GetFileName(data.SourcePath),
            SourceFilePath = data.SourcePath,
            TrackIndex = Tracks.Count,
            TimelineStartSeconds = 0.0,
            ClipOffsetSeconds = 0.0,
            ClipDurationSeconds = data.DurationSeconds,
            SourceDurationSeconds = data.DurationSeconds,
            ColorHex = track.ColorHex,
            Peaks = data.Peaks,
            HasAudio = true
        });

        Tracks.Add(track);
        SelectedClip = track.Clips[0];

        if (data.DurationSeconds + 4 > TimelineDurationSeconds)
        {
            TimelineDurationSeconds = Math.Ceiling(data.DurationSeconds + 4);
        }
    }

    // -------------------------------------------------------------------- Edits

    [RelayCommand]
    private void SplitClipAtPlayhead()
    {
        if (SelectedClip == null) return;

        double playhead = CurrentPlayheadSeconds;
        double clipStart = SelectedClip.TimelineStartSeconds;
        double clipEnd = SelectedClip.EndSeconds;

        if (playhead <= clipStart + 0.1 || playhead >= clipEnd - 0.1)
        {
            StatusMessage = "Playhead is not inside the selected clip";
            return;
        }

        var parentTrack = Tracks.FirstOrDefault(t => t.Clips.Contains(SelectedClip));
        if (parentTrack == null) return;

        double firstDuration = playhead - clipStart;
        double secondDuration = SelectedClip.ClipDurationSeconds - firstDuration;

        var secondClip = new AudioClip
        {
            Name = $"{SelectedClip.Name} (Split)",
            SourceFilePath = SelectedClip.SourceFilePath,
            TimelineStartSeconds = playhead,
            ClipOffsetSeconds = SelectedClip.ClipOffsetSeconds + firstDuration,
            ClipDurationSeconds = secondDuration,
            SourceDurationSeconds = SelectedClip.SourceDurationSeconds,
            GainDb = SelectedClip.GainDb,
            ColorHex = SelectedClip.ColorHex,
            Peaks = SelectedClip.Peaks,
            HasAudio = SelectedClip.HasAudio
        };

        SelectedClip.ClipDurationSeconds = firstDuration;
        parentTrack.Clips.Add(secondClip);
        SelectedClip = secondClip;

        StatusMessage = $"Clip split non-destructively at {playhead:F2}s";
    }

    // ------------------------------------------------------------------- Export

    [RelayCommand(CanExecute = nameof(CanExportMixdown))]
    private async Task ExportMixdownAsync()
    {
        if (_filePicker is null)
        {
            StatusMessage = "File picker unavailable";
            return;
        }

        string suggested = $"{SanitiseFileName(ProjectName)}_Master.wav";
        string? exportPath = await _filePicker.SaveExportFileAsync(suggested);
        if (string.IsNullOrWhiteSpace(exportPath)) return;

        IsExporting = true;
        ExportProgress = 0;
        StatusMessage = "Starting 24-bit broadcast mixdown export...";

        try
        {
            var progress = new Progress<(int Percent, string Status)>(update =>
            {
                ExportProgress = update.Percent;
                StatusMessage = update.Status;
            });

            await _exportService.ExportMixdownAsync(
                BuildProjectSnapshot(),
                _sampleCache,
                exportPath,
                TimelineDurationSeconds,
                MasterVolumeDb,
                IsMasterMuted,
                progress);

            StatusMessage = $"Render complete: {exportPath}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Export error: {ex.Message}";
        }
        finally
        {
            IsExporting = false;
        }
    }

    private bool CanExportMixdown() => !IsExporting && !IsImporting;

    partial void OnIsExportingChanged(bool value)
    {
        ExportMixdownCommand.NotifyCanExecuteChanged();
        ImportAudioCommand.NotifyCanExecuteChanged();
    }

    // -------------------------------------------------------------- Persistence

    [RelayCommand]
    private async Task SaveProjectAsync()
    {
        if (_filePicker is null) return;

        string? path = await _filePicker.SaveProjectFileAsync(
            $"{SanitiseFileName(ProjectName)}{ProjectFile.ProjectExtension}");
        if (string.IsNullOrWhiteSpace(path)) return;

        try
        {
            var project = BuildProjectSnapshot();
            project.SampleRate = 48000;
            project.SaveToFile(path);
            StatusMessage = $"Saved project to {path}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Save failed: {ex.Message}";
        }
    }

    [RelayCommand]
    private async Task OpenProjectAsync()
    {
        if (_filePicker is null) return;

        string? path = await _filePicker.OpenProjectFileAsync();
        if (string.IsNullOrWhiteSpace(path)) return;

        try
        {
            Stop();
            var project = ProjectFile.LoadFromFile(path);

            ProjectName = project.ProjectName;
            DspSettings = project.Dsp;
            Metadata = project.Metadata;

            Tracks.Clear();
            foreach (var t in project.Tracks) Tracks.Add(t);

            await RehydrateClipAudioAsync();
            StatusMessage = $"Loaded project: {project.ProjectName}";
        }
        catch (Exception ex)
        {
            StatusMessage = $"Open failed: {ex.Message}";
        }
    }

    /// <summary>
    /// A .siq file stores source paths, not audio. After loading, each referenced
    /// file is decoded back into the cache. Missing files leave their clip in a
    /// visible no-audio state rather than silently producing silence.
    /// </summary>
    private async Task RehydrateClipAudioAsync()
    {
        foreach (var clip in Tracks.SelectMany(t => t.Clips))
        {
            if (string.IsNullOrWhiteSpace(clip.SourceFilePath)) continue;

            var cached = _sampleCache.Get(clip.SourceFilePath);
            if (cached is null)
            {
                if (!File.Exists(clip.SourceFilePath))
                {
                    clip.HasAudio = false;
                    clip.Peaks = null;
                    StatusMessage = $"Missing source file: {clip.SourceFilePath}";
                    continue;
                }

                try
                {
                    cached = await _importService.ImportAsync(clip.SourceFilePath);
                    _sampleCache.Put(cached);
                }
                catch
                {
                    clip.HasAudio = false;
                    continue;
                }
            }

            clip.Peaks = cached.Peaks;
            clip.HasAudio = true;
        }
    }

    private static string SanitiseFileName(string name)
    {
        foreach (char c in Path.GetInvalidFileNameChars())
        {
            name = name.Replace(c, '_');
        }
        return string.IsNullOrWhiteSpace(name) ? "SpliceIt" : name.Trim();
    }

    public void Dispose()
    {
        _transportTimer.Stop();
        _playbackEngine.PlaybackEnded -= OnPlaybackEnded;
        _playbackEngine.Dispose();
        _sampleCache.Clear();
        GC.SuppressFinalize(this);
    }
}
