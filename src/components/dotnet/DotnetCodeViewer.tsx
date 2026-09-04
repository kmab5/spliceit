import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Archive, Terminal } from 'lucide-react';
import JSZip from 'jszip';
import { DOTNET_FILES, DotnetFileEntry } from '../../data/dotnetSourceCode';

export const DotnetCodeViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<DotnetFileEntry>(DOTNET_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([selectedFile.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFullZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('SpliceIt-Dotnet9-Avalonia');

      DOTNET_FILES.forEach((file) => {
        folder?.file(file.path, file.code);
      });

      const readme = `# SpliceIt - Cross-Platform Audio Workspace & Mastering Studio
Generated with C#, .NET 9, Avalonia UI 11+, and CommunityToolkit.Mvvm

## Architecture Highlights
- **UI:** Avalonia UI (v11+) FluentTheme with high-contrast dark mode.
- **MVVM:** \`CommunityToolkit.Mvvm\` code generators (\`[ObservableProperty]\`, \`[RelayCommand]\`).
- **DSP Engine:** Managed sample-accurate BiQuad filter pipeline (Direct Form II Transposed):
  - 12 kHz Harsh High-Shelf cut
  - 200–400 Hz Mud-Scoop Peaking filter
  - Multiband 3-band Dynamics
  - Mid/Side Stereo Width
  - True-Peak Brickwall Limiter with -14.0 LUFS target metering
- **Metadata Management:** \`TagLibSharp\` ID3v1, ID3v2, Vorbis, and MP4 tag editor with cover art embedding.
- **Project Persistence:** System.Text.Json serialized \`.siq\` (Splice It Queue) project structure.

## Quick Start
\`\`\`bash
# Restore packages & run on macOS, Windows, or Linux
dotnet restore
dotnet build
dotnet run
\`\`\`
`;
      folder?.file('README.md', readme);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SpliceIt-DotNet9-Avalonia-Solution.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0F0F10] text-[#E0E0E0] select-none p-3 gap-2">
      {/* Bento Header Bar */}
      <div className="h-10 bg-[#1A1A1C] border border-[#2D2D2F] rounded-lg px-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#4FC3F7]" />
          <span className="text-xs font-bold text-white tracking-wide">
            .NET 9 + AVALONIA 11+ ARCHITECTURE SUITE
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#4FC3F7]/10 text-[#4FC3F7] border border-[#4FC3F7]/30">
            C# 13 / net9.0
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#121214] hover:bg-[#2D2D2F] text-[#8E9299] hover:text-white border border-[#2D2D2F] rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#00FF00]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy File'}</span>
          </button>

          <button
            onClick={handleDownloadSingle}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#121214] hover:bg-[#2D2D2F] text-[#8E9299] hover:text-white border border-[#2D2D2F] rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#4FC3F7]" />
            <span>Download {selectedFile.filename}</span>
          </button>

          <button
            onClick={handleDownloadFullZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 px-3.5 py-1 bg-[#4FC3F7] hover:bg-[#29B6F6] text-[#0F0F10] rounded text-xs font-bold shadow-[0_0_12px_rgba(79,195,247,0.3)] transition-all cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isZipping ? 'Archiving...' : 'Download Solution (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* Main Code Explorer: Left File Tree, Right Syntax Viewer in Bento cards */}
      <div className="flex-1 flex overflow-hidden gap-2">
        {/* Left File Tree */}
        <div className="w-64 bg-[#1A1A1C] border border-[#2D2D2F] rounded-xl overflow-y-auto p-2">
          <div className="text-[10px] uppercase font-bold text-[#8E9299] px-2 py-1 tracking-wider">
            SOLUTION DELIVERABLES ({DOTNET_FILES.length})
          </div>

          <div className="space-y-0.5 mt-1">
            {DOTNET_FILES.map((file) => {
              const isSelected = file.path === selectedFile.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#4FC3F7]/15 text-[#4FC3F7] font-semibold border border-[#4FC3F7]/40'
                      : 'text-[#8E9299] hover:bg-[#121214] hover:text-white'
                  }`}
                >
                  <FileCode
                    className={`w-3.5 h-3.5 shrink-0 ${
                      file.language === 'xml'
                        ? 'text-[#4FC3F7]'
                        : 'text-[#F27D26]'
                    }`}
                  />
                  <span className="truncate font-mono text-[11px]">{file.path}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Code Content */}
        <div className="flex-1 flex flex-col bg-[#1A1A1C] border border-[#2D2D2F] rounded-xl overflow-hidden">
          {/* File Header Details */}
          <div className="h-8 bg-[#121214] border-b border-[#2D2D2F] px-3 flex items-center justify-between text-xs text-[#8E9299]">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-white font-bold">{selectedFile.filename}</span>
              <span className="text-[#8E9299] text-[11px]">— {selectedFile.description}</span>
            </div>
            <span className="font-mono text-[10px] text-[#4F4F51]">
              {selectedFile.code.split('\n').length} lines
            </span>
          </div>

          {/* Code Viewer with Line Numbers */}
          <div className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed select-text text-[#E0E0E0] bg-[#121214]/50">
            <pre className="tab-4">
              {selectedFile.code.split('\n').map((line, idx) => (
                <div key={idx} className="flex hover:bg-white/[0.03]">
                  <span className="w-10 text-right pr-4 text-[#4F4F51] select-none text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="flex-1">{line || ' '}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
