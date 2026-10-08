"use client";

import { useEffect, useRef, useState } from "react";
import { Stage } from "konva/lib/Stage";
import { Layer } from "konva/lib/Layer";
import { Group } from "konva/lib/Group";
import { Rect } from "konva/lib/shapes/Rect";
import { Ellipse } from "konva/lib/shapes/Ellipse";
import { Text } from "konva/lib/shapes/Text";
import { Image as CanvasImage } from "konva/lib/shapes/Image";
import { Transformer } from "konva/lib/shapes/Transformer";
import type { TableGeometry, TablePlan } from "@/src/lib/table-plan-types";
import {
  clampPosition,
  geometryFits,
  normalizeRotation,
  roundCoordinate,
} from "@/src/lib/table-plan-geometry";

type Props = {
  plan: TablePlan;
  selectedId: string | null;
  imageUrl: string | null;
  onSelect: (id: string | null) => void;
  onGeometry: (id: string, geometry: TableGeometry) => void;
  onError: (message: string) => void;
  disabled: boolean;
};

export function PlanCanvas(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const nodes = useRef(new Map<string, Group>());
  const transformRef = useRef<Transformer | null>(null);
  const current = useRef(props);
  const [width, setWidth] = useState(1);
  useEffect(() => {
    current.current = props;
  });
  useEffect(() => {
    const element = container.current!;
    const initialWidth = Math.max(1, element.clientWidth);
    const stage = new Stage({
      container: element,
      width: initialWidth,
      height: initialWidth / current.current.plan.background.aspectRatio,
    });
    stageRef.current = stage;
    setWidth(initialWidth);
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(1, entry.contentRect.width)),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      stage.destroy();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current!;
    const height = width / props.plan.background.aspectRatio;
    stage.size({ width, height });
    stage.destroyChildren();
    nodes.current.clear();
    const layer = new Layer();
    stage.add(layer);
    const background = new Rect({ width, height, fill: "#ffffff", listening: false });
    layer.add(background);
    let cancelled = false;
    const bg = props.plan.background;
    if (props.imageUrl) {
      const image = new window.Image();
      image.onload = () => {
        if (cancelled) return;
        const node = new CanvasImage({
          image,
          x: width * bg.x + (width * (1 - bg.scale)) / 2,
          y: height * bg.y + (height * (1 - bg.scale)) / 2,
          width: width * bg.scale,
          height: height * bg.scale,
          opacity: bg.opacity,
          listening: false,
        });
        layer.add(node);
        node.zIndex(1);
        layer.draw();
      };
      image.onerror = () => {
        if (!cancelled) current.current.onError("Der Grundriss konnte nicht geladen werden.");
      };
      image.src = props.imageUrl;
    }
    const tr = new Transformer({
      rotateEnabled: true,
      flipEnabled: false,
      centeredScaling: false,
      anchorSize: 12,
      borderStroke: "#234235",
      anchorStroke: "#234235",
      anchorFill: "#ffffff",
      padding: 4,
      boundBoxFunc: (oldBox, newBox) => (newBox.width < 12 || newBox.height < 12 ? oldBox : newBox),
    });
    transformRef.current = tr;
    for (const table of props.plan.tables.filter((t) => !t.archived)) {
      const g = table.layout;
      const w = g.width * width;
      const h = g.height * height;
      const group = new Group({
        x: g.x * width,
        y: g.y * height,
        rotation: g.rotation,
        draggable: !props.disabled,
      });
      const fill = table.isActive ? "#e4eddf" : "#f2f2ef";
      const shape =
        g.shape === "round"
          ? new Ellipse({
              radiusX: w / 2,
              radiusY: h / 2,
              fill,
              stroke: "#52765f",
              strokeWidth: 1.5,
            })
          : new Rect({
              x: -w / 2,
              y: -h / 2,
              width: w,
              height: h,
              cornerRadius: 5,
              fill,
              stroke: "#52765f",
              strokeWidth: 1.5,
            });
      group.add(shape);
      group.add(
        new Text({
          x: -w / 2 + 2,
          y: -h / 2 + 2,
          width: Math.max(1, w - 4),
          height: Math.max(1, h - 4),
          text: `${table.name}\n${table.minGuests}–${table.maxGuests}${table.isWheelchairAccessible ? " ♿" : ""}`,
          fontFamily: "system-ui, sans-serif",
          fontSize: Math.max(8, Math.min(14, w / 6, h / 4)),
          align: "center",
          verticalAlign: "middle",
          wrap: "none",
          ellipsis: true,
          fill: "#172018",
          listening: false,
        }),
      );
      group.dragBoundFunc((position) => {
        const adjusted = clampPosition(
          { ...g, x: position.x / width, y: position.y / height },
          bg.aspectRatio,
        );
        return { x: adjusted.x * width, y: adjusted.y * height };
      });
      group.on("mousedown touchstart", () => {
        if (!current.current.disabled) current.current.onSelect(table.id);
      });
      group.on("dragend transformend", () => {
        const next = {
          ...g,
          x: roundCoordinate(group.x() / width),
          y: roundCoordinate(group.y() / height),
          width: roundCoordinate(g.width * Math.abs(group.scaleX())),
          height: roundCoordinate(g.height * Math.abs(group.scaleY())),
          rotation: normalizeRotation(group.rotation()),
        };
        if (geometryFits(next, bg.aspectRatio) && next.width >= 0.0001 && next.height >= 0.0001)
          current.current.onGeometry(table.id, next);
        else {
          group.setAttrs({
            x: g.x * width,
            y: g.y * height,
            rotation: g.rotation,
            scaleX: 1,
            scaleY: 1,
          });
          tr.forceUpdate();
          current.current.onError("Diese Größe oder Drehung passt nicht in die Planfläche.");
          layer.batchDraw();
        }
      });
      nodes.current.set(table.id, group);
      layer.add(group);
    }
    layer.add(tr);
    const selectedId = current.current.selectedId;
    const selected = selectedId ? nodes.current.get(selectedId) : undefined;
    tr.nodes(selected && !props.disabled ? [selected] : []);
    tr.keepRatio(props.plan.tables.find((t) => t.id === selectedId)?.layout.shape !== "rectangle");
    stage.off("click tap");
    stage.on("click tap", (e) => {
      if (e.target === stage) current.current.onSelect(null);
    });
    layer.draw();
    return () => {
      cancelled = true;
    };
  }, [props.plan, props.imageUrl, props.disabled, width]);

  useEffect(() => {
    const selected = props.selectedId ? nodes.current.get(props.selectedId) : undefined;
    transformRef.current?.nodes(selected && !props.disabled ? [selected] : []);
    transformRef.current?.keepRatio(
      props.plan.tables.find((t) => t.id === props.selectedId)?.layout.shape !== "rectangle",
    );
  }, [props.selectedId, props.disabled, props.plan]);

  return (
    <div
      ref={container}
      className="table-plan-surface table-plan-canvas"
      style={{ aspectRatio: props.plan.background.aspectRatio }}
      tabIndex={0}
      aria-label="Tischplan bearbeiten"
      onKeyDown={(event) => {
        if (
          props.disabled ||
          !props.selectedId ||
          !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
        )
          return;
        const table = props.plan.tables.find((t) => t.id === props.selectedId)!;
        event.preventDefault();
        const delta = event.shiftKey ? 0.02 : 0.005;
        props.onGeometry(
          table.id,
          clampPosition(
            {
              ...table.layout,
              x:
                table.layout.x +
                (event.key === "ArrowLeft" ? -delta : event.key === "ArrowRight" ? delta : 0),
              y:
                table.layout.y +
                (event.key === "ArrowUp" ? -delta : event.key === "ArrowDown" ? delta : 0),
            },
            props.plan.background.aspectRatio,
          ),
        );
      }}
    />
  );
}
