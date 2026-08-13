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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FileText, GripVertical, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

export interface FileEntry {
  id: string;
  file: File;
  previewUrl?: string; // set for images so users can visually confirm order
}

export function FileListReorder({
  items,
  onReorder,
  onRemove,
}: {
  items: FileEntry[];
  onReorder: (items: FileEntry[]) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <FileRow key={item.id} item={item} index={i} onRemove={onRemove} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function FileRow({
  item,
  index,
  onRemove,
}: {
  item: FileEntry;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-2.5",
        isDragging && "z-10 shadow-lg"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab rounded p-1.5 text-muted-foreground hover:bg-accent active:cursor-grabbing"
        aria-label="Seret untuk urutkan ulang"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
        {index + 1}
      </span>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="rounded p-1.5 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        aria-label="Hapus file"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
