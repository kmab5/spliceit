using Avalonia.Controls;
using Avalonia.Input;
using SpliceIt.ViewModels;

namespace SpliceIt.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
    }

    /// <summary>
    /// Ctrl/Alt/Cmd + wheel zooms the timeline horizontally instead of
    /// scrolling, matching the React arrangement view. ZoomByDelta existed since
    /// Phase 2a but nothing invoked it.
    /// </summary>
    private void OnLaneWheel(object? sender, PointerWheelEventArgs e)
    {
        bool zoomModifier =
            e.KeyModifiers.HasFlag(KeyModifiers.Control) ||
            e.KeyModifiers.HasFlag(KeyModifiers.Alt) ||
            e.KeyModifiers.HasFlag(KeyModifiers.Meta);

        if (!zoomModifier) return;
        if (DataContext is not MainViewModel vm) return;

        vm.ZoomByDelta(e.Delta.Y);
        e.Handled = true;
    }
}
