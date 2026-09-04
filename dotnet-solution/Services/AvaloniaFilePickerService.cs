using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Platform.Storage;

namespace SpliceIt.Services;

public sealed class AvaloniaFilePickerService : IFilePickerService
{
    private readonly Func<TopLevel?> _topLevelAccessor;

    public AvaloniaFilePickerService(Func<TopLevel?> topLevelAccessor)
    {
        _topLevelAccessor = topLevelAccessor;
    }

    private static readonly FilePickerFileType AudioFileType = new("Audio Files")
    {
        Patterns = new[] { "*.wav", "*.mp3", "*.flac", "*.ogg", "*.m4a", "*.aac", "*.wma", "*.aiff", "*.aif" },
        MimeTypes = new[] { "audio/*" }
    };

    private static readonly FilePickerFileType ProjectFileType = new("SpliceIt Project")
    {
        Patterns = new[] { "*.siq" }
    };

    private static readonly FilePickerFileType WavFileType = new("WAV Audio")
    {
        Patterns = new[] { "*.wav" },
        MimeTypes = new[] { "audio/wav" }
    };

    public async Task<IReadOnlyList<string>> OpenAudioFilesAsync()
    {
        var storage = _topLevelAccessor()?.StorageProvider;
        if (storage is null) return Array.Empty<string>();

        var files = await storage.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = "Import Audio",
            AllowMultiple = true,
            FileTypeFilter = new[] { AudioFileType }
        });

        return files.Select(f => f.Path.LocalPath)
                    .Where(p => !string.IsNullOrWhiteSpace(p))
                    .ToList();
    }

    public async Task<string?> OpenProjectFileAsync()
    {
        var storage = _topLevelAccessor()?.StorageProvider;
        if (storage is null) return null;

        var files = await storage.OpenFilePickerAsync(new FilePickerOpenOptions
        {
            Title = "Open SpliceIt Project",
            AllowMultiple = false,
            FileTypeFilter = new[] { ProjectFileType }
        });

        return files.Count > 0 ? files[0].Path.LocalPath : null;
    }

    public async Task<string?> SaveProjectFileAsync(string suggestedName)
    {
        var storage = _topLevelAccessor()?.StorageProvider;
        if (storage is null) return null;

        var file = await storage.SaveFilePickerAsync(new FilePickerSaveOptions
        {
            Title = "Save SpliceIt Project",
            SuggestedFileName = suggestedName,
            DefaultExtension = "siq",
            FileTypeChoices = new[] { ProjectFileType }
        });

        return file?.Path.LocalPath;
    }

    public async Task<string?> SaveExportFileAsync(string suggestedName)
    {
        var storage = _topLevelAccessor()?.StorageProvider;
        if (storage is null) return null;

        var file = await storage.SaveFilePickerAsync(new FilePickerSaveOptions
        {
            Title = "Export Mixdown",
            SuggestedFileName = suggestedName,
            DefaultExtension = "wav",
            FileTypeChoices = new[] { WavFileType }
        });

        return file?.Path.LocalPath;
    }
}
