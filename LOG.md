# SpliceIt — Change Log

## Turn 1 — React spec-bug pass

**Goal:** fix the logic bugs in the React app that define correct behaviour for *both* apps, before porting anything to Avalonia/C#. Codec-level bugs (FLAC bit-packing, fake OGG, malformed ID3 `COMM`) are deliberately **not** touched — the C# app will use TagLibSharp + FFmpeg for those, so fixing the JS encoders now would be thrown-away work. Those move to the separate web repo.

**Verification:** `tsc --noEmit` clean, `vite build` clean (1699 modules, no errors).
**Scope:** 9 files, +763 / −306.

---

### 1. Undo/redo was structurally broken

Three separate defects, all fixed:

- **Impure state updaters.** `pushHistorySnapshot` was called *inside* `setTracks(prev => {...})` updaters. React requires updaters to be pure; under `StrictMode` (which `main.tsx` enables) they are deliberately invoked twice, so every edit could push two history entries. Replaced with `applyTrackEdit`, which derives the next state from a ref, applies it, then records exactly one snapshot from the event handler.
- **Shared references.** History entries stored the *same* track/clip objects as live state. Because several handlers also mutated in place, undoing could restore an object that had already been changed. Added `cloneTracks` / `cloneSections`. `AudioBuffer` and `peaks` are intentionally shared by reference — they are immutable in practice and cloning decoded audio per edit would be ruinous.
- **Index drift.** `setHistoryIndex(prev => Math.min(29, prev + 1))` against an array trimmed with `.slice(-30)` desynced the cursor from the array. Now `historyRef` / `historyIndexRef` are updated together, index is always `array.length - 1`.

Also removed the `setTimeout(..., 50)` re-entrancy guard in undo/redo, which is unnecessary now that pushes no longer happen inside updaters.

**New API:**
- `applyTrackEdit(mutator)` — structural edit, records one undo step
- `applyTransientTrackEdit(mutator)` — drag/fader scrub, no undo step
- `handleCommitClipEdit()` — called on gesture end so a whole drag is one undo step
- `resetHistory(tracks, sections)` — new baseline on demo load / project open

`AudioClipItem` now tracks `didMoveRef` so a bare click (selection) doesn't push a redundant entry; `MasterTimetrack` does the same for section drags via `latestSectionsRef`.

### 2. In-place state mutation

`handleUpdateClip`, `handleSplitSelectedClip` and others did `track.clips = ...` and `.clips.push(...)` on objects reachable from current state, after only a shallow array copy. Every track/clip handler rewritten immutably. Added `reindexTracks` to re-derive `clip.trackIndex` after any structural change (previously reindexing happened only in `handleInsertTrack`, so other paths left stale indices behind).

### 3. Playback clock stale closures

The transport effect depended on `[isPlaying, isLooping, totalDuration]` and `tick` closed over `isPlaying`, which was always `true` at schedule time — the guard `if (isPlaying)` inside `tick` could never be false, so the loop relied on the cleanup function to stop. `tracks` and `currentTime` were missing from deps, so newly added clips never played and toggling loop restarted the transport.

Rewritten to depend on `isPlaying` alone, with every other value read from a live ref (`isPlayingRef`, `isLoopingRef`, `currentTimeRef`, `totalDurationRef`, `loopRegionRef`, `tracksRef`). Editing clips or toggling loop mid-playback no longer restarts anything.

`handleScrubTime` now anchors the clock *before* rescheduling sources, so the first tick after a scrub can't read a start time that predates the new sources. `handleTogglePlay` primes the AudioContext from inside the user gesture so browsers reliably resume a suspended context.

### 4. Hardcoded loop region

Loop was pinned to `0–8.0s` inside the transport clock, with `TimelineRuler` drawing a decorative `loopStart`/`loopEnd` overlay that nothing wrote to. Added real `loopRegion` state, draggable edge handles on the ruler, and persistence in `.siq`.

### 5. Colliding IDs

`id: \`clip-${Date.now()}\`` collides whenever two items are created in the same millisecond — duplicating a multi-clip track produced clips sharing an ID, which breaks React keys, selection and deletion. The existing `generateUniqueId` helper (timestamp + counter + random, previously imported nowhere) is now used everywhere. `dspEngine` had the same bug in its active-source map keys, which silently dropped sources from the stop list and leaked audio past stop; replaced with a monotonic counter.

### 6. Stereo width was not stereo width

`dspEngine` declared `msSplitter` / `msMerger` / `midGain` and never connected them — the actual chain was `mbSummer → sideGain → limiter`, a single gain node in series. The "M/S Width" slider was a master volume control. `mixdownExporter` had the identical fake.

Both now implement a real matrix:

```
Mid = (L + R) * 0.5      Side = (L - R) * 0.5
L'  = Mid + Side * W     R'   = Mid - Side * W
```

built from a `ChannelSplitter`, half-gain taps (one at `-0.5` for the difference), a width gain on the side component only, and a `ChannelMerger`. `W=0` is true mono, `W=1` unity, `W=2` wide. The old clamp of `0.1–1.5` made both ends of the UI range unreachable and is now `0–2.0`.

### 7. Multiband mid band summed the full spectrum

The mid band was a `peaking` filter at 1 kHz / Q 0.5 — which passes *everything*. Summed against the low and high bands, the signal was counted roughly three times (~+9 dB, very muddy). Replaced with a real band: highpass at the low crossover into a lowpass at the high one, both now tracking `lowCrossoverHz` / `highCrossoverHz` from settings.

