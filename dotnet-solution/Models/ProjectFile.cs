using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using CommunityToolkit.Mvvm.ComponentModel;

namespace SpliceIt.Models;

// NOTE (Phase 0): was a plain POCO while being bound two-way from the Metadata
// Inspector tab. Now observable so the UI stays in sync with the model.
public partial class AudioMetadata : ObservableObject
{
    // TagLibSharp Basic Tags
    [ObservableProperty]
    private string _title = "Untitled Composition";

    [ObservableProperty]
    private string _artist = "SpliceIt Artist";

    [ObservableProperty]
    private string _album = "Mastered Mixdown";

    [ObservableProperty]
    private uint _year = (uint)DateTime.UtcNow.Year;

    [ObservableProperty]
    private uint _trackNumber = 1;

    [ObservableProperty]
    private uint _discNumber = 1;

    [ObservableProperty]
    private string _genre = "Electronic / Ambient";

    [ObservableProperty]
    private string _comment = "Mastered with SpliceIt Audio Workspace";

    [ObservableProperty]
    private string _composer = string.Empty;

    // Extended Broadcast & Release Tags
    [ObservableProperty]
    private string _isrc = string.Empty;

    [ObservableProperty]
    private double _bpm = 120.0;

    [ObservableProperty]
    private string _key = "C minor";

    [ObservableProperty]
    private string _lyrics = string.Empty;

    [ObservableProperty]
    private string _copyright = $"Copyright {DateTime.UtcNow.Year}";

    [ObservableProperty]
    private string _publisher = string.Empty;

    [ObservableProperty]
    private string _encoder = "SpliceIt .NET 9 Audio Engine";

    [ObservableProperty]
    private string? _coverArtBase64;
}

public class ProjectFile
{
    public const string ProjectExtension = ".siq"; // Splice It Queue
    public string SchemaVersion { get; set; } = "1.0.0";
    public string ProjectName { get; set; } = "New Session";
    public int SampleRate { get; set; } = 48000;
    public double TempoBpm { get; set; } = 120.0;
    public string TimeSignature { get; set; } = "4/4";
    public List<AudioTrack> Tracks { get; set; } = new();
    public DspSettings Dsp { get; set; } = new();
    public AudioMetadata Metadata { get; set; } = new();
    public DateTime LastSavedUtc { get; set; } = DateTime.UtcNow;

    public string SerializeToJson()
    {
        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        return JsonSerializer.Serialize(this, options);
    }

    public static ProjectFile? DeserializeFromJson(string json)
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
        return JsonSerializer.Deserialize<ProjectFile>(json, options);
    }

    public void SaveToFile(string filePath)
    {
        LastSavedUtc = DateTime.UtcNow;
        string json = SerializeToJson();
        File.WriteAllText(filePath, json);
    }

    public static ProjectFile LoadFromFile(string filePath)
    {
        if (!File.Exists(filePath))
            throw new FileNotFoundException("SpliceIt project file not found", filePath);

        string json = File.ReadAllText(filePath);
        return DeserializeFromJson(json) ?? throw new InvalidOperationException("Failed to parse project JSON.");
    }
}
