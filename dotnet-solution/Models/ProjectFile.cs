using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SpliceIt.Models;

public class AudioMetadata
{
    // TagLibSharp Basic Tags
    public string Title { get; set; } = "Untitled Composition";
    public string Artist { get; set; } = "SpliceIt Artist";
    public string Album { get; set; } = "Mastered Mixdown";
    public uint Year { get; set; } = (uint)DateTime.UtcNow.Year;
    public uint TrackNumber { get; set; } = 1;
    public uint DiscNumber { get; set; } = 1;
    public string Genre { get; set; } = "Electronic / Ambient";
    public string Comment { get; set; } = "Mastered with SpliceIt Audio Workspace";
    public string Composer { get; set; } = string.Empty;

    // Extended Broadcast & Release Tags
    public string Isrc { get; set; } = string.Empty;
    public double Bpm { get; set; } = 120.0;
    public string Key { get; set; } = "C minor";
    public string Lyrics { get; set; } = string.Empty;
    public string Copyright { get; set; } = $"Copyright {DateTime.UtcNow.Year}";
    public string Publisher { get; set; } = string.Empty;
    public string Encoder { get; set; } = "SpliceIt .NET 9 Audio Engine";
    public string? CoverArtBase64 { get; set; }
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
