"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Transformer, Image as KonvaImage } from "react-konva";
import { motion } from "framer-motion";
import { Desk, MapConfig } from "@/lib/types";

const MIN_SIZE = 40;

type DeskMapProps = {
  mode: "view" | "edit";
  map: MapConfig;
  desks: Desk[];
  onChange?: (desks: Desk[]) => void;
  snapEnabled?: boolean;
  gridSize?: number;
};

export function DeskMap({ mode, map, desks, onChange, snapEnabled = false, gridSize = 20 }: DeskMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isRightMousePanning, setIsRightMousePanning] = useState(false);
  const [scale, setScale] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") setIsPanning(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setIsPanning(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (event: MouseEvent) => event.preventDefault();
    el.addEventListener("contextmenu", handler);
    return () => el.removeEventListener("contextmenu", handler);
  }, []);

  useEffect(() => {
    if (!map.backgroundUrl) {
      setBackgroundImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBackgroundImage(img);
    img.onerror = () => setBackgroundImage(null);
    img.src = map.backgroundUrl;
  }, [map.backgroundUrl]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setStageSize({ width, height });
      const stage = stageRef.current;
      if (stage) {
        const fitScale = Math.min(width / map.width, height / map.height);
        stage.scale({ x: fitScale, y: fitScale });
        setScale(fitScale);
        const offsetX = (width - map.width * fitScale) / 2;
        const offsetY = (height - map.height * fitScale) / 2;
        stage.position({ x: offsetX, y: offsetY });
        stage.batchDraw();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [map.height, map.width]);

  useEffect(() => {
    if (!trRef.current || !selectedId) return;
    const stage = stageRef.current;
    const selectedNode = stage?.findOne(`#desk-${selectedId}`);
    if (selectedNode) {
      trRef.current.nodes([selectedNode]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, desks]);

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const scaleBy = 1.05;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    const direction = event.evt.deltaY > 0 ? 1 : -1;
    const newScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    stage.scale({ x: newScale, y: newScale });
    setScale(newScale);
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };
    stage.position(newPos);
    stage.batchDraw();
  };

  const updateDesk = (id: string, updates: Partial<Desk>) => {
    if (!onChange) return;
    const next = desks.map((desk) => (desk.id === id ? { ...desk, ...updates } : desk));
    onChange(next);
  };

  const snap = (value: number) => {
    if (!snapEnabled) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const stageDraggable = mode === "view" || isPanning || isRightMousePanning;

  const gridLines = useMemo(() => {
    const lines = [] as JSX.Element[];
    const spacing = gridSize;
    for (let x = 0; x <= map.width; x += spacing) {
      lines.push(
        <Rect key={`grid-v-${x}`} x={x} y={0} width={1} height={map.height} fill="rgba(120,120,140,0.12)" />
      );
    }
    for (let y = 0; y <= map.height; y += spacing) {
      lines.push(
        <Rect key={`grid-h-${y}`} x={0} y={y} width={map.width} height={1} fill="rgba(120,120,140,0.12)" />
      );
    }
    return lines;
  }, [gridSize, map.height, map.width]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative h-[calc(100vh-220px)] min-h-[660px] w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft"
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        draggable={stageDraggable}
        onWheel={handleWheel}
        onMouseDown={(event) => {
          if (mode === "edit" && event.evt.button === 2) {
            setIsRightMousePanning(true);
            return;
          }
          if (mode === "edit" && !isPanning) {
            const clickedOnEmpty = event.target === event.target.getStage();
            if (clickedOnEmpty) setSelectedId(null);
          }
        }}
        onMouseUp={() => setIsRightMousePanning(false)}
        onMouseLeave={() => setIsRightMousePanning(false)}
        className="grid-surface"
        style={{ background: "transparent" }}
      >
        <Layer>
          {backgroundImage && (
            <KonvaImage
              image={backgroundImage}
              x={0}
              y={0}
              width={map.width}
              height={map.height}
              listening={false}
            />
          )}
          {gridLines}
        </Layer>
        <Layer>
          {desks.map((desk) => (
            <Group key={desk.id}>
              <Rect
                id={`desk-${desk.id}`}
                x={desk.x}
                y={desk.y}
                width={desk.width}
                height={desk.height}
                cornerRadius={8}
                fill={desk.occupantFirstName ? "#2B6FE8" : "#0F172A"}
                opacity={mode === "edit" && selectedId === desk.id ? 0.95 : 0.9}
                shadowBlur={20}
                shadowColor="rgba(0,0,0,0.2)"
                draggable={mode === "edit" && !isPanning && !isRightMousePanning}
                onClick={() => mode === "edit" && setSelectedId(desk.id)}
                onTap={() => mode === "edit" && setSelectedId(desk.id)}
                onDragEnd={(event) => {
                  updateDesk(desk.id, {
                    x: snap(event.target.x()),
                    y: snap(event.target.y())
                  });
                }}
                onTransformEnd={(event) => {
                  const node = event.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  const width = Math.max(MIN_SIZE, node.width() * scaleX);
                  const height = Math.max(MIN_SIZE, node.height() * scaleY);
                  updateDesk(desk.id, {
                    x: snap(node.x()),
                    y: snap(node.y()),
                    width: snap(width),
                    height: snap(height)
                  });
                }}
              />
              <Text
                x={desk.x + 10}
                y={desk.y + 10}
                text={`${desk.number}`}
                fontSize={14}
                fontStyle="bold"
                fill="#E2E8F0"
                listening={false}
              />
              <Text
                x={desk.x + 10}
                y={desk.y + 32}
                text={desk.occupantFirstName ?? "Available"}
                fontSize={16}
                fill="#F8FAFC"
                listening={false}
              />
              <Text
                x={desk.x + 10}
                y={desk.y + 52}
                text={desk.occupantLastName ?? ""}
                fontSize={14}
                fill="#E2E8F0"
                listening={false}
              />
            </Group>
          ))}
        </Layer>
        {mode === "edit" && (
          <Layer>
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        )}
      </Stage>
      <div className="absolute bottom-4 right-4 rounded-full bg-background/90 px-4 py-2 text-xs text-muted-foreground shadow-soft">
        Zoom: {(scale * 100).toFixed(0)}% ? {stageDraggable ? "Pan" : "Select"}
      </div>
    </motion.div>
  );
}
