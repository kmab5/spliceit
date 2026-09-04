import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AudioTrackModel,
  AudioClipModel,
  DspMasteringSettings,
  AudioMetadataTags,
  SpliceItProjectFile,
  BottomInspectorTab,
  MasterSection,
  LoadedAudioFile
} from './types';
import { dspEngine } from './audio/dspEngine';
import { generateStudioStems, extractPeaksFromBuffer } from './audio/stemsGenerator';
import { TopTransportBar } from './components/TopTransportBar';
import { ArrangementView } from './components/ArrangementView';
import { DspMasteringPanel } from './components/dsp/DspMasteringPanel';
import { MetadataInspector } from './components/metadata/MetadataInspector';
import { ClipPropertiesPanel } from './components/clip/ClipPropertiesPanel';
import { DotnetCodeViewer } from './components/dotnet/DotnetCodeViewer';
import { ExportModal } from './components/ExportModal';
import { BentoGridFooter } from './components/bento/BentoGridFooter';
import { RightToolsSidebar } from './components/RightToolsSidebar';
import { AudioFilesPool } from './components/AudioFilesPool';
import { findNextAvailableSlot } from './utils/clipCollision';
import { Sliders, Tag, Layers, Code2, LayoutGrid, ChevronDown, ChevronUp, X, FolderOpen } from 'lucide-react';

const INITIAL_DSP_SETTINGS: DspMasteringSettings = {
  enabled: true,
  highCutBand: {
    type: 'HighShelf',
    frequency: 12000,
    gainDb: -4.5,
    q: 0.707,
    enabled: true
  },
  mudScoopBand: {
    type: 'Peaking',
    frequency: 320,
    gainDb: -3.5,
    q: 1.414,
    enabled: true
  },
  multiband: {
    lowCrossoverHz: 250,
    highCrossoverHz: 4000,
    lowBand: {
      thresholdDb: -18,
      ratio: 3.5,
      attackMs: 20,
      releaseMs: 150,
      makeupGainDb: 0
    },
    midBand: {
      thresholdDb: -15,
      ratio: 2.5,
      attackMs: 15,
      releaseMs: 100,
      makeupGainDb: 0
    },
    highBand: {
      thresholdDb: -20,
      ratio: 3.0,
      attackMs: 8,
      releaseMs: 80,
      makeupGainDb: 0
    },
    enabled: true
  },
  stereoImaging: {
    widthPercent: 100,
    enabled: true
  },
  limiter: {
    ceilingDb: -0.3,
    releaseMs: 50,
    targetLufs: -14.0,
    enabled: true
  }
};

const INITIAL_METADATA: AudioMetadataTags = {
  title: 'SpliceIt Master Mixdown',
  artist: 'Studio Architect',
  album: 'Cross-Platform Audio Workspace',
  year: 2026,
  trackNumber: 1,
  discNumber: 1,
  genre: 'Electronic / Synthwave',
  comment: 'Mastered with SpliceIt .NET 9 & Avalonia DSP Engine',
  composer: 'Principal Audio DSP Engineer',
  isrc: 'US-SIQ-26-00042',
  bpm: 124,
  key: 'F minor',
  lyrics: 'Splice it, carve the mud, cut the harsh highs, master to -14 LUFS...',
  copyright: '© 2026 SpliceIt Audio Technologies',
  publisher: 'SpliceIt Sound Labs',
  encoder: 'SpliceIt Managed DSP Engine (Avalonia 11 / .NET 9)'
};

const INITIAL_MASTER_SECTIONS: MasterSection[] = [
  { id: 'sec-intro', name: 'Intro / Hook', startTime: 0.0, endTime: 4.0, color: '#4FC3F7' },
  { id: 'sec-verse', name: 'Main Drop / Verse', startTime: 4.0, endTime: 12.0, color: '#00FFA3' },
  { id: 'sec-outro', name: 'Outro / Fade', startTime: 12.0, endTime: 16.0, color: '#BD00FF' }
];

