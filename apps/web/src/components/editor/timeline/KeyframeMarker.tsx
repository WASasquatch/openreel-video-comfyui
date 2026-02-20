import React, { useCallback, useState, useEffect, useRef } from "react";
import type { Keyframe } from "@openreel/core";

interface KeyframeMarkerProps {
  keyframe: Keyframe;
  xPosition: number;
  color: string;
  label?: string;
  isSelected: boolean;
  onSelect: (addToSelection: boolean) => void;
  onMove: (absoluteX: number) => void;
  onDelete: () => void;
}

export const KeyframeMarker: React.FC<KeyframeMarkerProps> = ({
  keyframe,
  xPosition,
  color,
  label,
  isSelected,
  onSelect,
  onMove,
  onDelete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartXRef = useRef(0);
  const originalXRef = useRef(0);
  const markerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const addToSelection = e.shiftKey || e.metaKey || e.ctrlKey;
      onSelect(addToSelection);

      setIsDragging(true);
      dragStartXRef.current = e.clientX;
      originalXRef.current = xPosition;
    },
    [onSelect, xPosition]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const totalDeltaX = e.clientX - dragStartXRef.current;
      if (Math.abs(totalDeltaX) > 2) {
        const targetX = Math.max(0, originalXRef.current + totalDeltaX);
        onMove(targetX);
      }
    },
    [isDragging, onMove]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onDelete();
    },
    [onDelete]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  return (
    <div
      ref={markerRef}
      className={`absolute top-1/2 cursor-pointer z-10 ${
        isDragging ? "z-50" : ""
      }`}
      style={{
        left: xPosition,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`w-2.5 h-2.5 rotate-45 rounded-[1px] transition-all ${
          isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""
        } ${isDragging ? "scale-125" : "hover:scale-110"}`}
        style={{
          backgroundColor: color,
          boxShadow: isSelected ? `0 0 8px ${color}` : `0 0 2px rgba(0,0,0,0.5)`,
        }}
      />

      {(isHovered || isDragging) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none"
          style={{ bottom: '100%', marginBottom: 4 }}
        >
          <span className="text-[9px] text-white bg-black/80 px-1.5 py-0.5 rounded">
            {label || keyframe.property} {keyframe.time.toFixed(2)}s
          </span>
        </div>
      )}
    </div>
  );
};

export default KeyframeMarker;
