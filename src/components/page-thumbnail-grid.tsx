"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageItem {
  id: string;
  originalIndex: number; // 0-based index in the source PDF
  thumbnail: string;
  rotation: number; // extra rotation in degrees, applied on top of source rotation
  selected: boolean;
}

interface PageThumbnailGridProps {
  items: PageItem[];
  onReorder?: (items: PageItem[]) => void;
  draggable?: boolean;
  selectable?: boolean;
  /** "keep" highlights selected pages as the ones being kept; "remove" highlights them as the ones being deleted. */
  selectionIntent?: "keep" | "remove";
  onToggleSelect?: (id: string) => void;
  rotatable?: boolean;
  onRotate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function PageThumbnailGrid({
  items,
  onReorder,
  draggable = false,
  selectable = false,
  selectionIntent = "keep",
  onToggleSelect,
  rotatable = false,
  onRotate,
  onDelete,
}: PageThumbnailGridProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  const grid = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <PageThumb
          key={item.id}
          item={item}
          draggable={draggable}
          selectable={selectable}
          selectionIntent={selectionIntent}
          onToggleSelect={onToggleSelect}
          rotatable={rotatable}
          onRotate={onRotate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );

  if (!draggable) return grid;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  );
}

function PageThumb({
  item,
  draggable,
  selectable,
  selectionIntent,
  onToggleSelect,
  rotatable,
  onRotate,
  onDelete,
}: {
  item: PageItem;
  draggable: boolean;
  selectable: boolean;
  selectionIntent: "keep" | "remove";
  onToggleSelect?: (id: string) => void;
  rotatable: boolean;
  onRotate?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: item.id,
    disabled: !draggable,
  });
  const style = draggable ? { transform: CSS.Transform.toString(transform), transition } : undefined;

  const isMarked = selectable && item.selected;
  const markColor =
    selectionIntent === "remove"
      ? "ring-2 ring-destructive"
      : "ring-2 ring-primary";

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card select-none",
        isMarked && markColor,
        selectionIntent === "remove" && isMarked && "opacity-60"
      )}
    >
      <div
        className="relative flex items-center justify-center bg-muted/40 p-2"
        onClick={() => selectable && onToggleSelect?.(item.id)}
        role={selectable ? "button" : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnail}
          alt={`Halaman ${item.originalIndex + 1}`}
          className="max-h-48 w-auto rounded shadow-sm transition-transform"
          style={{ transform: `rotate(${item.rotation}deg)` }}
          draggable={false}
        />

        {draggable && (
          <button
            {...attributes}
            {...listeners}
            className="absolute left-1.5 top-1.5 cursor-grab rounded bg-background/80 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Seret untuk urutkan ulang"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {selectable && (
          <div
            className={cn(
              "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background/90 transition-colors",
              isMarked
                ? selectionIntent === "remove"
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-primary bg-primary text-primary-foreground"
                : "border-border"
            )}
          >
            {isMarked && <Check className="h-3.5 w-3.5" />}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border bg-card px-2 py-1.5 text-xs text-muted-foreground">
        <span>Hal. {item.originalIndex + 1}</span>
        <div className="flex items-center gap-1">
          {rotatable && (
            <button
              onClick={() => onRotate?.(item.id)}
              className="rounded p-1 hover:bg-accent hover:text-accent-foreground"
              aria-label="Putar halaman"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(item.id)}
              className="rounded p-1 hover:bg-destructive hover:text-destructive-foreground"
              aria-label="Hapus halaman"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
