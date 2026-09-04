using System;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;

namespace SpliceIt.Models;

public partial class AudioTrack : ObservableObject
{
    [ObservableProperty]
    private string _id = Guid.NewGuid().ToString("N");

    [ObservableProperty]
    private string _name = "Track";

    [ObservableProperty]
    private double _volumeDb = 0.0;

    [ObservableProperty]
    private double _pan = 0.0; // -1.0 (Left) to +1.0 (Right)

    [ObservableProperty]
    private bool _isMuted = false;

    [ObservableProperty]
    private bool _isSoloed = false;

    [ObservableProperty]
    private string _colorHex = "#3A86FF";

    public ObservableCollection<AudioClip> Clips { get; set; } = new();

    public float LinearVolume => (float)Math.Pow(10.0, VolumeDb / 20.0);

    public (float LeftGain, float RightGain) GetPanGains()
    {
        // Equal-power circular panning law (-3 dB center)
        float panVal = Math.Clamp((float)Pan, -1.0f, 1.0f);
        float angle = (panVal + 1.0f) * (MathF.PI / 4.0f); // 0 to PI/2
        float left = MathF.Cos(angle) * LinearVolume;
        float right = MathF.Sin(angle) * LinearVolume;
        return (left, right);
    }
}
