using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpliceIt.Services;

/// <summary>
/// Abstraction over Avalonia's IStorageProvider so the view model can open
/// dialogs without referencing a window.
///
/// The app previously had no file dialog anywhere: SaveProjectFileCommand and
/// LoadProjectFileCommand took a raw string path and were bound to nothing, and
/// export hardcoded the Desktop.
/// </summary>
public interface IFilePickerService
{
    Task<IReadOnlyList<string>> OpenAudioFilesAsync();
    Task<string?> OpenProjectFileAsync();
    Task<string?> SaveProjectFileAsync(string suggestedName);
    Task<string?> SaveExportFileAsync(string suggestedName);
}
