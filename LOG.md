# SpliceIt — Change Log

---

# Turn 7 — Phase 2b: interaction gaps closed + CS0108 fix

**Build status: Phase 2a compiled green** (2 warnings, both addressed below).

> ### ⚠️ Not compile-verified
> Validated: XAML well-formedness, brace/paren balance across all 30 `.cs` files.

**Scope:** 1 file added, 5 modified.

---

## 1. `CS0108` — not cosmetic

```
warning CS0108: 'AudioClipView.Clip' hides inherited member 'Visual.Clip'
```

`Visual.Clip` is the render-clipping `Geometry`. Shadowing it with an `AudioClip` property means any XAML setting `Clip="..."` on this control is genuinely ambiguous, and a future style targeting `Clip` could silently bind to the wrong member. Suppressing with `new` would have hidden a real hazard.

Renamed to `ClipModel` (property, `StyledProperty`, and all usages in `TimelineLanePanel` and `MainWindow.axaml`). Both warnings clear.

## 2. Draggable playhead — `Controls/PlayheadView.cs`

Phase 2a could only scrub from the ruler. The needle is now grabbable anywhere over the lanes, with a handle at the top and snap-to-grid.

**Design note.** The obvious approach — a full-width overlay with a custom hit-test — needs `ICustomHitTest`, whose XAML/namespace details I can't verify from here. Instead the control is **19 px wide** and positioned on a `Canvas` at `PlayheadCanvasLeft`, so clips either side receive pointer input naturally with no hit-test trickery. Dragging is delta-based, since an absolute position inside a control that moves with the playhead carries no timeline meaning.

## 3. Ctrl/Alt/Cmd + wheel zoom

`ZoomByDelta` has existed since Phase 2a with nothing calling it. Wired via `PointerWheelChanged` on the lane scroller in `MainWindow.axaml.cs`.

## 4. Clip context menu

Right-click a clip: Split at Playhead, Duplicate, Delete.

## 5. Resizable track header column

Column definitions became `220,3,*` with a `GridSplitter` spanning both rows. Because the ruler gutter, headers and lanes share one grid, dragging resizes all three consistently.

## 6. Clip Inspector tab

New bottom-dock tab: name, start/length/source-offset readouts, gain and fade sliders, and split/duplicate/delete buttons.

Visibility uses a plain `HasSelectedClip` bool on the view model rather than `ObjectConverters.IsNull` — that converter's XAML namespace mapping varies between Avalonia versions, and a bool has no such ambiguity.

---

## Gaps from Phase 2a now closed

| Gap | Status |
|---|---|
| Playhead not draggable in lanes | ✅ `PlayheadView` |
| `ZoomByDelta` never invoked | ✅ wheel handler |
| No clip context menu | ✅ |
| Fixed 220 px header column | ✅ `GridSplitter` |
| Playhead height hardcoded 4000 px | ⚠️ still hardcoded — works, inelegant |

---

## Still missing before Phase 2 is done

- **Export dialog** — export still goes straight to a save picker with fixed 24-bit WAV. No format, sample-rate or LUFS selection.
- **Media pool** — imported files always create a new track; no browsable pool, no audition, no drag-to-lane.
- **Master timetrack** with section markers.
- **Right tools sidebar.**
- **Keyboard shortcuts** — Space, S, Home/End, Delete are not bound.

---

## Next — Phase 2c, then Phase 3

Phase 2c: export dialog, media pool, master timetrack, keyboard shortcuts.

Phase 3: undo/redo (the `EditCommittedCommand` hook is already in place, firing once per gesture), clipboard, FFmpeg multi-format encode, metadata + cue chunks, and mirroring Turn 1's multiband and mid/side fixes into `MasteringChain.cs` — which still ignores `DspSettings.Multiband` entirely.

Phase 4: Concat mode behind a top-bar mode switcher.

---
---

# Turn 6 — Avalonia/C# Phase 2a: the timeline becomes usable

**Goal:** turn the static clip rectangles into a real arrangement view — zoom, scrub, drag, trim — with a design-token system underneath so Phase 2b isn't fighting hardcoded colours.

