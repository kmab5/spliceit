import React, { useRef } from 'react';

interface TimelineRulerProps {
  totalDuration: number; // in seconds
  currentTime: number; // in seconds
  zoom: number; // pixels per second
  onScrubTime: (time: number) => void;
  isLooping: boolean;
  loopStart?: number;
  loopEnd?: number;
  onUpdateLoopRegion?: (region: { startTime: number; endTime: number }) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  totalDuration,
  currentTime,
  zoom,
  onScrubTime,
  isLooping,
  loopStart = 0,
  loopEnd = 8,
  onUpdateLoopRegion
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  // Must match ArrangementView's track-canvas width or the ruler ticks drift
  // out of alignment with the clips at low zoom levels.
  const widthPx = Math.max(800, totalDuration * zoom);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, clickX / zoom);
    onScrubTime(newTime);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX - rect.left;
      const scrubTime = Math.max(0, currentX / zoom);
      onScrubTime(scrubTime);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Loop boundary dragging. The loop window was previously hardcoded to 0-8s
  // in the transport clock and unreachable from the UI.
  const handleLoopEdgeDrag = (e: React.MouseEvent, edge: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateLoopRegion || !rulerRef.current) return;

    const rect = rulerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const t = Math.max(0, (moveEvent.clientX - rect.left) / zoom);
      if (edge === 'start') {
        onUpdateLoopRegion({ startTime: Math.min(t, loopEnd - 0.25), endTime: loopEnd });
      } else {
        onUpdateLoopRegion({ startTime: loopStart, endTime: Math.max(t, loopStart + 0.25) });
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Generate tick markers
  const tickIntervalSec = zoom > 100 ? 0.5 : zoom > 50 ? 1 : 2;
  const numTicks = Math.ceil(totalDuration / tickIntervalSec) + 2;
  const ticks = Array.from({ length: numTicks }, (_, i) => i * tickIntervalSec);

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      style={{ width: `${widthPx}px` }}
      className="h-7 bg-[#121214] border-b border-[#2D2D2F] relative select-none cursor-pointer overflow-hidden sticky top-0 z-20"
    >
      {/* Loop Region Highlight */}
      {isLooping && (
        <div
          style={{
            left: `${loopStart * zoom}px`,
            width: `${(loopEnd - loopStart) * zoom}px`
          }}
          className="absolute top-0 bottom-0 bg-[#F27D26]/10 border-l border-r border-[#F27D26]/40"
        >
          <div className="text-[8px] font-mono text-[#F27D26] px-1 bg-[#F27D26]/20 font-bold w-max pointer-events-none">
            LOOP REGION
          </div>

          {onUpdateLoopRegion && (
            <>
              <div
                onMouseDown={(e) => handleLoopEdgeDrag(e, 'start')}
                title="Drag loop start"
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[#F27D26]/70 z-20"
              />
              <div
                onMouseDown={(e) => handleLoopEdgeDrag(e, 'end')}
                title="Drag loop end"
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[#F27D26]/70 z-20"
              />
            </>
          )}
        </div>
      )}

      {/* Second & Beat Ticks */}
      {ticks.map((t) => {
        const leftPx = t * zoom;
        const isMajor = Number.isInteger(t);
        return (
          <div
            key={t}
            style={{ left: `${leftPx}px` }}
            className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
          >
            {isMajor && (
              <span className="text-[10px] font-mono text-[#4F4F51] pl-1 mb-1 font-medium select-none">
                {Math.floor(t / 60)}:{(t % 60).toString().padStart(2, '0')}
              </span>
            )}
            <div
              className={`w-px ${
                isMajor ? 'h-3 bg-[#3D3D3F]' : 'h-1.5 bg-[#252527]'
              }`}
            />
          </div>
        );
      })}

      {/* Bento Playhead Pip */}
      <div
        style={{ left: `${currentTime * zoom}px` }}
        className="absolute top-0 bottom-0 w-[1px] bg-[#FF4444] pointer-events-none z-30 flex flex-col items-center"
      >
        <div className="w-2.5 h-2.5 bg-[#FF4444] rounded-full -mt-0.5 shadow-[0_0_8px_#FF4444]" />
      </div>
    </div>
  );
};
