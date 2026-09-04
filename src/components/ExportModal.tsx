import React, { useState } from 'react';
import {
  X,
  Download,
  Disc,
  CheckCircle,
  FileText,
  Sliders,
  Tags,
  Bookmark,
  Plus,
  Trash2,
  RefreshCw
} from 'lucide-react';
import {
  AudioTrackModel,
  DspMasteringSettings,
  AudioMetadataTags,
  MasterSection,
  ExportFormat,
  ExportSettings
} from '../types';
import { renderTimelineMixdown, ExportResult } from '../audio/mixdownExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  tracks: AudioTrackModel[];
  dspSettings: DspMasteringSettings;
  metadata: AudioMetadataTags;
  onUpdateMetadata: (updated: Partial<AudioMetadataTags>) => void;
  masterSections: MasterSection[];
  onUpdateSections: (sections: MasterSection[]) => void;
}

type ModalTab = 'format' | 'metadata' | 'sections';

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  projectName,
  tracks,
  dspSettings,
  metadata,
  onUpdateMetadata,
  masterSections,
  onUpdateSections
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('format');
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  // Export settings state
  const [format, setFormat] = useState<ExportFormat>('wav-24');
  const [sampleRate, setSampleRate] = useState<number>(48000);
  const [loudnessTarget, setLoudnessTarget] = useState<number>(-14);
  const [mp3Bitrate, setMp3Bitrate] = useState<128 | 192 | 256 | 320>(320);
  const [embedMetadata, setEmbedMetadata] = useState<boolean>(true);
  const [embedSectionsCue, setEmbedSectionsCue] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    setProgress(0);
    setExportResult(null);

    const settings: Partial<ExportSettings> = {
      format,
      sampleRate,
      loudnessTargetLufs: loudnessTarget,
      mp3BitrateKbps: mp3Bitrate,
      embedMetadata,
      embedSectionsCue
    };

    try {
      const result = await renderTimelineMixdown(
        tracks,
        dspSettings,
        metadata,
        masterSections,
        settings,
        (pct, status) => {
          setProgress(pct);
          setStatusText(status);
        }
      );
      setExportResult(result);
    } catch (err) {
      console.error('Export failed:', err);
      setStatusText('Render encountered an error.');
    } finally {
      setIsRendering(false);
    }
  };

  const triggerAudioDownload = () => {
    if (!exportResult) return;
    const url = URL.createObjectURL(exportResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerCueDownload = () => {
    if (!exportResult?.cueSheet) return;
    const cueBlob = new Blob([exportResult.cueSheet], { type: 'text/plain' });
    const url = URL.createObjectURL(cueBlob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = exportResult.filename.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}.cue`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Section handling inside modal
  const handleAddSection = () => {
    const colors = ['#4FC3F7', '#00FFA3', '#F27D26', '#BD00FF', '#FFD600', '#FF4081'];
    const lastSec = masterSections[masterSections.length - 1];
    const startTime = lastSec ? lastSec.endTime : 0;
    const newSec: MasterSection = {
      id: `sec-${Date.now()}`,
      name: `Section ${masterSections.length + 1}`,
      startTime: Math.round(startTime * 10) / 10,
      endTime: Math.round((startTime + 4) * 10) / 10,
      color: colors[masterSections.length % colors.length]
    };
    onUpdateSections([...masterSections, newSec]);
  };

  const handleUpdateSection = (id: string, updated: Partial<MasterSection>) => {
    onUpdateSections(
      masterSections.map((s) => (s.id === id ? { ...s, ...updated } : s))
    );
  };

  const handleDeleteSection = (id: string) => {
    onUpdateSections(masterSections.filter((s) => s.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#1A1A1C] border border-[#2D2D2F] rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-[#E0E0E0]">
        {/* Modal Header */}
        <div className="h-12 bg-[#121214] border-b border-[#2D2D2F] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-[#4FC3F7]" />
            <span className="font-bold text-xs sm:text-sm text-white tracking-wide">
              EXPORT MIXDOWN &amp; MASTERING SUITE
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#4FC3F7]/15 text-[#4FC3F7] border border-[#4FC3F7]/30 hidden sm:inline">
              .siq Studio Engine
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E9299] hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#2D2D2F] bg-[#161618] px-4 shrink-0">
          <button
            onClick={() => setActiveTab('format')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'format'
                ? 'border-[#4FC3F7] text-[#4FC3F7] bg-[#4FC3F7]/5'
                : 'border-transparent text-[#8E9299] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Format &amp; Quality</span>
          </button>

          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'metadata'
                ? 'border-[#4FC3F7] text-[#4FC3F7] bg-[#4FC3F7]/5'
                : 'border-transparent text-[#8E9299] hover:text-white'
            }`}
          >
            <Tags className="w-3.5 h-3.5" />
            <span>Metadata Editor</span>
            {metadata.title && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF00] ml-0.5"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sections')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'sections'
                ? 'border-[#4FC3F7] text-[#4FC3F7] bg-[#4FC3F7]/5'
                : 'border-transparent text-[#8E9299] hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Sections &amp; Cue Points</span>
            <span className="text-[10px] font-mono bg-[#2D2D2F] px-1.5 py-0.2 rounded text-[#8E9299]">
              {masterSections.length}
            </span>
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: FORMAT & QUALITY */}
          {activeTab === 'format' && (
            <div className="space-y-4 text-xs">
              {/* Target Format Grid */}
              <div>
                <label className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider block mb-2">
                  Target Audio Container &amp; Format
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'wav-24', name: 'WAV 24-bit', desc: 'Broadcast Master PCM (Default)', tag: 'STUDIO' },
                    { id: 'wav-16', name: 'WAV 16-bit', desc: 'Red Book CD Standard', tag: 'CD' },
                    { id: 'wav-32', name: 'WAV 32-bit Float', desc: 'Maximum Dynamic Headroom', tag: 'HI-RES' },
                    { id: 'flac', name: 'FLAC Lossless', desc: 'True Lossless with Vorbis Comments', tag: 'LOSSLESS' },
                    { id: 'mp3', name: 'MP3 320 kbps', desc: 'Genuine Broadcast MP3 with ID3v2.4', tag: 'STREAM' },
                    { id: 'ogg', name: 'OGG Vorbis', desc: 'Open Source Audio Stream', tag: 'WEB' }
                  ].map((fmt) => (
                    <div
                      key={fmt.id}
                      onClick={() => {
                        setFormat(fmt.id as ExportFormat);
                        setExportResult(null);
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        format === fmt.id
                          ? 'bg-[#4FC3F7]/10 border-[#4FC3F7] shadow-[0_0_12px_rgba(79,195,247,0.2)]'
                          : 'bg-[#121214] border-[#2D2D2F] hover:border-[#4F4F51]'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white text-xs">{fmt.name}</span>
                        <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-black text-[#4FC3F7] border border-[#2D2D2F]">
                          {fmt.tag}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8E9299] leading-tight">{fmt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Rate & Loudness Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Sample Rate */}
                <div className="bg-[#121214] p-3 rounded-lg border border-[#2D2D2F]">
                  <label className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider block mb-1.5">
                    Sample Rate
                  </label>
                  <select
                    value={sampleRate}
                    onChange={(e) => {
                      setSampleRate(parseInt(e.target.value));
                      setExportResult(null);
                    }}
                    className="w-full bg-[#1A1A1C] border border-[#2D2D2F] text-xs font-mono px-2.5 py-1.5 rounded text-white outline-none cursor-pointer focus:border-[#4FC3F7]"
                  >
                    <option value={44100}>44,100 Hz (CD Audio Standard)</option>
                    <option value={48000}>48,000 Hz (Broadcast &amp; Video Standard)</option>
                    <option value={96000}>96,000 Hz (Hi-Res Audio Mastering)</option>
                  </select>
                </div>

                {/* Loudness Target */}
                <div className="bg-[#121214] p-3 rounded-lg border border-[#2D2D2F]">
                  <label className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider block mb-1.5">
                    Loudness Normalization
                  </label>
                  <select
                    value={loudnessTarget}
                    onChange={(e) => {
                      setLoudnessTarget(parseFloat(e.target.value));
                      setExportResult(null);
                    }}
                    className="w-full bg-[#1A1A1C] border border-[#2D2D2F] text-xs font-mono px-2.5 py-1.5 rounded text-white outline-none cursor-pointer focus:border-[#4FC3F7]"
                  >
                    <option value={-14}>-14.0 LUFS (Spotify / YouTube / Apple Music)</option>
                    <option value={-16}>-16.0 LUFS (Apple Music Sound Check)</option>
                    <option value={-23}>-23.0 LUFS (EBU R128 TV / Broadcast)</option>
                    <option value={-9}>-9.0 LUFS (Club &amp; EDM Loud Master)</option>
                  </select>
                </div>
              </div>

              {/* Advanced Bitrate if MP3 */}
              {format === 'mp3' && (
                <div className="bg-[#121214] p-3 rounded-lg border border-[#2D2D2F]">
                  <label className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider block mb-1.5">
                    MP3 Constant Bitrate (CBR)
                  </label>
                  <div className="flex gap-2">
                    {[128, 192, 256, 320].map((br) => (
                      <button
                        key={br}
                        onClick={() => {
                          setMp3Bitrate(br as any);
                          setExportResult(null);
                        }}
                        className={`flex-1 py-1 text-xs font-mono rounded border transition-colors cursor-pointer ${
                          mp3Bitrate === br
                            ? 'bg-[#4FC3F7] text-black font-bold border-[#4FC3F7]'
                            : 'bg-[#1A1A1C] text-[#8E9299] border-[#2D2D2F] hover:text-white'
                        }`}
                      >
                        {br} kbps
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Toggles */}
              <div className="bg-[#121214] p-3 rounded-lg border border-[#2D2D2F] space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={embedMetadata}
                    onChange={(e) => {
                      setEmbedMetadata(e.target.checked);
                      setExportResult(null);
                    }}
                    className="accent-[#4FC3F7] rounded"
                  >
                  </input>
                  <span className="text-white font-medium">
                    Embed TagLibSharp Metadata (Title, Artist, Album, ISRC, Year)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={embedSectionsCue}
                    onChange={(e) => {
                      setEmbedSectionsCue(e.target.checked);
                      setExportResult(null);
                    }}
                    className="accent-[#4FC3F7] rounded"
                  >
                  </input>
                  <span className="text-white font-medium">
                    Bake Master Bus Sections into RIFF cue/labl chunk &amp; Generate .CUE Sheet
                  </span>
                </label>
              </div>

              {/* Active DSP Mastering Chain summary */}
              <div className="bg-[#121214] p-3 rounded-lg border border-[#2D2D2F] text-[11px] space-y-1 text-[#8E9299]">
                <div className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider mb-1">
                  Active Mastering Filters to be Baked:
                </div>
                <div className="flex items-center gap-1.5 text-[#E0E0E0]">
                  <CheckCircle className="w-3.5 h-3.5 text-[#4FC3F7]" />
                  <span>Harsh High-Cut: {dspSettings.highCutBand.gainDb.toFixed(1)} dB @ 12.0 kHz</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#E0E0E0]">
                  <CheckCircle className="w-3.5 h-3.5 text-[#F27D26]" />
                  <span>Low-Mid Mud Scoop: {dspSettings.mudScoopBand.gainDb.toFixed(1)} dB @ {Math.round(dspSettings.mudScoopBand.frequency)} Hz</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#E0E0E0]">
                  <CheckCircle className="w-3.5 h-3.5 text-[#00FF00]" />
                  <span>True-Peak Limiter: {dspSettings.limiter.ceilingDb.toFixed(1)} dBTP ({loudnessTarget} LUFS Target)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: METADATA EDITOR */}
          {activeTab === 'metadata' && (
            <div className="space-y-3 text-xs">
              <div className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider mb-1">
                Edit Track Metadata for Export File
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-[#8E9299] uppercase block mb-1">
                    Track Title
                  </label>
                  <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => onUpdateMetadata({ title: e.target.value })}
                    className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-semibold px-2.5 py-1.5 rounded text-white outline-none"
                    placeholder="e.g. Midnight Horizon"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[#8E9299] uppercase block mb-1">
                    Artist / Performer
                  </label>
                  <input
                    type="text"
                    value={metadata.artist}
                    onChange={(e) => onUpdateMetadata({ artist: e.target.value })}
                    className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-semibold px-2.5 py-1.5 rounded text-white outline-none"
                    placeholder="e.g. Antigravity Audio"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[#8E9299] uppercase block mb-1">
                    Album / EP Name
                  </label>
                  <input
                    type="text"
                    value={metadata.album}
                    onChange={(e) => onUpdateMetadata({ album: e.target.value })}
                    className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-semibold px-2.5 py-1.5 rounded text-white outline-none"
                    placeholder="e.g. Neon Horizon"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[#8E9299] uppercase block mb-1">
                    ISRC Code
                  </label>
                  <input
                    type="text"
                    value={metadata.isrc}
                    onChange={(e) => onUpdateMetadata({ isrc: e.target.value })}
                    className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-mono px-2.5 py-1.5 rounded text-white outline-none"
                    placeholder="e.g. US-S1Q-26-00001"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[#8E9299] uppercase block mb-1">
                    Genre
                  </label>
                  <input
                    type="text"
                    value={metadata.genre}
                    onChange={(e) => onUpdateMetadata({ genre: e.target.value })}
                    className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs px-2.5 py-1.5 rounded text-white outline-none"
                    placeholder="e.g. Electronic / Ambient"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-[#8E9299] uppercase block mb-1">
                    Release Year
                  </label>
                  <input
                    type="number"
                    value={metadata.year || 2026}
                    onChange={(e) => onUpdateMetadata({ year: parseInt(e.target.value) || 2026 })}
                    className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs font-mono px-2.5 py-1.5 rounded text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-[#8E9299] uppercase block mb-1">
                  Broadcast Notes &amp; Copyright
                </label>
                <input
                  type="text"
                  value={metadata.comment}
                  onChange={(e) => onUpdateMetadata({ comment: e.target.value })}
                  className="w-full bg-[#121214] border border-[#2D2D2F] focus:border-[#4FC3F7] text-xs px-2.5 py-1.5 rounded text-white outline-none"
                  placeholder="Mastered in SpliceIt .siq at -14 LUFS standard"
                />
              </div>
            </div>
          )}

          {/* TAB 3: SECTIONS & CUE POINTS */}
          {activeTab === 'sections' && (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider">
                    Master Bus Sections &amp; DAW Cue Points
                  </div>
                  <div className="text-[11px] text-[#8E9299]">
                    These markers will be baked directly into the RIFF cue chunk and exported in the .cue sheet.
                  </div>
                </div>

                <button
                  onClick={handleAddSection}
                  className="flex items-center gap-1 bg-[#4FC3F7]/10 hover:bg-[#4FC3F7]/20 border border-[#4FC3F7]/30 text-[#4FC3F7] font-bold px-2.5 py-1 rounded text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Section</span>
                </button>
              </div>

              {masterSections.length === 0 ? (
                <div className="bg-[#121214] rounded-lg p-6 text-center border border-[#2D2D2F]">
                  <Bookmark className="w-8 h-8 text-[#4F4F51] mx-auto mb-2" />
                  <div className="text-xs font-semibold text-white">No Sections Defined</div>
                  <div className="text-[11px] text-[#8E9299] mt-1">
                    Click "Add Section" above or in the Master Bus timeline to define cue points.
                  </div>
                </div>
              ) : (
                <div className="bg-[#121214] rounded-lg border border-[#2D2D2F] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#161618] border-b border-[#2D2D2F] text-[9px] uppercase font-bold text-[#8E9299]">
                      <tr>
                        <th className="p-2 w-8">#</th>
                        <th className="p-2">Section Name</th>
                        <th className="p-2 w-24">Start (s)</th>
                        <th className="p-2 w-24">End (s)</th>
                        <th className="p-2 w-10 text-right">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D2D2F]">
                      {masterSections.map((sec, idx) => (
                        <tr key={sec.id} className="hover:bg-[#1A1A1C]">
                          <td className="p-2 font-mono text-[#8E9299]">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={sec.name}
                              onChange={(e) => handleUpdateSection(sec.id, { name: e.target.value })}
                              className="w-full bg-transparent font-bold text-white outline-none focus:bg-[#2D2D2F] px-1 rounded"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.1"
                              value={sec.startTime}
                              onChange={(e) => handleUpdateSection(sec.id, { startTime: parseFloat(e.target.value) || 0 })}
                              className="w-20 bg-transparent font-mono text-[#4FC3F7] outline-none focus:bg-[#2D2D2F] px-1 rounded"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.1"
                              value={sec.endTime}
                              onChange={(e) => handleUpdateSection(sec.id, { endTime: parseFloat(e.target.value) || 0 })}
                              className="w-20 bg-transparent font-mono text-[#8E9299] outline-none focus:bg-[#2D2D2F] px-1 rounded"
                            />
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => handleDeleteSection(sec.id)}
                              className="text-[#4F4F51] hover:text-[#FF4444] p-1 rounded cursor-pointer"
                              title="Delete Section"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Rendering Progress Bar */}
          {isRendering && (
            <div className="bg-[#121214] p-3 rounded-lg border border-[#4FC3F7]/30 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-[#4FC3F7] animate-spin" />
                  <span className="font-mono text-[#E0E0E0]">{statusText}</span>
                </div>
                <span className="font-mono font-bold text-[#4FC3F7]">{progress}%</span>
              </div>
              <div className="h-2 w-full bg-[#2D2D2F] rounded-full overflow-hidden">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-[#4FC3F7] to-[#00FFA3] transition-all duration-150"
                />
              </div>
            </div>
          )}

          {/* Export Completed Notification */}
          {exportResult && (
            <div className="bg-[#00FF00]/10 border border-[#00FF00]/30 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#00FF00] shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Master Mixdown Ready</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#00FF00]/20 text-[#00FF00] border border-[#00FF00]/40 font-bold uppercase">
                      {exportResult.format.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-[#00FF00]">
                    {exportResult.filename} ({(exportResult.blob.size / (1024 * 1024)).toFixed(2)} MB)
                  </div>
                </div>
              </div>
              <button
                onClick={() => setExportResult(null)}
                className="text-[11px] text-[#8E9299] hover:text-white underline cursor-pointer self-start sm:self-auto"
              >
                Configure Another Format
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="h-14 bg-[#121214] border-t border-[#2D2D2F] px-4 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-[#8E9299] hover:text-white hover:bg-[#2D2D2F] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {exportResult?.cueSheet && (
              <button
                onClick={triggerCueDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D2D2F] hover:bg-[#3D3D3F] text-white font-semibold text-xs rounded transition-colors cursor-pointer"
                title="Download standard .CUE sheet"
              >
                <FileText className="w-3.5 h-3.5 text-[#4FC3F7]" />
                <span>Download .CUE</span>
              </button>
            )}

            {exportResult ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExportResult(null)}
                  className="px-3 py-1.5 bg-[#2D2D2F] hover:bg-[#3D3D3F] text-[#8E9299] hover:text-white text-xs font-semibold rounded transition-colors cursor-pointer"
                >
                  Configure &amp; Re-Render
                </button>
                <button
                  onClick={triggerAudioDownload}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00FF00] hover:bg-[#00E500] text-black font-bold text-xs rounded transition-all shadow-[0_0_15px_rgba(0,255,0,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>DOWNLOAD MASTER ({exportResult.format.toUpperCase()})</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartRender}
                disabled={isRendering}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4FC3F7] hover:bg-[#29B6F6] disabled:opacity-50 text-black font-bold text-xs rounded transition-all shadow-[0_0_15px_rgba(79,195,247,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>{isRendering ? 'RENDERING...' : `RENDER MASTER (${format.toUpperCase()})`}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