> ### ⚠️ Not compile-verified
> Same constraint as before. Validated: XML well-formedness of all `.axaml`, brace/paren/bracket balance across all 29 `.cs` files.
>
> **Phase 1 is still unconfirmed** — the last build error I saw was `CS0103`. If Turn 5 didn't clear it, fix that first; this turn sits on top of it.

**Scope:** 6 files added, 5 modified.

---

## New

### `Styles/DesignTokens.axaml`
Every colour from the React app's Tailwind classes, as `Color` + `SolidColorBrush` resources, merged into `App.axaml`. Colours were previously hardcoded in a dozen places across `MainWindow.axaml`, which made consistent change impossible.

### `Utils/ClipCollision.cs`
Direct port of `clipCollision.ts` — `Overlaps`, `GetMovementBounds`, `FindNextAvailableSlot`, `Snap`. Same 1 ms epsilon so clips can abut exactly without registering as overlapping. Drag, trim, duplicate and paste now behave identically in both front-ends because they share the algorithm.

### `Controls/AudioClipView.cs`
The interactive clip. Draws its own waveform, label, fade ramps, selection ring and trim handles, and owns its pointer handling:

- **Move** — drag the body; clamped between neighbours via `GetMovementBounds`
- **Trim start** — left 8 px; adjusts `TimelineStart`, `ClipOffset` and `ClipDuration` together, and refuses to read before the source's beginning
- **Trim end** — right 8 px; clamped by both the next clip *and* the end of the decoded source
- Cursor changes on hover over a handle
- `EditCommittedCommand` fires once on pointer-release, not per pointer-move — the Phase 3 undo stack needs one entry per gesture

Drawn rather than templated so hit-testing zones are unambiguous.

### `Controls/TimelineLanePanel.cs`
Positions clips by `TimelineStartSeconds × PixelsPerSecond`. A plain `Canvas` couldn't do this — `Canvas.Left` would need a per-child MultiBinding against live zoom. Keeping the maths in the panel makes a zoom change one `InvalidateArrange`.

### `Controls/TimelineRuler.cs`
Adaptive tick density (0.5 s / 1 s / 2 s / 5 s by zoom level), minute:second labels, loop-region overlay, playhead marker, and click-drag scrubbing.

### `Controls/WaveformRenderer.cs`
Shared peak-drawing extracted from `WaveformView`, so the clip view and any future thumbnail draw identically.

### `Converters/TimelineConverters.cs`
`SecondsAndZoomToPixelsConverter` (replaces Phase 0's fixed-scale converter, which couldn't respond to zoom at all), `ScrollOffsetToTransformConverter`, `HexToBrushConverter`.

---

## Modified

**`Views/MainWindow.axaml`** — the arrangement region rebuilt as a 2×2 grid: ruler gutter, ruler, track headers, lanes.

The scroll synchronisation is worth explaining. Rather than nesting `ScrollViewer`s and syncing offsets — which reliably ends in a feedback loop — there is **one** scroller (the lanes). The ruler and the header column are translated by its offset through `ScrollOffsetToTransformConverter`, on X and Y respectively. One source of truth, no fighting.

Track headers gained inline rename, move up/down, delete, and pan alongside volume.

**`ViewModels/MainViewModel.cs`** — zoom in/out plus `ZoomByDelta` for Ctrl+wheel, `Scrub`/`ScrubTo` that seeks a live transport, `AddTrack`/`DeleteTrack`/`MoveTrackUp`/`MoveTrackDown` with reindexing, `DuplicateSelectedClip` using `FindNextAvailableSlot`, `DeleteSelectedClip`, and computed `TimelineWidthPixels` / `PlayheadPixels`.

**Controls use bindable `ICommand` properties rather than CLR events** — `SelectCommand`, `EditCommittedCommand`, `ScrubCommand`. Events would have needed per-instance code-behind wiring for controls created inside a `DataTemplate`; commands bind directly.

---

## Known gaps in this slice

