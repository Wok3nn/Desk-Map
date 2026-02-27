"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Group, Transformer, Image as KonvaImage, Circle, Line } from "react-konva";
import { motion } from "framer-motion";
import { Desk, MapConfig } from "@/lib/types";

const MIN_SIZE = 1;

type DeskMapProps = {
  mode: "view" | "edit";
  map: MapConfig;
  desks: Desk[];
  onChange?: (desks: Desk[]) => void;
  snapEnabled?: boolean;
  gridSize?: number;
  showGrid?: boolean;
};

export function DeskMap({
  mode,
  map,
  desks,
  onChange,
  snapEnabled = false,
  gridSize = 10,
  showGrid = mode === "edit"
}: DeskMapProps) {
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
      if (event.code === "ControlLeft" || event.code === "ControlRight") setIsPanning(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ControlLeft" || event.code === "ControlRight") setIsPanning(false);
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
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
    stage.batchDraw();
  };

  const updateDesk = (id: string, updates: Partial<Desk>) => {
    if (!onChange) return;
    onChange(desks.map((desk) => (desk.id === id ? { ...desk, ...updates } : desk)));
  };

  const snap = (value: number) => {
    if (!snapEnabled) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const stageDraggable = mode === "view" || isPanning || isRightMousePanning;
  const deskColor = map.deskColor || "#8764B8";
  const deskShape = map.deskShape || "rounded";
  const labelPosition = map.labelPosition || "inside";
  const showName = map.showName ?? true;
  const showNumber = map.showNumber ?? true;
  const baseTextSize = Math.max(1, Math.min(72, map.deskTextSize ?? 14));
  const numberSize = Math.max(1, baseTextSize - 1);
  const firstNameSize = Math.max(1, baseTextSize + 1);
  const lastNameSize = Math.max(1, baseTextSize);

  const gridLines = useMemo(() => {
    const lines = [] as JSX.Element[];
    const spacing = Math.max(1, gridSize);
    for (let x = 0; x <= map.width; x += spacing) {
      lines.push(<Rect key={`grid-v-${x}`} x={x} y={0} width={1} height={map.height} fill="rgba(120,120,140,0.12)" listening={false} />);
    }
    for (let y = 0; y <= map.height; y += spacing) {
      lines.push(<Rect key={`grid-h-${y}`} x={0} y={y} width={map.width} height={1} fill="rgba(120,120,140,0.12)" listening={false} />);
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
            const clickedDesk = !!event.target?.findAncestor?.(".desk-group");
            if (!clickedDesk) setSelectedId(null);
          }
        }}
        onMouseUp={() => setIsRightMousePanning(false)}
        onMouseLeave={() => setIsRightMousePanning(false)}
        className="grid-surface"
        style={{ background: "transparent" }}
      >
        <Layer>
          {backgroundImage && <KonvaImage image={backgroundImage} x={0} y={0} width={map.width} height={map.height} listening={false} />}
          {showGrid ? gridLines : null}
        </Layer>
        <Layer>
          {desks.map((desk) => (
            <Group key={desk.id} name="desk-group">
              {deskShape === "circle" && (
                <Circle
                  x={desk.x + desk.width / 2}
                  y={desk.y + desk.height / 2}
                  radius={Math.max(MIN_SIZE / 2, Math.min(desk.width, desk.height) / 2)}
                  fill={deskColor}
                  opacity={mode === "edit" && selectedId === desk.id ? 0.95 : 0.9}
                  shadowBlur={20}
                  shadowColor="rgba(0,0,0,0.2)"
                  listening={false}
                />
              )}
              {deskShape === "diamond" && (
                <Line
                  points={[desk.x + desk.width / 2, desk.y, desk.x + desk.width, desk.y + desk.height / 2, desk.x + desk.width / 2, desk.y + desk.height, desk.x, desk.y + desk.height / 2]}
                  closed
                  fill={deskColor}
                  opacity={mode === "edit" && selectedId === desk.id ? 0.95 : 0.9}
                  shadowBlur={20}
                  shadowColor="rgba(0,0,0,0.2)"
                  listening={false}
                />
              )}
              <Rect
                id={`desk-${desk.id}`}
                name="desk-shape"
                x={desk.x}
                y={desk.y}
                width={desk.width}
                height={desk.height}
                cornerRadius={deskShape === "rectangle" ? 0 : deskShape === "capsule" ? 999 : 8}
                fill={
                  deskShape === "rectangle" || deskShape === "rounded" || deskShape === "capsule"
                    ? deskColor
                    : "rgba(15,23,42,0.001)"
                }
                opacity={deskShape === "rectangle" || deskShape === "rounded" || deskShape === "capsule" ? (mode === "edit" && selectedId === desk.id ? 0.95 : 0.9) : 1}
                shadowBlur={deskShape === "rectangle" || deskShape === "rounded" || deskShape === "capsule" ? 20 : 0}
                shadowColor={deskShape === "rectangle" || deskShape === "rounded" || deskShape === "capsule" ? "rgba(0,0,0,0.2)" : "transparent"}
                draggable={mode === "edit" && !isPanning && !isRightMousePanning}
                onClick={() => mode === "edit" && setSelectedId(desk.id)}
                onTap={() => mode === "edit" && setSelectedId(desk.id)}
                onDragEnd={(event) => updateDesk(desk.id, { x: snap(event.target.x()), y: snap(event.target.y()) })}
                onTransformEnd={(event) => {
                  const node = event.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  updateDesk(desk.id, {
                    x: snap(node.x()),
                    y: snap(node.y()),
                    width: snap(Math.max(MIN_SIZE, node.width() * scaleX)),
                    height: snap(Math.max(MIN_SIZE, node.height() * scaleY))
                  });
                }}
              />
              {(() => {
                const effectivePosition =
                  labelPosition === "inside" && (desk.width < 80 || desk.height < 52) ? "top-center" : labelPosition;
                const labelWidth = 110;
                const leftX = desk.x - labelWidth - 8;
                const centerX = desk.x + desk.width / 2 - labelWidth / 2;
                const rightX = desk.x + desk.width + 8;
                const topY = desk.y - 48;
                const middleY = desk.y + Math.max(2, desk.height / 2 - 16);
                const bottomY = desk.y + desk.height + 8;
                const insideX = desk.x + 6;
                const insideY = desk.y + 8;
                const baseX =
                  effectivePosition === "inside"
                    ? insideX
                    : effectivePosition === "center"
                      ? centerX
                      : effectivePosition === "middle"
                        ? centerX
                        : effectivePosition === "top-left" || effectivePosition === "middle-left" || effectivePosition === "bottom-left"
                    ? leftX
                    : effectivePosition === "top-right" || effectivePosition === "middle-right" || effectivePosition === "bottom-right"
                      ? rightX
                      : centerX;
                const baseY =
                  effectivePosition === "inside"
                    ? insideY
                    : effectivePosition === "center"
                      ? middleY
                      : effectivePosition === "middle"
                        ? middleY
                        : effectivePosition === "top-left" || effectivePosition === "top-center" || effectivePosition === "top-right"
                    ? topY
                    : effectivePosition === "middle-left" || effectivePosition === "middle-right"
                      ? middleY
                      : effectivePosition === "bottom-left" || effectivePosition === "bottom-center" || effectivePosition === "bottom-right"
                        ? bottomY
                        : insideY;
                const textColor = map.deskTextColor || "#334155";
                return (
                  <>
                    {showNumber && <Text x={baseX} y={baseY} width={labelWidth} align="center" text={`${desk.number}`} fontSize={numberSize} fontStyle="bold" fill={textColor} listening={false} />}
                    {showName && (
                      <>
                        <Text
                          x={baseX}
                          width={labelWidth}
                          align="center"
                          y={baseY + (showNumber ? numberSize + 6 : 0)}
                          text={desk.occupantFirstName ?? "Available"}
                          fontSize={firstNameSize}
                          fill={textColor}
                          listening={false}
                        />
                        <Text
                          x={baseX}
                          width={labelWidth}
                          align="center"
                          y={baseY + (showNumber ? numberSize + firstNameSize + 8 : firstNameSize + 4)}
                          text={desk.occupantLastName ?? ""}
                          fontSize={lastNameSize}
                          fill={textColor}
                          listening={false}
                        />
                      </>
                    )}
                  </>
                );
              })()}
            </Group>
          ))}
        </Layer>
        {mode === "edit" && (
          <Layer>
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < MIN_SIZE || newBox.height < MIN_SIZE) return oldBox;
                return newBox;
              }}
            />
          </Layer>
        )}
      </Stage>
      <div className="absolute bottom-4 right-4 rounded-full bg-background/90 px-4 py-2 text-xs text-muted-foreground shadow-soft">
        Zoom: {(scale * 100).toFixed(0)}% | {stageDraggable ? "Pan" : "Select"}
      </div>
    </motion.div>
  );
}
