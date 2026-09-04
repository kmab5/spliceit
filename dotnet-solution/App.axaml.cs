using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using SpliceIt.Services;
using SpliceIt.ViewModels;
using SpliceIt.Views;

namespace SpliceIt;

public partial class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var window = new MainWindow();

            // The picker resolves its TopLevel lazily: the window is not yet
            // attached to a visual root at construction time.
            var filePicker = new AvaloniaFilePickerService(() => TopLevel.GetTopLevel(window));

            var viewModel = new MainViewModel(filePicker);
            window.DataContext = viewModel;

            desktop.MainWindow = window;
            desktop.ShutdownRequested += (_, _) => viewModel.Dispose();
        }

        base.OnFrameworkInitializationCompleted();
    }
}