- **Playhead height is a hardcoded 4000 px** rectangle rather than bound to content height. Works, inelegant.
- **Ctrl+wheel zoom** — `ZoomByDelta` exists but nothing calls it yet; needs a `PointerWheelChanged` handler on the lane scroller.
- **Playhead isn't draggable** in the lane area (the ruler scrubs fine).
- **No clip context menu** yet.
- Fixed 220 px header column — the React version is drag-resizable.

## Risk in this turn

`{Binding $parent[Window].((vm:MainViewModel)DataContext).SomeCommand}` is used throughout the lane templates to reach view-model commands from inside nested `DataTemplate`s. The syntax is correct for Avalonia 11 compiled bindings, but it's verbose and I can't verify it here — if anything in the timeline fails to bind, this is the first thing to check.

---

## Next — Phase 2b

Bottom dock tabs (DSP / metadata / clip inspector / media pool), the export dialog with format selection, clip context menus, draggable playhead, Ctrl+wheel zoom wiring, and a resizable header column.

Then **Phase 3** (undo/redo, clipboard, FFmpeg multi-format encode, metadata + cue chunks, and mirroring Turn 1's multiband and mid/side fixes into `MasteringChain.cs`) and **Phase 4** (Concat mode behind a top-bar mode switcher).

---
---

# Turn 5 — Build fix: `CS0103 MediaFoundationApi`

```
error CS0103: The name 'MediaFoundationApi' does not exist in the current context
  Services/AudioImportService.cs(107,9)
```

### Cause

`MediaFoundationApi` lives in the `NAudio.MediaFoundation` namespace, which the file didn't import. `MediaFoundationReader` resolved fine because it's in `NAudio.Wave`, already imported — so the assembly reference was correct, only the namespace was missing.

### Fix

Removed the call rather than adding the `using`. `MediaFoundationReader`'s constructor calls `MediaFoundationApi.Startup()` internally, so the explicit initialisation was redundant. Deleting it is functionally identical and avoids betting on another namespace I can't verify from here.

### Risk-list update

That was #2 on Turn 3's predicted-failure list. Still outstanding, in order of likelihood:

1. `MultiplexingSampleProvider` constructor shape — only reached by files with more than 2 channels
2. `WasapiOut` overload `(AudioClientShareMode, bool useEventSync, int latency)` — this is a *runtime* path, so a clean build doesn't clear it; it fails on first Play
3. `AiffFileReader` availability in the metapackage
4. `[property: JsonIgnore]` on `[ObservableProperty]` fields
5. `SupportedOSPlatformVersion 7.0` possibly needing `10.0.17763.0`

Items 1–4 are compile-time and will surface on this build. Item 2 won't.

---
---

# Turn 4 — Codespaces build fix (`NETSDK1073`)

**One-line change.** `dotnet publish -r win-x64` failed on Linux with:

```
error NETSDK1073: The FrameworkReference
'Microsoft.WindowsDesktop.App.WindowsForms' was not recognized
```

### Cause

The `NAudio` metapackage pulls in `NAudio.WinMM`, whose `net*-windows` target references WinForms — the legacy WaveIn/WaveOut APIs use window-message callbacks. We drive audio through WASAPI and never touch WinMM, but the metapackage brings it along regardless. A Linux SDK has no Windows Desktop targeting packs installed, so the reference can't resolve.

### Fix

Added to `SpliceIt.csproj`:

```xml
<EnableWindowsTargeting>true</EnableWindowsTargeting>
```

This is the SDK's documented switch for building Windows-targeted projects from a non-Windows host — it fetches the targeting packs from NuGet instead of expecting them locally.

### Also: publish the project, not the solution

`NETSDK1194` warns that `--output` isn't supported when building a solution. Since Turn 2 added `SpliceIt.sln`, a bare `dotnet publish` now resolves the solution instead of the project. Name the `.csproj`:

```bash
cd dotnet-solution
dotnet publish SpliceIt.csproj -c Release -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:IncludeNativeLibrariesForSelfExtract=true \
  -o publish/win-x64
```

`dotnet build` (no `-o`) is still fine against the solution.

### Expect a larger binary

Self-contained now bundles the Windows Desktop runtime alongside the base runtime, so the output grows to roughly 150–170 MB. Nothing is wrong — it's the transitive WinForms reference.

If that becomes annoying, the clean fix is to drop the `NAudio` metapackage and reference only the sub-packages we actually use, eliminating WinMM. I'd rather do that once the build is confirmed green than change two variables at once.

---
---

# Turn 3 — Avalonia/C# Phase 1: the foundation

**Goal:** make audio real. Decode files, play them, draw them, and export them. Everything Phase 2's UI port depends on but cannot be verified without.

> ### ⚠️ Not compile-verified
> Still no .NET SDK in this container and `nuget.org` remains outside its egress list. Validated: XML well-formedness of all `.axaml` / `.csproj` / manifest files, brace/paren/bracket balance across all 23 `.cs` files, namespace consistency, and a sweep confirming no synthetic tone remains anywhere.
>
> **This turn carries more risk than Phase 0** — it adds nine new files touching NAudio APIs I could not check against real assemblies. Please `dotnet build` and send errors verbatim.

**Scope:** 9 files added, 6 modified.

---

## The headline: the 220 Hz sine tone is gone

`AudioExportService.cs` previously contained:

```csharp
float sourceSample = MathF.Sin(2.0f * MathF.PI * 220.0f * (float)currentTimelineSec) * 0.2f;
```

Every export was a sine tone regardless of the project, because there was no audio decoding anywhere in the C# app. Export now pulls from `TimelineMixerSampleProvider` — the same component that feeds realtime playback, so a render cannot drift from what was auditioned.

---

## New files

### `Services/AudioImportService.cs`
Decodes to interleaved stereo float at the engine rate (48 kHz). Decoder selection:

| Extension | Reader | Why |
|---|---|---|
| `.wav` | `WaveFileReader` | Native, avoids Media Foundation quirks |
| `.aiff` / `.aif` | `AiffFileReader` | Native |
| `.ogg` | `VorbisWaveReader` | Media Foundation cannot read Vorbis |
| everything else | `MediaFoundationReader` | MP3, AAC/M4A, WMA, and FLAC on Win10+ |

Mono is widened via `MonoToStereoSampleProvider`; >2 channels keep the first two through a `MultiplexingSampleProvider` rather than guessing a surround downmix without channel-mask info. Resampling uses `WdlResamplingSampleProvider` — pure managed, no native dependency.

### `Models/AudioSampleData.cs` + `Services/AudioSampleCache.cs`
Decoded audio is stored once per absolute path and referenced by clips, so twenty clips over one file decode once. It's also why `.siq` stays small — only paths are serialised.

### `Services/PeakExtractionService.cs`
Max-absolute-amplitude bins across both channels, mirroring `extractPeaksFromBuffer` in the React app so both front-ends draw the same shape.

### `Audio/TimelineMixerSampleProvider.cs`
The core. Composites every clip with gain, fade envelopes (Linear / Exponential / EqualPower, matching `AudioClip.CalculateEnvelopeGain`), track volume and equal-power pan. Solo overrides mute. Handles loop regions at block boundaries. Master gain applied last.

Guards that matter: clips with no decoded audio are **skipped**, not faked; `clipOffset` past the source end is rejected; durations are clamped to available frames.

### `Audio/AudioPlaybackEngine.cs`
`WasapiOut` in shared mode with event sync. `Seek` moves the playhead without tearing down the device. `PlaybackStopped` is detached before teardown so disposal doesn't re-enter the handler.

### `Controls/WaveformView.cs`
Custom `Control` overriding `Render(DrawingContext)`. This is what replaces `NAudio.WaveFormRenderer`, which was referenced but unusable — it renders to `System.Drawing.Bitmap` (GDI+) and cannot compose with Avalonia. Honours `ClipOffset`/`ClipDuration` against `SourceDuration`, so a trimmed clip shows the correct slice instead of the whole file squashed to fit.

### `Services/IFilePickerService.cs` + `AvaloniaFilePickerService.cs`
`IStorageProvider` behind an interface so the view model opens dialogs without referencing a window. `TopLevel` is resolved lazily — the window isn't attached to a visual root at construction time.

---

## Modified

**`SpliceIt.csproj`** — TFM `net9.0` → `net9.0-windows`, required for NAudio's Media Foundation and WASAPI assets. **This still cross-compiles from Codespaces**: only WPF and WinForms need a Windows build host, not Avalonia.

**`Models/AudioClip.cs`** — added `Peaks` and `HasAudio`, both `[property: JsonIgnore]` since they're derived.

**`ViewModels/MainViewModel.cs`** — rewritten. Import/open/save/export commands with real dialogs, a `DispatcherTimer` transport clock driving the playhead, master volume and loop pushed into the engine via `partial void On...Changed` hooks, and `IDisposable` for engine teardown.

The three fake demo tracks are gone. They held clips pointing at no file; now that audio is real, inventing silent placeholders would just be lying in a new way. Sessions start with one empty track.

**`App.axaml.cs`** — constructs the picker and injects it. `MainViewModel` keeps a parameterless constructor for `Design.DataContext`.

**`Views/MainWindow.axaml`** — Import / Open / Save buttons, loop toggle, live playhead readout, `WaveformView` in the clip template, a `NO AUDIO` badge for clips whose source is missing, and an indeterminate progress bar during decode.

**`Services/AudioExportService.cs`** — rewritten against the mixer. Temp files are cleaned up in a `finally` even on cancellation, and a tagging failure no longer discards a good render.

---

## Where the risk is

Ranked by how likely I think a build error is:

1. **`MultiplexingSampleProvider` constructor shape** in `AudioImportService.NormaliseToStereo`. Only hit by >2-channel files.
2. **`WasapiOut` constructor overload** — I used `(AudioClientShareMode, bool useEventSync, int latency)`.
3. **`AiffFileReader` availability** in the NAudio metapackage.
4. **`[property: JsonIgnore]` on `[ObservableProperty]` fields** — correct syntax as of Toolkit 8.x, but worth confirming.
5. **`SupportedOSPlatformVersion 7.0`** may need to be `10.0.17763.0` for Media Foundation.

All five are local fixes, not design problems.

---

## What to test on Windows

1. **Import** a WAV and an MP3 → tracks appear with real waveforms at real widths
2. **Play** → you hear it; playhead readout advances
3. **Loop** → toggle mid-playback, it wraps at the loop end
4. **Split** with the playhead inside a clip → two clips, waveforms show different slices
5. **Export** → pick a path, and **the file is your actual audio**, not a sine tone
6. **Save** then **Open** the `.siq` → clips return with waveforms intact (audio is re-decoded from stored paths)
7. **Move a source file, then reopen** → clip shows `NO AUDIO` instead of silently producing silence

---

## Next turn — Phase 2: the UI port

Design tokens into an Avalonia `ResourceDictionary` first (`#0F0F10`, `#1A1A1C`, `#2D2D2F`, `#4FC3F7`, `#8E9299`, `#E0E0E0`, `#F27D26`, `#00FFA3`, `#FF4444`), then: timeline ruler with scrub, draggable playhead, clip drag + trim handles with the collision math from `clipCollision.ts`, zoom (replacing `SecondsToPixelsConverter`'s fixed scale with a `MultiBinding` against `ZoomFactor`), track headers with fader/pan/mute/solo/reorder, master timetrack with sections, right tools sidebar, bottom dock tabs, media pool, and the export dialog.

Then **Phase 3** (undo/redo, clipboard, `.siq` round-trip hardening, FFmpeg multi-format encode, metadata + cue chunks, plus mirroring Turn 1's multiband and mid/side fixes into `MasteringChain.cs`, which still ignores `DspSettings.Multiband` entirely) and **Phase 4** (Concat mode behind a top-bar mode switcher).

---
---

# Turn 2 — Avalonia/C# Phase 0: make it compile and run

**Build confirmed working by user** on .NET SDK 10.0.200 targeting net9.0.

1. **Compiled-binding failures — the build-breaker.** `AvaloniaUseCompiledBindingsByDefault=true` plus `x:DataType="vm:MainViewModel"` meant nested `DataTemplate` bindings to `Name`/`VolumeDb`/`Clips` resolved against `MainViewModel`, which has none of them. Added `x:DataType` to both templates.
2. **Play button could never change** — `Converter={x:Null}` is meaningless and the format string had no placeholder. Replaced with two `TextBlock`s driven by `{Binding IsPlaying}` / `{Binding !IsPlaying}`.
3. **Package set couldn't do the job** — `NAudio.Core` has no output device (`WasapiOut` lives in full `NAudio`) and can't decode MP3/AAC/FLAC. Swapped to full `NAudio` + `NAudio.Vorbis`. Dropped `NAudio.WaveFormRenderer` (GDI+, can't compose with Avalonia) and `MathNet.Filtering` (unreferenced).
4. **DSP and metadata models weren't observable** — POCOs bound two-way, so nothing could react to a change. All converted to `ObservableObject`.
5. **Mute/Solo were decorative** — no `Command`, no binding. Now `ToggleButton`s bound to the model with checked-state styling.
6. **Clips rendered at `Canvas.Left="10" Width="320"`** regardless of real coordinates. Added `SecondsToPixelsConverter` at a fixed 80 px/s.
7. **Added `SpliceIt.sln`** — there was none.
8. Export command guarded against re-entry; dB readouts under sliders; removed unused `using SpliceIt.DSP;` and `_metadataService` field; `Border` + `ClipToBounds` instead of a stray `Canvas`.

---
---

# Turn 1 — React spec-bug pass

Fixed the logic bugs that define correct behaviour for *both* apps, before porting. **Verified:** `tsc --noEmit` clean, `vite build` clean. **Scope:** 9 files, +763 / −306.

1. **Undo/redo broken three ways.** `pushHistorySnapshot` called inside `setTracks` updaters — impure, double-invoked under `StrictMode`. History entries shared references with live state. Index math (`Math.min(29, prev+1)` vs `.slice(-30)`) drifted. Replaced with `applyTrackEdit` / `applyTransientTrackEdit` / `handleCommitClipEdit` plus structural cloning.
2. **In-place mutation** — `track.clips = ...` and `.clips.push(...)` on live state. All handlers rewritten immutably; added `reindexTracks`.
3. **Playback clock stale closures** — `tick` closed over an always-true `isPlaying`; `tracks`/`currentTime` missing from deps so new clips never played.
4. **Hardcoded 0–8s loop** → real `loopRegion` state with draggable ruler handles.
5. **Colliding `Date.now()` IDs** → the unused `generateUniqueId`. Same bug in `dspEngine`'s source map leaked audio past stop.
6. **Stereo width was a volume knob** — `msSplitter`/`msMerger`/`midGain` declared and never connected. Both engines now use a real M/S matrix; full 0–200% range (old clamp was 0.1–1.5).
7. **Multiband mid band passed the full spectrum** (a wide `peaking` filter) — signal summed ~3×, roughly +9 dB and muddy. Now a real highpass→lowpass band.
8. **Master fader reached nothing** — added `setMasterOutput()` and a master stage in the offline render.
9. **`ExportModal` crashed React** — two `<input></input>` void elements.
10. **Ruler/lane width mismatch** — `max(1200,…)` vs `max(800,…)`.
11. Click-free `stopAll`; zero-length and out-of-bounds scheduling guards; collision-safe duplicate placement; keyboard handler no longer steals Ctrl+S.

**Deferred to the web repo:** FLAC frame-header bit-packing, the "OGG" that is a relabelled FLAC stream, ID3 `COMM` frames missing language + short-description fields, track fader/pan drags producing no undo entry, and deleting `src/data/dotnetSourceCode.ts`.
