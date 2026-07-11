"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface FAQEditorProps {
  faqs: FAQ[];
  onChange: (faqs: FAQ[]) => void;
}

interface SortableFAQItemProps {
  faq: FAQ;
  index: number;
  onUpdate: (id: string, field: "question" | "answer", value: string) => void;
  onDelete: (id: string) => void;
}

function SortableFAQItem({ faq, index, onUpdate, onDelete }: SortableFAQItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (faq.isDeleted) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border rounded-lg p-4 bg-background space-y-3"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="cursor-grab p-1 text-muted-foreground hover:text-foreground mt-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Fråga {index + 1}
            </span>
            {faq.isNew && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                Ny
              </span>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`question-${faq.id}`} className="sr-only">
              Fråga
            </Label>
            <Input
              id={`question-${faq.id}`}
              value={faq.question}
              onChange={(e) => onUpdate(faq.id, "question", e.target.value)}
              placeholder="Skriv frågan här..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`answer-${faq.id}`} className="sr-only">
              Svar
            </Label>
            <Textarea
              id={`answer-${faq.id}`}
              value={faq.answer}
              onChange={(e) => onUpdate(faq.id, "answer", e.target.value)}
              placeholder="Skriv svaret här..."
              rows={3}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(faq.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function FAQEditor({ faqs, onChange }: FAQEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const visibleFaqs = faqs.filter((f) => !f.isDeleted);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = visibleFaqs.findIndex((f) => f.id === active.id);
    const newIndex = visibleFaqs.findIndex((f) => f.id === over.id);

    const reorderedVisible = arrayMove(visibleFaqs, oldIndex, newIndex);
    
    // Update sort_order for visible items
    const updatedVisible = reorderedVisible.map((faq, index) => ({
      ...faq,
      sort_order: index,
    }));

    // Combine with deleted items
    const deletedFaqs = faqs.filter((f) => f.isDeleted);
    onChange([...updatedVisible, ...deletedFaqs]);
  };

  const handleUpdate = (id: string, field: "question" | "answer", value: string) => {
    onChange(
      faqs.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleDelete = (id: string) => {
    const faq = faqs.find((f) => f.id === id);
    if (faq?.isNew) {
      // Remove new items completely
      onChange(faqs.filter((f) => f.id !== id));
    } else {
      // Mark existing items as deleted
      onChange(faqs.map((f) => (f.id === id ? { ...f, isDeleted: true } : f)));
    }
  };

  const handleAdd = () => {
    const newFaq: FAQ = {
      id: `new-${Date.now()}`,
      question: "",
      answer: "",
      sort_order: visibleFaqs.length,
      isNew: true,
    };
    onChange([...faqs, newFaq]);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Vanliga frågor (FAQ)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Lägg till frågor och svar för att förbättra synligheten i Google
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Lägg till fråga
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleFaqs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Inga frågor ännu. Klicka på "Lägg till fråga" för att börja.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleFaqs.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {visibleFaqs.map((faq, index) => (
                  <SortableFAQItem
                    key={faq.id}
                    faq={faq}
                    index={index}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {visibleFaqs.length > 0 && visibleFaqs.length < 3 && (
          <p className="text-sm text-amber-600">
            Minst 3 frågor rekommenderas för bästa SEO-effekt
          </p>
        )}
      </CardContent>
    </Card>
  );
}