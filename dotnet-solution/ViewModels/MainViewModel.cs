using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SpliceIt.DSP;
using SpliceIt.Models;
using SpliceIt.Services;

namespace SpliceIt.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly AudioExportService _exportService = new();
    private readonly TagLibMetadataService _metadataService = new();

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
    private AudioClip? _selectedClip;

    [ObservableProperty]
    private string _statusMessage = "Ready - .NET 9 & Avalonia 11 Audio Engine";

    [ObservableProperty]
    private int _exportProgress = 0;

    [ObservableProperty]
    private bool _isExporting = false;

    public ObservableCollection<AudioTrack> Tracks { get; } = new();
    public DspSettings DspSettings { get; set; } = new();
    public AudioMetadata Metadata { get; set; } = new();

    public MainViewModel()
    {
        InitializeDefaultSession();
    }

    private void InitializeDefaultSession()
    {
        var drumTrack = new AudioTrack
        {
            Name = "Punchy Drums",
            VolumeDb = 0.0,
            Pan = 0.0,
            ColorHex = "#00D2FF"
        };
        drumTrack.Clips.Add(new AudioClip
        {
            Name = "Drums 4-Bar Loop",
            TimelineStartSeconds = 0.0,
            ClipOffsetSeconds = 0.0,
            ClipDurationSeconds = 8.0,
            SourceDurationSeconds = 8.0,
            ColorHex = "#00D2FF"
        });

        var bassTrack = new AudioTrack
        {
            Name = "Analog Sub 808",
            VolumeDb = -1.5,
            Pan = 0.0,
            ColorHex = "#BD00FF"
        };
        bassTrack.Clips.Add(new AudioClip
        {
            Name = "Sub Bassline",
            TimelineStartSeconds = 0.0,
            ClipOffsetSeconds = 0.0,
            ClipDurationSeconds = 8.0,
            SourceDurationSeconds = 8.0,
            ColorHex = "#BD00FF"
        });

        var leadTrack = new AudioTrack
        {
            Name = "Analog Synth Arp",
            VolumeDb = -3.0,
            Pan = -0.2,
            ColorHex = "#FFAA00"
        };
        leadTrack.Clips.Add(new AudioClip
        {
            Name = "Lead Chords",
            TimelineStartSeconds = 0.0,
            ClipOffsetSeconds = 0.0,
            ClipDurationSeconds = 8.0,
            SourceDurationSeconds = 8.0,
            ColorHex = "#FFAA00"
        });

        Tracks.Add(drumTrack);
        Tracks.Add(bassTrack);
        Tracks.Add(leadTrack);

        SelectedClip = drumTrack.Clips[0];
    }

    [RelayCommand]
    private void TogglePlay()
    {
        IsPlaying = !IsPlaying;
        StatusMessage = IsPlaying ? "Playing..." : "Paused";
    }

    [RelayCommand]
    private void Stop()
    {
        IsPlaying = false;
        CurrentPlayheadSeconds = 0.0;
        StatusMessage = "Stopped";
    }

    [RelayCommand]
    private void SplitClipAtPlayhead()
    {
        if (SelectedClip == null) return;

        double playhead = CurrentPlayheadSeconds;
        double clipStart = SelectedClip.TimelineStartSeconds;
        double clipEnd = SelectedClip.EndSeconds;

        if (playhead <= clipStart + 0.1 || playhead >= clipEnd - 0.1)
            return;

        // Find parent track
        var parentTrack = Tracks.FirstOrDefault(t => t.Clips.Contains(SelectedClip));
        if (parentTrack == null) return;

        double firstDuration = playhead - clipStart;
        double secondDuration = SelectedClip.ClipDurationSeconds - firstDuration;

        var secondClip = new AudioClip
        {
            Name = $"{SelectedClip.Name} (Split)",
            TimelineStartSeconds = playhead,
            ClipOffsetSeconds = SelectedClip.ClipOffsetSeconds + firstDuration,
            ClipDurationSeconds = secondDuration,
            SourceDurationSeconds = SelectedClip.SourceDurationSeconds,
            GainDb = SelectedClip.GainDb,
            ColorHex = SelectedClip.ColorHex
        };

        SelectedClip.ClipDurationSeconds = firstDuration;
        parentTrack.Clips.Add(secondClip);
        SelectedClip = secondClip;

        StatusMessage = $"Clip split non-destructively at {playhead:F2}s";
    }

    [RelayCommand]
    private async Task ExportMixdownAsync()
    {
        if (IsExporting) return;

        IsExporting = true;
        ExportProgress = 0;
        StatusMessage = "Starting 24-bit broadcast mixdown export...";

        try
        {
            var project = new ProjectFile
            {
                ProjectName = ProjectName,
                Tracks = Tracks.ToList(),
                Dsp = DspSettings,
                Metadata = Metadata
            };

            string exportPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Desktop),
                $"{ProjectName}_Master.wav"
            );

            var progress = new Progress<(int Percent, string Status)>(update =>
            {
                ExportProgress = update.Percent;
                StatusMessage = update.Status;
            });

            await _exportService.ExportMixdownAsync(project, exportPath, progress);
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

    [RelayCommand]
    private void SaveProjectFile(string filePath)
    {
        var project = new ProjectFile
        {
            ProjectName = ProjectName,
            Tracks = Tracks.ToList(),
            Dsp = DspSettings,
            Metadata = Metadata
        };
        project.SaveToFile(filePath);
        StatusMessage = $"Saved project to {filePath}";
    }

    [RelayCommand]
    private void LoadProjectFile(string filePath)
    {
        var project = ProjectFile.LoadFromFile(filePath);
        ProjectName = project.ProjectName;
        DspSettings = project.Dsp;
        Metadata = project.Metadata;

        Tracks.Clear();
        foreach (var t in project.Tracks)
        {
            Tracks.Add(t);
        }

        StatusMessage = $"Loaded project: {project.ProjectName}";
    }
}