### 8. Master fader never reached the audio

`masterVolumeDb` and `isMasterMuted` were React state, rendered in the UI, and used by nothing. Added `dspEngine.setMasterOutput(db, muted)` plus a master fader stage in the offline renderer, so exports now match what was auditioned. Both persist in `.siq`.

### 9. `ExportModal` crashed React

Two `<input ... ></input>` elements. `input` is a void element; React throws *"input is a void element tag and must not have children"* on render. Both made self-closing.

### 10. Ruler / timeline width mismatch

`TimelineRuler` and `MasterTimetrack` used `Math.max(1200, duration * zoom)` while `ArrangementView`'s clip canvas used `Math.max(800, ...)`. Below ~14s at default zoom the ruler was wider than the lanes and every tick was misaligned with the clips it labelled. All three now use `800`.

### 11. Smaller fixes

- `stopAll` used two hard `setValueAtTime` steps (`0` then `1`), which produced the very click it was meant to prevent. Now short linear ramps.
- Clip scheduling had no guard against zero/negative durations or a `clipOffset` past the end of the source buffer — both throw in `source.start()`.
- `handleDuplicateSelectedClip` offset the copy by `+0.5s` with no collision check, so it could land on top of a neighbour. Now uses `findNextAvailableSlot`, consistent with paste and pool-insert.
- Keyboard handler now also ignores `<select>` and `contentEditable` targets, and `S` no longer fires while `Ctrl`/`Cmd` is held (it was stealing Ctrl+S).
- Project load resets history to a clean baseline instead of appending to the previous session's stack.
- Removed unused `Play` import in `ArrangementView`.

---

## Known / deliberately deferred

- **Codec correctness** — FLAC frame headers look wrong (blocksize code `0x70` declares an 8-bit trailing value but 16 bits are written; sample-size bits suspect), OGG export is a FLAC stream with a relabelled MIME type, ID3 `COMM` frames omit the required language + short-description fields. Deferred to the web repo; the C# app will use TagLibSharp + FFmpeg.
- **Track fader / pan drags** are transient and produce no undo entry (clip drags and section drags now do). Wiring `onCommitEdit` through `TrackHeader` is a small follow-up.
- **`src/data/dotnetSourceCode.ts`** — a third copy of the C# source embedded as template strings, already drifted from `dotnet-solution/` (missing `App.axaml`, `Program.cs`, `App.axaml.cs`). Untouched this turn; slated for deletion.
- Bundle is 709 kB unsplit. Not a correctness issue.

---

## Next turn — Avalonia/C# Phase 0 (make it compile and run)

1. **Compiled-binding failures.** `AvaloniaUseCompiledBindingsByDefault=true` + `x:DataType="vm:MainViewModel"` on the Window, but nested `DataTemplate`s bind `Name` / `VolumeDb` / `Clips` with no `x:DataType` of their own — they resolve against `MainViewModel`, which has none of those members. Add `x:DataType="models:AudioTrack"` and `models:AudioClip`.
2. **`Converter={x:Null}`** in the Play button binding — remove; add a real bool→string converter so the label actually toggles.
3. **Package set.** Drop `NAudio.WaveFormRenderer` (GDI+ `System.Drawing.Bitmap`, cannot compose with Avalonia) and unused `MathNet.Filtering`. Swap `NAudio.Core` → full `NAudio` for `WasapiOut` + `MediaFoundationReader`; add `NAudio.Vorbis` and `NAudio.Flac` for decode. FFmpeg (`FFMpegCore`) arrives in Phase 3 for encoding.
4. **Observable DSP models.** `DspSettings` and its nested configs are plain POCOs, so slider edits never notify and `MasteringChain.UpdateFilters()` is never re-called.
5. **Add a `.sln`.**
6. **Wire the dead Mute/Solo buttons** (no `Command` at all today).

Phase 0 is deliberately surgical — no new features, just getting a window on screen that doesn't lie about what it does.

### Then, in order

- **Phase 1** — file dialogs (`IStorageProvider`), audio import/decode service, peak extraction, a custom Avalonia waveform `Control`, real playback engine + transport clock.
- **Phase 2** — port the UI: transport bar, ruler, track headers, draggable/trimmable clips, master timetrack, context menus, right sidebar, bottom dock, export dialog. Design tokens (`#0F0F10`, `#1A1A1C`, `#2D2D2F`, `#4FC3F7`, `#8E9299`, `#E0E0E0`, `#F27D26`, `#00FFA3`, `#FF4444`) go into an Avalonia resource dictionary first.
- **Phase 3** — port the logic corrected above: undo/redo, clipboard, collision math, `.siq` round-trip, multi-format encode, metadata + cue chunks.
- **Phase 4** — Concat mode, reached from a **mode switcher in the top bar**, writing into the same track/clip model so a project opens in either mode without conversion.

### Also worth noting

`AudioExportService.cs` line ~85 currently reads:

```csharp
float sourceSample = MathF.Sin(2.0f * MathF.PI * 220.0f * (float)currentTimelineSec) * 0.2f;
```

Every C# export is a 220 Hz sine tone. There is no audio decoding anywhere in the C# project. This is Phase 1 work, not Phase 0 — it needs the import service to exist first.
