import React, { useRef } from 'react';
import {
  Save,
  FileUp,
  Sparkles,
  Scissors,
  Copy,
  Trash2,
  Grid,
  UploadCloud,
  ChevronRight,
  ChevronLeft,
  Settings2,
  HelpCircle,
  Clock,
  Layers,
  FileCode,
  Undo2,
  Redo2,
  FolderOpen
} from 'lucide-react';
import { SpliceItProjectFile } from '../types';

interface RightToolsSidebarProps {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSaveProject: () => void;
  onLoadProject: (project: SpliceItProjectFile) => void;
  onResetDemo: () => void;
  onImportAudioFile: (file: File) => void;
  onOpenMediaPool?: () => void;
  onSplitClip: () => void;
  onDuplicateClip: () => void;
  onDeleteClip: () => void;
  hasSelectedClip: boolean;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  gridSnapSize: number;
  onChangeSnapSize: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  trackCount: number;
  clipCount: number;
  totalDuration: number;
  onOpenCodeViewer: () => void;
}

export const RightToolsSidebar: React.FC<RightToolsSidebarProps> = ({
  isExpanded,
  onToggleExpanded,
  onSaveProject,
  onLoadProject,
  onResetDemo,
  onImportAudioFile,
  onOpenMediaPool,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  hasSelectedClip,
  snapToGrid,
  onToggleSnap,
  gridSnapSize,
  onChangeSnapSize,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  trackCount,
  clipCount,
  totalDuration,
  onOpenCodeViewer
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleProjectFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onLoadProject(json);
      } catch (err) {
        alert('Invalid .siq project file');
      }
    };
    reader.readAsText(file);
  };

  const handleAudioImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportAudioFile(file);
    }
  };

  return (
    <aside
      className={`bg-[#1A1A1C] border-l border-[#2D2D2F] flex flex-col shrink-0 z-20 transition-all duration-200 select-none shadow-xl ${
        isExpanded ? 'w-56' : 'w-12'
      }`}
    >
      {/* Header with expand/collapse toggle */}
      <div className="h-10 border-b border-[#2D2D2F] px-2 flex items-center justify-between bg-[#121214]">
        {isExpanded ? (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <Settings2 className="w-3.5 h-3.5 text-[#4FC3F7]" />
              <span className="text-[10px] font-bold text-white tracking-wider uppercase truncate">
                Tools &amp; Actions
              </span>
            </div>
            <button
              onClick={onToggleExpanded}
              title="Minimize to Icons"
              className="p-1 rounded text-[#8E9299] hover:text-white hover:bg-[#2D2D2F] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onToggleExpanded}
            title="Expand Sidebar"
            className="w-full flex justify-center py-1 text-[#8E9299] hover:text-[#4FC3F7] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* SECTION 1: HISTORY / UNDO & REDO */}
        <div>
          {isExpanded && (
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8E9299] px-1 mb-1.5">
              History
            </div>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className={`flex-1 flex items-center justify-center gap-1.5 rounded text-xs font-semibold py-1.5 border transition-colors cursor-pointer ${
                canUndo
                  ? 'bg-[#121214] hover:bg-[#2D2D2F] text-white border-[#2D2D2F]'
                  : 'bg-[#121214]/50 text-[#4F4F51] border-transparent cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              {isExpanded && <span className="text-[10px]">Undo</span>}
            </button>

            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className={`flex-1 flex items-center justify-center gap-1.5 rounded text-xs font-semibold py-1.5 border transition-colors cursor-pointer ${
                canRedo
                  ? 'bg-[#121214] hover:bg-[#2D2D2F] text-white border-[#2D2D2F]'
                  : 'bg-[#121214]/50 text-[#4F4F51] border-transparent cursor-not-allowed'
              }`}
            >
              <Redo2 className="w-3.5 h-3.5" />
              {isExpanded && <span className="text-[10px]">Redo</span>}
            </button>
          </div>
        </div>

        {/* SECTION 2: SESSION / PROJECT */}
        <div>
          {isExpanded && (
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8E9299] px-1 mb-1.5">
              Session (.siq)
            </div>
          )}

          <div className="space-y-1">
            {/* Save */}
            <button
              onClick={onSaveProject}
              title="Save Project (.siq)"
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                isExpanded
                  ? 'px-2.5 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] text-[#E0E0E0] border-[#2D2D2F]'
                  : 'p-2 justify-center bg-[#121214] hover:bg-[#2D2D2F] text-[#4FC3F7] border-transparent'
              }`}
            >
              <Save className="w-3.5 h-3.5 text-[#4FC3F7] shrink-0" />
              {isExpanded && (
                <div className="text-left leading-tight">
                  <div className="text-xs text-white">Save Session</div>
                  <div className="text-[9px] text-[#8E9299] font-normal">Export .siq JSON</div>
                </div>
              )}
            </button>

            {/* Open */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Open Project (.siq)"
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                isExpanded
                  ? 'px-2.5 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] text-[#E0E0E0] border-[#2D2D2F]'
                  : 'p-2 justify-center bg-[#121214] hover:bg-[#2D2D2F] text-[#8E9299] border-transparent'
              }`}
            >
              <FileUp className="w-3.5 h-3.5 text-[#8E9299] shrink-0" />
              {isExpanded && (
                <div className="text-left leading-tight">
                  <div className="text-xs text-white">Open Project</div>
                  <div className="text-[9px] text-[#8E9299] font-normal">Load .siq file</div>
                </div>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleProjectFileChange}
              accept=".siq,.json"
              className="hidden"
            />

            {/* Reload Demo Stems */}
            <button
              onClick={onResetDemo}
              title="Reset Demo Stems"
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                isExpanded
                  ? 'px-2.5 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] text-[#E0E0E0] border-[#2D2D2F]'
                  : 'p-2 justify-center bg-[#121214] hover:bg-[#2D2D2F] text-[#F27D26] border-transparent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />
              {isExpanded && (
                <div className="text-left leading-tight">
                  <div className="text-xs text-white">Demo Stems</div>
                  <div className="text-[9px] text-[#8E9299] font-normal">4-Track Synthetic Stems</div>
                </div>
              )}
            </button>

            {/* Import Audio File */}
            <button
              onClick={() => audioInputRef.current?.click()}
              title="Import Audio File (WAV, MP3, FLAC, OGG)"
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                isExpanded
                  ? 'px-2.5 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] text-[#E0E0E0] border-[#2D2D2F]'
                  : 'p-2 justify-center bg-[#121214] hover:bg-[#2D2D2F] text-[#00FF00] border-transparent'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#00FF00] shrink-0" />
              {isExpanded && (
                <div className="text-left leading-tight">
                  <div className="text-xs text-white">Import Audio</div>
                  <div className="text-[9px] text-[#8E9299] font-normal">WAV, MP3, FLAC, OGG</div>
                </div>
              )}
            </button>
            {/* Media Pool Loaded Files */}
            {onOpenMediaPool && (
              <button
                onClick={onOpenMediaPool}
                title="Manage Loaded Audio Files (Media Pool)"
                className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                  isExpanded
                    ? 'px-2.5 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] text-[#E0E0E0] border-[#2D2D2F]'
                    : 'p-2 justify-center bg-[#121214] hover:bg-[#2D2D2F] text-[#4FC3F7] border-transparent'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#4FC3F7] shrink-0" />
                {isExpanded && (
                  <div className="text-left leading-tight">
                    <div className="text-xs text-white">Media Pool</div>
                    <div className="text-[9px] text-[#8E9299] font-normal">Loaded Audio Files</div>
                  </div>
                )}
              </button>
            )}

            <input
              type="file"
              ref={audioInputRef}
              onChange={handleAudioImportChange}
              accept="audio/*,.wav,.mp3,.flac,.aac,.ogg"
              className="hidden"
            />
          </div>
        </div>

        {/* SECTION 3: EDITING SHORTCUTS */}
        <div>
          {isExpanded && (
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8E9299] px-1 mb-1.5">
              Editing
            </div>
          )}

          <div className="space-y-1">
            {/* Split */}
            <button
              onClick={onSplitClip}
              disabled={!hasSelectedClip}
              title="Split Clip at Playhead (S)"
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                hasSelectedClip
                  ? 'bg-[#121214] hover:bg-[#2D2D2F] text-[#E0E0E0] border-[#2D2D2F]'
                  : 'bg-[#121214]/50 text-[#4F4F51] border-transparent cursor-not-allowed'
              } ${isExpanded ? 'px-2.5 py-1.5' : 'p-2 justify-center'}`}
            >
              <Scissors className="w-3.5 h-3.5 text-[#F27D26] shrink-0" />
              {isExpanded && (
                <div className="text-left leading-tight flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white">Split Clip</span>
                    <kbd className="text-[9px] font-mono bg-[#1A1A1C] px-1 rounded text-[#8E9299]">
                      S
                    </kbd>
                  </div>
                  <div className="text-[9px] text-[#8E9299] font-normal">Cut at playhead</div>
                </div>
              )}
            </button>

            {/* Duplicate */}
            <button
              onClick={onDuplicateClip}
              disabled={!hasSelectedClip}
              title="Duplicate Clip"
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                hasSelectedClip
                  ? 'bg-[#121214] hover:bg-[#2D2D2F] text-[#E0E0E0] border-[#2D2D2F]'
                  : 'bg-[#121214]/50 text-[#4F4F51] border-transparent cursor-not-allowed'
              } ${isExpanded ? 'px-2.5 py-1.5' : 'p-2 justify-center'}`}
            >
              <Copy className="w-3.5 h-3.5 text-[#4FC3F7] shrink-0" />
              {isExpanded && (
                <div className="text-left leading-tight">
                  <div className="text-xs text-white">Duplicate</div>
                  <div className="text-[9px] text-[#8E9299] font-normal">Clone selected clip</div>
                </div>
              )}
            </button>

            {/* Delete */}
            <button
              onClick={onDeleteClip}
              disabled={!hasSelectedClip}
              title="Delete Clip"
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                hasSelectedClip
                  ? 'bg-[#121214] hover:bg-[#FF4444]/20 text-[#FF4444] border-[#2D2D2F] hover:border-[#FF4444]/40'
                  : 'bg-[#121214]/50 text-[#4F4F51] border-transparent cursor-not-allowed'
              } ${isExpanded ? 'px-2.5 py-1.5' : 'p-2 justify-center'}`}
            >
              <Trash2 className="w-3.5 h-3.5 text-[#FF4444] shrink-0" />
              {isExpanded && (
                <div className="text-left leading-tight">
                  <div className="text-xs text-[#FF4444]">Delete Clip</div>
                  <div className="text-[9px] text-[#8E9299] font-normal">Remove from track</div>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* SECTION 4: TIMELINE & SNAP */}
        <div>
          {isExpanded && (
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8E9299] px-1 mb-1.5">
              Timeline Grid &amp; Snap
            </div>
          )}

          <div className="space-y-1.5">
            <button
              onClick={onToggleSnap}
              title={`Toggle Grid Snapping (${gridSnapSize}s)`}
              className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
                snapToGrid
                  ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] border-[#4FC3F7]/40'
                  : 'bg-[#121214] text-[#8E9299] border-[#2D2D2F]'
              } ${isExpanded ? 'px-2.5 py-1.5' : 'p-2 justify-center'}`}
            >
              <Grid className="w-3.5 h-3.5 shrink-0" />
              {isExpanded && (
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs text-white">Snap to Grid</span>
                  <span
                    className={`text-[9px] font-mono px-1 rounded font-bold ${
                      snapToGrid ? 'bg-[#4FC3F7] text-black' : 'bg-[#2D2D2F] text-[#8E9299]'
                    }`}
                  >
                    {snapToGrid ? 'ON' : 'OFF'}
                  </span>
                </div>
              )}
            </button>

            {/* Grid Snap Size Select (Expanded) */}
            {isExpanded ? (
              <div className="bg-[#121214] p-2 rounded border border-[#2D2D2F]">
                <div className="text-[8px] font-bold uppercase text-[#8E9299] mb-1">
                  Grid Snap Resolution
                </div>
                <select
                  value={gridSnapSize}
                  onChange={(e) => onChangeSnapSize(parseFloat(e.target.value))}
                  className="w-full bg-[#1A1A1C] border border-[#2D2D2F] text-xs font-mono px-2 py-1 rounded text-white outline-none cursor-pointer focus:border-[#4FC3F7]"
                >
                  <option value={0.05}>0.05s (1/32 Bar)</option>
                  <option value={0.1}>0.10s (1/16 Bar)</option>
                  <option value={0.25}>0.25s (1/8 Bar - Standard)</option>
                  <option value={0.5}>0.50s (1/4 Bar)</option>
                  <option value={1.0}>1.00s (1 Bar)</option>
                  <option value={2.0}>2.00s (2 Bars)</option>
                </select>
              </div>
            ) : (
              <div
                title={`Snap size: ${gridSnapSize}s`}
                className="text-[9px] font-mono text-center text-[#8E9299] py-0.5"
              >
                {gridSnapSize}s
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: .NET 9 CODE INSPECTOR */}
        <div>
          {isExpanded && (
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#8E9299] px-1 mb-1.5">
              Developer
            </div>
          )}

          <button
            onClick={onOpenCodeViewer}
            title="Inspect .NET 9 Avalonia Solution"
            className={`w-full flex items-center gap-2 rounded text-xs font-semibold transition-colors cursor-pointer border ${
              isExpanded
                ? 'px-2.5 py-1.5 bg-[#121214] hover:bg-[#2D2D2F] text-purple-300 border-[#2D2D2F]'
                : 'p-2 justify-center bg-[#121214] hover:bg-[#2D2D2F] text-purple-400 border-transparent'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            {isExpanded && (
              <div className="text-left leading-tight">
                <div className="text-xs text-purple-300 font-bold">.NET 9 Solution</div>
                <div className="text-[9px] text-[#8E9299] font-normal">C# Avalonia 11 Suite</div>
              </div>
            )}
          </button>
        </div>

        {/* SECTION 6: STATS CAPSULE (Expanded only) */}
        {isExpanded && (
          <div className="bg-[#121214] rounded-lg p-2.5 border border-[#2D2D2F] text-[10px] space-y-1.5 mt-auto">
            <div className="flex justify-between text-[#8E9299]">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#4FC3F7]" />
                <span>Tracks:</span>
              </span>
              <span className="font-mono font-bold text-white">{trackCount}</span>
            </div>
            <div className="flex justify-between text-[#8E9299]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#F27D26]" />
                <span>Session Length:</span>
              </span>
              <span className="font-mono font-bold text-white">{totalDuration.toFixed(1)}s</span>
            </div>
            <div className="flex justify-between text-[#8E9299]">
              <span>Sample Rate:</span>
              <span className="font-mono text-[#00FF00]">48.0 kHz</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