export default function App() {
  const [projectName, setProjectName] = useState('SpliceIt Session');
  const [tracks, setTracks] = useState<AudioTrackModel[]>([]);
  const [dspSettings, setDspSettings] = useState<DspMasteringSettings>(INITIAL_DSP_SETTINGS);
  const [metadata, setMetadata] = useState<AudioMetadataTags>(INITIAL_METADATA);
  const [masterSections, setMasterSections] = useState<MasterSection[]>(INITIAL_MASTER_SECTIONS);

  // Playback & Timeline State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(16.0);
  const [zoom, setZoom] = useState(85); // pixels per second
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSnapSize, setGridSnapSize] = useState(0.25);

  // History State for Undo & Redo
  const [history, setHistory] = useState<{ tracks: AudioTrackModel[]; sections: MasterSection[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const isUndoRedoActiveRef = useRef(false);

  const pushHistorySnapshot = useCallback(
    (newTracks: AudioTrackModel[], newSections: MasterSection[]) => {
      if (isUndoRedoActiveRef.current) return;
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, { tracks: newTracks, sections: newSections }].slice(-30);
      });
      setHistoryIndex((prev) => Math.min(29, prev + 1));
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoActiveRef.current = true;
      const target = history[historyIndex - 1];
      setTracks(target.tracks);
      setMasterSections(target.sections);
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => {
        isUndoRedoActiveRef.current = false;
      }, 50);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoActiveRef.current = true;
      const target = history[historyIndex + 1];
      setTracks(target.tracks);
      setMasterSections(target.sections);
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => {
        isUndoRedoActiveRef.current = false;
      }, 50);
    }
  }, [historyIndex, history]);

  // Selected Clip & Bottom Dock Tab
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BottomInspectorTab>('bento');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Loaded Audio Files Pool State
  const [loadedAudioFiles, setLoadedAudioFiles] = useState<LoadedAudioFile[]>([]);

  // Master Bus Track controls
  const [masterVolumeDb, setMasterVolumeDb] = useState(0.0);
  const [isMasterMuted, setIsMasterMuted] = useState(false);

  // Layout View Controls & Dimensions (Left, Bottom, Right)
  const [isTrackHeaderVisible, setIsTrackHeaderVisible] = useState(true);
  const [trackHeaderWidth, setTrackHeaderWidth] = useState(224);

  const [isStudioDockVisible, setIsStudioDockVisible] = useState(true);
  const [studioDockHeight, setStudioDockHeight] = useState(290);

  const [isRightSidebarVisible, setIsRightSidebarVisible] = useState(true);
  const [isRightSidebarExpanded, setIsRightSidebarExpanded] = useState(true);

  // Bottom dock resize drag logic
  const [isResizingBottom, setIsResizingBottom] = useState(false);
  const startBottomYRef = useRef(0);
  const startBottomHeightRef = useRef(studioDockHeight);

  const handleBottomResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingBottom(true);
    startBottomYRef.current = e.clientY;
    startBottomHeightRef.current = studioDockHeight;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingBottom) return;
      const deltaY = startBottomYRef.current - e.clientY;
      const newHeight = Math.max(140, Math.min(550, startBottomHeightRef.current + deltaY));
      setStudioDockHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingBottom(false);
    };

    if (isResizingBottom) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
    } else {
      document.body.style.cursor = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizingBottom]);

  // Animation frame and timer tracking
  const playbackStartTimeRef = useRef(0);
  const playbackStartTimelineSecRef = useRef(0);

  // 1. Initial Session Stems Setup
  const loadDemoStems = useCallback(async () => {
    try {
      const audioCtx = dspEngine.getAudioContext();
      const stems = await generateStudioStems(audioCtx);

      const drumTrack: AudioTrackModel = {
        id: 'trk-1',
        name: 'Punchy Drums & Perc',
        volumeDb: 0.0,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        color: '#00D2FF',
        clips: [
          {
            id: 'clip-drums-1',
            name: 'Kick & Snare 4-Bar',
            sourceFilePath: 'drums_stem_4bar.wav',
            trackIndex: 0,
            timelineStart: 0.0,
            clipOffset: 0.0,
            clipDuration: stems.drums.buffer.duration,
            sourceDuration: stems.drums.buffer.duration,
            gainDb: 0.0,
            fadeInDuration: 0.04,
            fadeOutDuration: 0.04,
            crossfadeType: 'EqualPower',
            peaks: stems.drums.peaks,
            audioBuffer: stems.drums.buffer
          }
        ]
      };

      const bassTrack: AudioTrackModel = {
        id: 'trk-2',
        name: 'Analog Sub & 808',
        volumeDb: -1.0,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        color: '#BD00FF',
        clips: [
          {
            id: 'clip-bass-1',
            name: 'Analog Sub Groove',
            sourceFilePath: 'sub_bass_stem.wav',
            trackIndex: 1,
            timelineStart: 0.0,
            clipOffset: 0.0,
            clipDuration: stems.bass.buffer.duration,
            sourceDuration: stems.bass.buffer.duration,
            gainDb: 0.0,
            fadeInDuration: 0.04,
            fadeOutDuration: 0.04,
            crossfadeType: 'EqualPower',
            peaks: stems.bass.peaks,
            audioBuffer: stems.bass.buffer
          }
        ]
      };

      const synthTrack: AudioTrackModel = {
        id: 'trk-3',
        name: 'Arp Lead & Chords',
        volumeDb: -2.5,
        pan: -0.2,
        isMuted: false,
        isSoloed: false,
        color: '#FFAA00',
        clips: [
          {
            id: 'clip-synth-1',
            name: 'Arpeggio Synth Hook',
            sourceFilePath: 'synth_arp_lead.wav',
            trackIndex: 2,
            timelineStart: 0.0,
            clipOffset: 0.0,
            clipDuration: stems.synth.buffer.duration,
            sourceDuration: stems.synth.buffer.duration,
            gainDb: 0.0,
            fadeInDuration: 0.04,
            fadeOutDuration: 0.04,
            crossfadeType: 'EqualPower',
            peaks: stems.synth.peaks,
            audioBuffer: stems.synth.buffer
          }
        ]
      };

      const ambientTrack: AudioTrackModel = {
        id: 'trk-4',
        name: 'Atmospheric FX & Pad',
        volumeDb: -4.0,
        pan: 0.25,
        isMuted: false,
        isSoloed: false,
        color: '#00FFA3',
        clips: [
          {
            id: 'clip-ambient-1',
            name: 'Warm Lush Pad',
            sourceFilePath: 'ambient_pad_stem.wav',
            trackIndex: 3,
            timelineStart: 0.0,
            clipOffset: 0.0,
            clipDuration: stems.ambient.buffer.duration,
            sourceDuration: stems.ambient.buffer.duration,
            gainDb: 0.0,
            fadeInDuration: 0.1,
            fadeOutDuration: 0.1,
            crossfadeType: 'EqualPower',
            peaks: stems.ambient.peaks,
            audioBuffer: stems.ambient.buffer
          }
        ]
      };

      const initialTracks = [drumTrack, bassTrack, synthTrack, ambientTrack];
      setTracks(initialTracks);
      setTotalDuration(Math.max(16, stems.drums.buffer.duration * 2));
      setSelectedClipId(drumTrack.clips[0].id);
      setHistory([{ tracks: initialTracks, sections: INITIAL_MASTER_SECTIONS }]);
      setHistoryIndex(0);

      // Populate Audio Media Pool with initial studio stems
      const demoMediaPool: LoadedAudioFile[] = [
        {
          id: 'file-drums',
          name: 'Kick & Snare 4-Bar Loop',
          fileName: 'drums_stem_4bar.wav',
          duration: stems.drums.buffer.duration,
          sampleRate: stems.drums.buffer.sampleRate,
          channels: stems.drums.buffer.numberOfChannels,
          importedAt: 'Session Init',
          audioBuffer: stems.drums.buffer,
          peaks: stems.drums.peaks
        },
        {
          id: 'file-bass',
          name: 'Analog Sub Groove',
          fileName: 'sub_bass_stem.wav',
          duration: stems.bass.buffer.duration,
          sampleRate: stems.bass.buffer.sampleRate,
          channels: stems.bass.buffer.numberOfChannels,
          importedAt: 'Session Init',
          audioBuffer: stems.bass.buffer,
          peaks: stems.bass.peaks
        },
        {
          id: 'file-synth',
          name: 'Arpeggio Synth Hook',
          fileName: 'synth_arp_lead.wav',
          duration: stems.synth.buffer.duration,
          sampleRate: stems.synth.buffer.sampleRate,
          channels: stems.synth.buffer.numberOfChannels,
          importedAt: 'Session Init',
          audioBuffer: stems.synth.buffer,
          peaks: stems.synth.peaks
        },
        {
          id: 'file-ambient',
          name: 'Warm Lush Pad',
          fileName: 'ambient_pad_stem.wav',
          duration: stems.ambient.buffer.duration,
          sampleRate: stems.ambient.buffer.sampleRate,
          channels: stems.ambient.buffer.numberOfChannels,
          importedAt: 'Session Init',
          audioBuffer: stems.ambient.buffer,
          peaks: stems.ambient.peaks
        }
      ];
      setLoadedAudioFiles(demoMediaPool);
    } catch (e) {
      console.error('Error generating stems:', e);
    }
  }, []);

  useEffect(() => {
    loadDemoStems();
  }, [loadDemoStems]);

  // 2. Synchronize DSP settings whenever they change
  useEffect(() => {
    dspEngine.applyDspSettings(dspSettings);
  }, [dspSettings]);

  // 3. Playback Transport Clock
  useEffect(() => {
    let animId: number;

    if (isPlaying) {
      const audioCtx = dspEngine.getAudioContext();
      playbackStartTimeRef.current = audioCtx.currentTime;
      playbackStartTimelineSecRef.current = currentTime;

      // Launch audio playback through DSP pipeline
      dspEngine.playTimeline(tracks, currentTime, totalDuration);

      const tick = () => {
        const elapsed = audioCtx.currentTime - playbackStartTimeRef.current;
        let newTime = playbackStartTimelineSecRef.current + elapsed;

        if (isLooping && newTime >= 8.0) {
          // Loop between 0 and 8 seconds
          newTime = newTime % 8.0;
          playbackStartTimeRef.current = audioCtx.currentTime;
          playbackStartTimelineSecRef.current = 0;
          dspEngine.playTimeline(tracks, 0, totalDuration);
        } else if (newTime >= totalDuration) {
          setIsPlaying(false);
          dspEngine.stopAll();
          newTime = 0;
        }

        setCurrentTime(newTime);
        if (isPlaying) {
          animId = requestAnimationFrame(tick);
        }
      };

      animId = requestAnimationFrame(tick);
    } else {
      dspEngine.stopAll();
    }

    return () => {
      cancelAnimationFrame(animId);
      dspEngine.stopAll();
    };
  }, [isPlaying, isLooping, totalDuration]);

  // Playback Control Handlers
  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      dspEngine.stopAll();
    } else {
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    setIsPlaying(false);
    dspEngine.stopAll();
    setCurrentTime(0);
  };

  const handleScrubTime = (time: number) => {
    setCurrentTime(time);
    if (isPlaying) {
      dspEngine.playTimeline(tracks, time, totalDuration);
      const audioCtx = dspEngine.getAudioContext();
      playbackStartTimeRef.current = audioCtx.currentTime;
      playbackStartTimelineSecRef.current = time;
    }
  };

  const handleGoToStart = () => {
    handleScrubTime(0);
  };

  const handleGoToEnd = () => {
    handleScrubTime(totalDuration);
  };

  // 4. Keyboard Shortcuts: Space (Play/Pause), S (Split Clip), Home (Go to Start), End (Go to End), Ctrl+Z (Undo), Ctrl+Y (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        handleSplitSelectedClip();
      } else if (e.code === 'Home') {
        e.preventDefault();
        handleGoToStart();
      } else if (e.code === 'End') {
        e.preventDefault();
        handleGoToEnd();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, selectedClipId, tracks, totalDuration, handleUndo, handleRedo]);

  // Track & Clip Management
  const handleMoveTrackUp = (trackIndex: number) => {
    if (trackIndex <= 0) return;
    setTracks((prev) => {
      const copy = [...prev];
      const temp = copy[trackIndex];
      copy[trackIndex] = copy[trackIndex - 1];
      copy[trackIndex - 1] = temp;
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });
  };

  const handleMoveTrackDown = (trackIndex: number) => {
    if (trackIndex >= tracks.length - 1) return;
    setTracks((prev) => {
      const copy = [...prev];
      const temp = copy[trackIndex];
      copy[trackIndex] = copy[trackIndex + 1];
      copy[trackIndex + 1] = temp;
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });
  };

  // Track & Clip Management
  const handleUpdateTrack = (trackIndex: number, updated: Partial<AudioTrackModel>) => {
    setTracks((prev) => {
      const copy = [...prev];
      if (copy[trackIndex]) {
        copy[trackIndex] = { ...copy[trackIndex], ...updated };
      }
      return copy;
    });
  };

  const handleDeleteTrack = (trackIndex: number) => {
    setTracks((prev) => {
      const next = prev.filter((_, idx) => idx !== trackIndex);
      pushHistorySnapshot(next, masterSections);
      return next;
    });
  };

  const handleAddTrack = () => {
    const colors = ['#00D2FF', '#BD00FF', '#FFAA00', '#00FFA3', '#FF0055'];
    const newTrack: AudioTrackModel = {
      id: `trk-${Date.now()}`,
      name: `Audio Track ${tracks.length + 1}`,
      volumeDb: 0.0,
      pan: 0.0,
      isMuted: false,
      isSoloed: false,
      color: colors[tracks.length % colors.length],
      clips: []
    };
    setTracks((prev) => {
      const next = [...prev, newTrack];
      pushHistorySnapshot(next, masterSections);
      return next;
    });
  };

  const handleUpdateClip = (trackIndex: number, clipId: string, updated: Partial<AudioClipModel>) => {
    setTracks((prev) => {
      const copy = [...prev];
      const track = copy[trackIndex];
      if (!track) return prev;

      track.clips = track.clips.map((c) => (c.id === clipId ? { ...c, ...updated } : c));
      return copy;
    });
  };

  // Find currently selected clip
  let selectedClip: AudioClipModel | null = null;
  let selectedClipTrackIndex = -1;
  for (let t = 0; t < tracks.length; t++) {
    const found = tracks[t].clips.find((c) => c.id === selectedClipId);
    if (found) {
      selectedClip = found;
      selectedClipTrackIndex = t;
      break;
    }
  }

  // Non-destructive Clip Split at current playhead
  const handleSplitSelectedClip = () => {
    if (!selectedClip || selectedClipTrackIndex === -1) return;

    const clip = selectedClip;
    const clipStart = clip.timelineStart;
    const clipEnd = clip.timelineStart + clip.clipDuration;

    if (currentTime <= clipStart + 0.1 || currentTime >= clipEnd - 0.1) {
      return;
    }

    const firstDuration = currentTime - clipStart;
    const secondDuration = clip.clipDuration - firstDuration;

    const leftClip: AudioClipModel = {
      ...clip,
      clipDuration: firstDuration
    };

    const rightClip: AudioClipModel = {
      ...clip,
      id: `clip-${Date.now()}`,
      name: `${clip.name} (Split)`,
      timelineStart: currentTime,
      clipOffset: clip.clipOffset + firstDuration,
      clipDuration: secondDuration
    };

    setTracks((prev) => {
      const copy = [...prev];
      const track = copy[selectedClipTrackIndex];
      if (!track) return prev;

      track.clips = track.clips.map((c) => (c.id === clip.id ? leftClip : c));
      track.clips.push(rightClip);
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });

    setSelectedClipId(rightClip.id);
  };

  const handleDuplicateSelectedClip = () => {
    if (!selectedClip || selectedClipTrackIndex === -1) return;
    const newClip: AudioClipModel = {
      ...selectedClip,
      id: `clip-${Date.now()}`,
      name: `${selectedClip.name} (Copy)`,
      timelineStart: selectedClip.timelineStart + selectedClip.clipDuration + 0.5
    };

    setTracks((prev) => {
      const copy = [...prev];
      copy[selectedClipTrackIndex].clips.push(newClip);
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });
    setSelectedClipId(newClip.id);
  };

  const handleDeleteSelectedClip = () => {
    if (!selectedClip || selectedClipTrackIndex === -1) return;
    setTracks((prev) => {
      const copy = [...prev];
      copy[selectedClipTrackIndex].clips = copy[selectedClipTrackIndex].clips.filter(
        (c) => c.id !== selectedClip!.id
      );
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });
    setSelectedClipId(null);
  };

  // External Audio File Import (WAV, MP3, FLAC, OGG)
  const handleImportAudioFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = dspEngine.getAudioContext();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const peaks = extractPeaksFromBuffer(decodedBuffer, 100);

      const newTrack: AudioTrackModel = {
        id: `trk-imported-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        volumeDb: 0.0,
        pan: 0.0,
        isMuted: false,
        isSoloed: false,
        color: '#00D2FF',
        clips: [
          {
            id: `clip-imported-${Date.now()}`,
            name: file.name,
            sourceFilePath: file.name,
            trackIndex: tracks.length,
            timelineStart: 0.0,
            clipOffset: 0.0,
            clipDuration: decodedBuffer.duration,
            sourceDuration: decodedBuffer.duration,
            gainDb: 0.0,
            fadeInDuration: 0.05,
            fadeOutDuration: 0.05,
            crossfadeType: 'EqualPower',
            peaks,
            audioBuffer: decodedBuffer
          }
        ]
      };

      // Register file into Audio Media Pool
      const poolEntry: LoadedAudioFile = {
        id: `file-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        duration: decodedBuffer.duration,
        sampleRate: decodedBuffer.sampleRate,
        channels: decodedBuffer.numberOfChannels,
        fileSize: file.size,
        importedAt: new Date().toLocaleTimeString(),
        audioBuffer: decodedBuffer,
        peaks
      };
      setLoadedAudioFiles((prev) => [poolEntry, ...prev]);

      setTracks((prev) => {
        const next = [...prev, newTrack];
        pushHistorySnapshot(next, masterSections);
        return next;
      });
      if (decodedBuffer.duration > totalDuration) {
        setTotalDuration(Math.ceil(decodedBuffer.duration + 4));
      }
      setSelectedClipId(newTrack.clips[0].id);
    } catch (err) {
      alert(`Could not decode audio file: ${err}`);
    }
  };

  // Media Pool File Actions
  const handleInsertClipFromPool = (fileId: string, trackIndex: number, preferredStart?: number) => {
    const file = loadedAudioFiles.find((f) => f.id === fileId);
    if (!file || !tracks[trackIndex]) return;

    const targetTrack = tracks[trackIndex];
    const startTime = preferredStart !== undefined ? preferredStart : currentTime;
    // Strictly prevent overlap on the same track
    const slot = findNextAvailableSlot(startTime, file.duration, targetTrack.clips);

    const newClip: AudioClipModel = {
      id: `clip-pool-${Date.now()}`,
      name: file.name,
      sourceFilePath: file.fileName,
      trackIndex,
      timelineStart: slot,
      clipOffset: 0.0,
      clipDuration: file.duration,
      sourceDuration: file.duration,
      gainDb: 0.0,
      fadeInDuration: 0.04,
      fadeOutDuration: 0.04,
      crossfadeType: 'EqualPower',
      peaks: file.peaks,
      audioBuffer: file.audioBuffer
    };

    setTracks((prev) => {
      const copy = [...prev];
      copy[trackIndex] = {
        ...copy[trackIndex],
        clips: [...copy[trackIndex].clips, newClip]
      };
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });

    if (slot + file.duration > totalDuration) {
      setTotalDuration(Math.ceil(slot + file.duration + 4));
    }
    setSelectedClipId(newClip.id);
  };

  const handleCreateTrackWithFile = (fileId: string) => {
    const file = loadedAudioFiles.find((f) => f.id === fileId);
    if (!file) return;

    const colors = ['#00D2FF', '#BD00FF', '#FFAA00', '#00FFA3', '#FF0055'];
    const newTrackIndex = tracks.length;
    const newClip: AudioClipModel = {
      id: `clip-pool-${Date.now()}`,
      name: file.name,
      sourceFilePath: file.fileName,
      trackIndex: newTrackIndex,
      timelineStart: 0.0,
      clipOffset: 0.0,
      clipDuration: file.duration,
      sourceDuration: file.duration,
      gainDb: 0.0,
      fadeInDuration: 0.04,
      fadeOutDuration: 0.04,
      crossfadeType: 'EqualPower',
      peaks: file.peaks,
      audioBuffer: file.audioBuffer
    };

    const newTrack: AudioTrackModel = {
      id: `trk-layer-${Date.now()}`,
      name: file.name,
      volumeDb: 0.0,
      pan: 0.0,
      isMuted: false,
      isSoloed: false,
      color: colors[newTrackIndex % colors.length],
      clips: [newClip]
    };

    setTracks((prev) => {
      const next = [...prev, newTrack];
      pushHistorySnapshot(next, masterSections);
      return next;
    });

    if (file.duration > totalDuration) {
      setTotalDuration(Math.ceil(file.duration + 4));
    }
    setSelectedClipId(newClip.id);
  };

  const handleDeleteLoadedAudioFile = (fileId: string) => {
    setLoadedAudioFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Track insertion & layer operations
  const handleInsertTrack = (newTrack: AudioTrackModel, insertAfterIndex?: number) => {
    setTracks((prev) => {
      const copy = [...prev];
      if (insertAfterIndex !== undefined && insertAfterIndex >= 0 && insertAfterIndex < copy.length) {
        copy.splice(insertAfterIndex + 1, 0, newTrack);
      } else {
        copy.push(newTrack);
      }
      const reindexed = copy.map((t, trkIdx) => ({
        ...t,
        clips: t.clips.map((c) => ({ ...c, trackIndex: trkIdx }))
      }));
      pushHistorySnapshot(reindexed, masterSections);
      return reindexed;
    });
  };

  const handleAddClipToTrack = (trackIndex: number, clip: AudioClipModel) => {
    setTracks((prev) => {
      const copy = [...prev];
      if (!copy[trackIndex]) return prev;
      copy[trackIndex] = {
        ...copy[trackIndex],
        clips: [...copy[trackIndex].clips, clip]
      };
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });
    if (clip.timelineStart + clip.clipDuration > totalDuration) {
      setTotalDuration(Math.ceil(clip.timelineStart + clip.clipDuration + 4));
    }
    setSelectedClipId(clip.id);
  };

  const handleDeleteClip = (trackIndex: number, clipId: string) => {
    setTracks((prev) => {
      const copy = [...prev];
      if (!copy[trackIndex]) return prev;
      copy[trackIndex] = {
        ...copy[trackIndex],
        clips: copy[trackIndex].clips.filter((c) => c.id !== clipId)
      };
      pushHistorySnapshot(copy, masterSections);
      return copy;
    });
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
  };

  // Project Persistence (.siq format matching ProjectFile.cs)
  const handleSaveProject = () => {
    const projectData: SpliceItProjectFile = {
      schemaVersion: '1.0.0',
      appName: 'SpliceIt',
      projectFormatExtension: '.siq',
      projectName,
      sampleRate: 48000,
      tempoBpm: 124,
      timeSignature: '4/4',
      timelineLengthSeconds: totalDuration,
      tracks: tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => ({
          ...c,
          // Exclude binary AudioBuffer from JSON serialization
          audioBuffer: undefined
        }))
      })),
      dspSettings,
      metadata,
      masterSections,
      savedAtUtc: new Date().toISOString()
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}.siq`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = (loaded: SpliceItProjectFile) => {
    if (loaded.projectName) setProjectName(loaded.projectName);
    if (loaded.dspSettings) setDspSettings(loaded.dspSettings);
    if (loaded.metadata) setMetadata(loaded.metadata);
    if (loaded.timelineLengthSeconds) setTotalDuration(loaded.timelineLengthSeconds);
    if (loaded.masterSections) setMasterSections(loaded.masterSections);
    if (loaded.tracks) {
      setTracks(loaded.tracks);
      pushHistorySnapshot(loaded.tracks, loaded.masterSections || masterSections);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0F0F10] text-[#E0E0E0] font-sans overflow-hidden select-none">
      {/* 1. TOP TRANSPORT & CONTROL BAR */}
      <TopTransportBar
        projectName={projectName}
        setProjectName={setProjectName}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        isLooping={isLooping}
        onToggleLoop={() => setIsLooping(!isLooping)}
        currentTime={currentTime}
        onGoToStart={handleGoToStart}
        onGoToEnd={handleGoToEnd}
        onExportClick={() => setIsExportModalOpen(true)}
        zoom={zoom}
        setZoom={setZoom}
        isTrackHeaderVisible={isTrackHeaderVisible}
        onToggleTrackHeader={() => setIsTrackHeaderVisible(!isTrackHeaderVisible)}
        isStudioDockVisible={isStudioDockVisible}
        onToggleStudioDock={() => setIsStudioDockVisible(!isStudioDockVisible)}
        isRightSidebarVisible={isRightSidebarVisible}
        onToggleRightSidebar={() => setIsRightSidebarVisible(!isRightSidebarVisible)}
      />

      {/* 2. MAIN CENTER: Multi-Track Arrangement View + Collapsible Right Tools Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <ArrangementView
          tracks={tracks}
          onUpdateTrack={handleUpdateTrack}
          onDeleteTrack={handleDeleteTrack}
          onAddTrack={handleAddTrack}
          onInsertTrack={handleInsertTrack}
          onMoveTrackUp={handleMoveTrackUp}
          onMoveTrackDown={handleMoveTrackDown}
          selectedClipId={selectedClipId}
          onSelectClip={(clip) => {
            setSelectedClipId(clip.id);
            setActiveTab('clip');
          }}
          onUpdateClip={handleUpdateClip}
          onAddClipToTrack={handleAddClipToTrack}
          onDeleteClip={handleDeleteClip}
          onSplitClipAtPlayhead={handleSplitSelectedClip}
          currentTime={currentTime}
          totalDuration={totalDuration}
          zoom={zoom}
          onZoomChange={setZoom}
          onScrubTime={handleScrubTime}
          isLooping={isLooping}
          snapToGrid={snapToGrid}
          gridSnapSize={gridSnapSize}
          onImportAudioFile={handleImportAudioFile}
          isHeaderVisible={isTrackHeaderVisible}
          onToggleHeaderVisible={() => setIsTrackHeaderVisible(!isTrackHeaderVisible)}
          headerWidth={trackHeaderWidth}
          onResizeHeaderWidth={setTrackHeaderWidth}
          masterVolumeDb={masterVolumeDb}
          onUpdateMasterVolume={setMasterVolumeDb}
          isMasterMuted={isMasterMuted}
          onToggleMasterMute={() => setIsMasterMuted(!isMasterMuted)}
          masterSections={masterSections}
          onUpdateSections={(sections) => {
            setMasterSections(sections);
            pushHistorySnapshot(tracks, sections);
          }}
          onOpenMediaPool={() => {
            setIsStudioDockVisible(true);
            setActiveTab('files');
          }}
          onInsertClipToTrack={handleInsertClipFromPool}
        />

        {/* 3. RIGHT TOOLS & ACTIONS SIDEBAR */}
        {isRightSidebarVisible && (
          <RightToolsSidebar
            isExpanded={isRightSidebarExpanded}
            onToggleExpanded={() => setIsRightSidebarExpanded(!isRightSidebarExpanded)}
            onSaveProject={handleSaveProject}
            onLoadProject={handleLoadProject}
            onResetDemo={loadDemoStems}
            onImportAudioFile={handleImportAudioFile}
            onOpenMediaPool={() => {
              setIsStudioDockVisible(true);
              setActiveTab('files');
            }}
            onSplitClip={handleSplitSelectedClip}
            onDuplicateClip={handleDuplicateSelectedClip}
            onDeleteClip={handleDeleteSelectedClip}
            hasSelectedClip={!!selectedClip}
            snapToGrid={snapToGrid}
            onToggleSnap={() => setSnapToGrid(!snapToGrid)}
            gridSnapSize={gridSnapSize}
            onChangeSnapSize={setGridSnapSize}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            trackCount={tracks.length}
            clipCount={tracks.reduce((acc, t) => acc + t.clips.length, 0)}
            totalDuration={totalDuration}
            onOpenCodeViewer={() => {
              setIsStudioDockVisible(true);
              setActiveTab('csharp');
            }}
          />
        )}
      </div>

      {/* 4. BOTTOM DOCK: Tabbed Inspector (Resizable & Collapsible) */}
      {isStudioDockVisible && (
        <div
          style={{ height: `${studioDockHeight}px` }}
          className="bg-[#0F0F10] border-t border-[#2D2D2F] flex flex-col z-20 shadow-2xl shrink-0 relative transition-all duration-75"
        >
          {/* Draggable Horizontal Resize Handle at Top Edge */}
          <div
            onMouseDown={handleBottomResizeMouseDown}
            title="Drag vertically to resize bottom inspector"
            className="absolute -top-1.5 inset-x-0 h-3 cursor-row-resize z-40 flex items-center justify-center group"
          >
            <div className="w-16 h-1 rounded-full bg-[#2D2D2F] group-hover:bg-[#4FC3F7] transition-colors" />
          </div>

          {/* Tab Headers in Bento Style */}
          <div className="h-9 bg-[#121214] border-b border-[#2D2D2F] px-3 flex items-center gap-1.5 shrink-0">
            <button
              id="tab-bento-studio"
              onClick={() => setActiveTab('bento')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'bento'
                  ? 'bg-[#1A1A1C] text-[#4FC3F7] border-[#4FC3F7] font-bold'
                  : 'text-[#8E9299] hover:text-[#E0E0E0] border-transparent'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Bento Studio (DSP • Metadata • Meter)</span>
            </button>

            <button
              id="tab-dsp-mastering"
              onClick={() => setActiveTab('dsp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'dsp'
                  ? 'bg-[#1A1A1C] text-[#4FC3F7] border-[#4FC3F7] font-bold'
                  : 'text-[#8E9299] hover:text-[#E0E0E0] border-transparent'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Dynamics &amp; Limiter</span>
            </button>

            <button
              id="tab-metadata-inspector"
              onClick={() => setActiveTab('metadata')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'metadata'
                  ? 'bg-[#1A1A1C] text-[#4FC3F7] border-[#4FC3F7] font-bold'
                  : 'text-[#8E9299] hover:text-[#E0E0E0] border-transparent'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>TagLib# Tags</span>
            </button>

            <button
              id="tab-clip-properties"
              onClick={() => setActiveTab('clip')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'clip'
                  ? 'bg-[#1A1A1C] text-[#4FC3F7] border-[#4FC3F7] font-bold'
                  : 'text-[#8E9299] hover:text-[#E0E0E0] border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Clip Inspector</span>
            </button>

            {/* Media Pool Loaded Audio Files Tab */}
            <button
              id="tab-audio-pool"
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-[#1A1A1C] text-[#4FC3F7] border-[#4FC3F7] font-bold'
                  : 'text-[#8E9299] hover:text-[#E0E0E0] border-transparent'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#4FC3F7]" />
              <span>Media Pool ({loadedAudioFiles.length})</span>
            </button>

            <button
              id="tab-csharp-solution"
              onClick={() => setActiveTab('csharp')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-semibold border-b-2 transition-all ml-auto cursor-pointer ${
                activeTab === 'csharp'
                  ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] border-[#4FC3F7] font-bold'
                  : 'text-[#8E9299] hover:text-white border-transparent'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">.NET 9 / Avalonia C#</span>
            </button>

            {/* Minimize / Hide Studio Dock button */}
            <button
              onClick={() => setIsStudioDockVisible(false)}
              title="Hide Studio Dock"
              className="p-1 rounded text-[#8E9299] hover:text-white hover:bg-[#2D2D2F] transition-colors ml-1 cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'bento' && (
              <BentoGridFooter
                dspSettings={dspSettings}
                onUpdateDsp={(updated) => setDspSettings((prev) => ({ ...prev, ...updated }))}
                metadata={metadata}
                onUpdateMetadata={(updated) => setMetadata((prev) => ({ ...prev, ...updated }))}
                onBatchApplyMetadata={() => {
                  alert('Metadata applied to .siq project and mixdown pipeline!');
                }}
                isPlaying={isPlaying}
                onOpenAdvancedDsp={() => setActiveTab('dsp')}
              />
            )}

            {activeTab === 'dsp' && (
              <DspMasteringPanel
                dspSettings={dspSettings}
                onUpdateDsp={(updated) => setDspSettings((prev) => ({ ...prev, ...updated }))}
                isPlaying={isPlaying}
              />
            )}

            {activeTab === 'metadata' && (
              <MetadataInspector
                metadata={metadata}
                onUpdateMetadata={(updated) => setMetadata((prev) => ({ ...prev, ...updated }))}
                onApplyToMixdown={() => {
                  alert('Metadata applied to mixdown configuration!');
                }}
              />
            )}

            {activeTab === 'clip' && (
              <ClipPropertiesPanel
                selectedClip={selectedClip}
                onUpdateClip={(updated) => {
                  if (selectedClip && selectedClipTrackIndex !== -1) {
                    handleUpdateClip(selectedClipTrackIndex, selectedClip.id, updated);
                  }
                }}
                onSplitClip={handleSplitSelectedClip}
                onDuplicateClip={handleDuplicateSelectedClip}
                onDeleteClip={handleDeleteSelectedClip}
              />
            )}

            {activeTab === 'files' && (
              <AudioFilesPool
                files={loadedAudioFiles}
                tracks={tracks}
                onImportFile={handleImportAudioFile}
                onDeleteFile={handleDeleteLoadedAudioFile}
                onInsertClipToTrack={handleInsertClipFromPool}
                onCreateTrackWithFile={handleCreateTrackWithFile}
                currentTime={currentTime}
              />
            )}

            {activeTab === 'csharp' && <DotnetCodeViewer />}
          </div>
        </div>
      )}

      {/* 4. EXPORT MIXDOWN MODAL */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        projectName={projectName}
        tracks={tracks}
        dspSettings={dspSettings}
        metadata={metadata}
        onUpdateMetadata={(updated) => setMetadata((prev) => ({ ...prev, ...updated }))}
        masterSections={masterSections}
        onUpdateSections={setMasterSections}
      />
    </div>
  );
}
