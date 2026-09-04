import React from 'react';
import {
  Play,
  Pause,
  Square,
  Repeat,
  Download,
  SkipBack,
  SkipForward,
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface TopTransportBarProps {
  projectName: string;
  setProjectName: (name: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  currentTime: number; // seconds
  onGoToStart: () => void;
  onGoToEnd: () => void;
  onExportClick: () => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  isTrackHeaderVisible: boolean;
  onToggleTrackHeader: () => void;
  isStudioDockVisible: boolean;
  onToggleStudioDock: () => void;
  isRightSidebarVisible: boolean;
  onToggleRightSidebar: () => void;
}

export const TopTransportBar: React.FC<TopTransportBarProps> = ({
  projectName,
  setProjectName,
  isPlaying,
  onTogglePlay,
  onStop,
  isLooping,
  onToggleLoop,
  currentTime,
  onGoToStart,
  onGoToEnd,
  onExportClick,
  zoom,
  setZoom,
  isTrackHeaderVisible,
  onToggleTrackHeader,
  isStudioDockVisible,
  onToggleStudioDock,
  isRightSidebarVisible,
  onToggleRightSidebar
}) => {
  // Format timecode: 00:00:00.000
  const formatTimecode = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = Math.floor(sec % 60);
    const millis = Math.floor((sec % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  // Format bars & beats estimate (124 BPM, 4/4)
  const formatBarsBeats = (sec: number) => {
    const bpm = 124;
    const totalBeats = (sec * bpm) / 60;
    const bar = Math.floor(totalBeats / 4) + 1;
    const beat = (Math.floor(totalBeats) % 4) + 1;
    const sub = Math.floor((totalBeats % 1) * 16);
    return `${bar}.${beat}.${sub.toString().padStart(2, '0')}`;
  };

  return (
    <nav className="h-[52px] flex items-center justify-between px-3 md:px-4 bg-[#1A1A1C] border-b border-[#2D2D2F] select-none z-30 relative shrink-0">
      {/* Left: App Identity & Left Header Panel Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Toggle Left Tracks Panel */}
        <button
          onClick={onToggleTrackHeader}
          title={isTrackHeaderVisible ? 'Hide Track Headers' : 'Show Track Headers'}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isTrackHeaderVisible
              ? 'text-[#4FC3F7] bg-[#121214] hover:bg-[#2D2D2F]'
              : 'text-[#8E9299] hover:text-white hover:bg-[#2D2D2F]'
          }`}
        >
          {isTrackHeaderVisible ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-[#4FC3F7] to-[#1E88E5] rounded-md flex items-center justify-center shadow-[0_0_12px_rgba(79,195,247,0.35)] shrink-0">
            <div className="w-1 h-3 bg-white rounded-full mx-0.5"></div>
            <div className="w-1 h-2 bg-white rounded-full mx-0.5"></div>
          </div>
          <div className="font-bold tracking-tight text-white text-sm sm:text-base hidden sm:flex items-center">
            <span>SpliceIt</span>
            <span className="text-[#4FC3F7]">.siq</span>
          </div>
        </div>

        {/* Project Name Input */}
        <input
          id="project-name-input"
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] rounded px-2 py-1 text-xs text-[#E0E0E0] w-28 sm:w-36 font-medium truncate outline-none transition-colors"
          title="Session Name"
        />
      </div>

      {/* Center: THE PURE PLAY BAR (Go to Start, Stop, Play, Loop, Go to End, Timecode) */}
      <div className="flex items-center">
        <div className="flex items-center gap-2 sm:gap-3 bg-[#121214] px-3 sm:px-4 py-1.5 rounded-full border border-[#2D2D2F] shadow-inner">
          {/* Transport Navigation Group */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Go to Start */}
            <button
              id="btn-goto-start"
              onClick={onGoToStart}
              title="Go to Start (Home)"
              className="text-[#8E9299] hover:text-[#4FC3F7] transition-colors cursor-pointer p-1"
            >
              <SkipBack className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Stop */}
            <button
              id="btn-stop-playback"
              onClick={onStop}
              title="Stop / Rewind"
              className="text-[#8E9299] hover:text-white transition-colors cursor-pointer p-1"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Play / Pause */}
            <button
              id="btn-toggle-play"
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              className="text-white hover:text-[#4FC3F7] transition-colors cursor-pointer p-1 flex items-center"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current text-[#4FC3F7]" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            {/* Loop button */}
            <button
              id="btn-toggle-loop"
              onClick={onToggleLoop}
              title="Loop Playback"
              className={`p-1 transition-colors cursor-pointer ${
                isLooping ? 'text-[#4FC3F7]' : 'text-[#8E9299] hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            {/* Go to End */}
            <button
              id="btn-goto-end"
              onClick={onGoToEnd}
              title="Go to End (End)"
              className="text-[#8E9299] hover:text-[#4FC3F7] transition-colors cursor-pointer p-1"
            >
              <SkipForward className="w-3.5 h-3.5 fill-current" />
            </button>

            {/* Pulsing indicator dot */}
            <div
              className={`w-2 h-2 rounded-full transition-all ml-1 ${
                isPlaying
                  ? 'bg-[#FF4444] animate-pulse shadow-[0_0_8px_#FF4444]'
                  : 'bg-[#00FF00]'
              }`}
            />
          </div>

          <div className="w-[1px] h-4 bg-[#2D2D2F]"></div>

          {/* Timecode & Bar Readout */}
          <div className="flex items-center gap-2">
            <div className="font-mono text-xs sm:text-sm tracking-widest text-[#4FC3F7] font-bold select-text">
              {formatTimecode(currentTime)}
            </div>
            <div className="font-mono text-[10px] text-[#8E9299] hidden md:block">
              {formatBarsBeats(currentTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Zoom Slider, View Toggles & Export Master Render */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 bg-[#121214] border border-[#2D2D2F] rounded px-2 py-1 text-xs text-[#8E9299]">
          <button
            onClick={() => setZoom((z) => Math.max(15, z - 15))}
            className="hover:text-white px-1 font-mono font-bold cursor-pointer"
            title="Zoom Out (Horizontally)"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[10px] font-mono text-[#E0E0E0] w-8 text-center" title="Timeline Zoom (px/sec)">
            {Math.round(zoom)}
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(250, z + 15))}
            className="hover:text-white px-1 font-mono font-bold cursor-pointer"
            title="Zoom In (Horizontally)"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
        </div>

        {/* Toggle Bottom Studio Dock */}
        <button
          onClick={onToggleStudioDock}
          title={isStudioDockVisible ? 'Hide Studio Inspector' : 'Show Studio Inspector'}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isStudioDockVisible
              ? 'text-[#4FC3F7] bg-[#121214] hover:bg-[#2D2D2F]'
              : 'text-[#8E9299] hover:text-white hover:bg-[#2D2D2F]'
          }`}
        >
          {isStudioDockVisible ? (
            <PanelBottomClose className="w-4 h-4" />
          ) : (
            <PanelBottomOpen className="w-4 h-4" />
          )}
        </button>

        {/* Toggle Right Tools Sidebar */}
        <button
          onClick={onToggleRightSidebar}
          title={isRightSidebarVisible ? 'Hide Tools & Actions' : 'Show Tools & Actions'}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isRightSidebarVisible
              ? 'text-[#4FC3F7] bg-[#121214] hover:bg-[#2D2D2F]'
              : 'text-[#8E9299] hover:text-white hover:bg-[#2D2D2F]'
          }`}
        >
          {isRightSidebarVisible ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>

        {/* Bento Glowing Export Render Button */}
        <button
          id="btn-export-mixdown"
          onClick={onExportClick}
          title="Export 24-bit Broadcast Master WAV"
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 bg-[#4FC3F7] hover:bg-[#29B6F6] text-[#0F0F10] font-bold text-xs rounded transition-all shadow-[0_0_15px_rgba(79,195,247,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">EXPORT</span>
        </button>
      </div>
    </nav>
  );
};
