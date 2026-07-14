"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

export interface QuizQuestionDraft {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  sort_order: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface QuizEditorProps {
  articleId: string;
  questions: QuizQuestionDraft[];
  onChange: (questions: QuizQuestionDraft[]) => void;
}

interface SortableQuizItemProps {
  item: QuizQuestionDraft;
  index: number;
  onUpdate: (id: string, updater: (item: QuizQuestionDraft) => QuizQuestionDraft) => void;
  onDelete: (id: string) => void;
}

function SortableQuizItem({ item, index, onUpdate, onDelete }: SortableQuizItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (item.isDeleted) return null;

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-background space-y-3">
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
            <span className="text-sm font-medium text-muted-foreground">Fråga {index + 1}</span>
            {item.isNew && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Ny</span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`quiz-question-${item.id}`} className="sr-only">
              Fråga
            </Label>
            <Textarea
              id={`quiz-question-${item.id}`}
              value={item.question}
              onChange={(e) =>
                onUpdate(item.id, (q) => ({ ...q, question: e.target.value }))
              }
              placeholder="Skriv frågan här..."
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">
              Svarsalternativ (markera det korrekta)
            </Label>
            <RadioGroup
              value={String(item.correct_index)}
              onValueChange={(value) =>
                onUpdate(item.id, (q) => ({ ...q, correct_index: parseInt(value, 10) }))
              }
              className="space-y-2"
            >
              {item.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <RadioGroupItem value={String(optionIndex)} id={`quiz-${item.id}-opt-${optionIndex}`} />
                  <Input
                    value={option}
                    onChange={(e) =>
                      onUpdate(item.id, (q) => {
                        const options = [...q.options];
                        options[optionIndex] = e.target.value;
                        return { ...q, options };
                      })
                    }
                    placeholder={`Alternativ ${optionIndex + 1}`}
                  />
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`quiz-explanation-${item.id}`} className="sr-only">
              Förklaring
            </Label>
            <Textarea
              id={`quiz-explanation-${item.id}`}
              value={item.explanation}
              onChange={(e) =>
                onUpdate(item.id, (q) => ({ ...q, explanation: e.target.value }))
              }
              placeholder="Kort förklaring till varför svaret är bäst..."
              rows={2}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(item.id)}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function QuizEditor({ articleId, questions, onChange }: QuizEditorProps) {
  const [generating, setGenerating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const visible = questions.filter((q) => !q.isDeleted);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = visible.findIndex((q) => q.id === active.id);
    const newIndex = visible.findIndex((q) => q.id === over.id);

    const reordered = arrayMove(visible, oldIndex, newIndex).map((q, index) => ({
      ...q,
      sort_order: index,
    }));

    const deleted = questions.filter((q) => q.isDeleted);
    onChange([...reordered, ...deleted]);
  };

  const handleUpdate = (id: string, updater: (item: QuizQuestionDraft) => QuizQuestionDraft) => {
    onChange(questions.map((q) => (q.id === id ? updater(q) : q)));
  };

  const handleDelete = (id: string) => {
    const item = questions.find((q) => q.id === id);
    if (item?.isNew) {
      onChange(questions.filter((q) => q.id !== id));
    } else {
      onChange(questions.map((q) => (q.id === id ? { ...q, isDeleted: true } : q)));
    }
  };

  const handleAdd = () => {
    const newQuestion: QuizQuestionDraft = {
      id: `new-${Date.now()}`,
      question: "",
      options: ["", "", "", ""],
      correct_index: 0,
      explanation: "",
      sort_order: visible.length,
      isNew: true,
    };
    onChange([...questions, newQuestion]);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Ingen aktiv session");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-quiz`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Kunde inte generera quiz");
      }

      const generated: QuizQuestionDraft[] = data.questions.map(
        (q: { question: string; options: string[]; correctIndex: number; explanation: string }, index: number) => ({
          id: `new-${Date.now()}-${index}`,
          question: q.question,
          options: q.options,
          correct_index: q.correctIndex,
          explanation: q.explanation,
          sort_order: index,
          isNew: true,
        })
      );

      // Replace the draft entirely - existing (saved) questions are marked
      // deleted so Spara removes them, matching what's shown on screen.
      const previouslySaved = questions.filter((q) => !q.isNew);
      onChange([...generated, ...previouslySaved.map((q) => ({ ...q, isDeleted: true }))]);
      toast.success("Quiz genererat - granska och spara");
    } catch (err) {
      console.error("Error generating quiz:", err);
      toast.error(err instanceof Error ? err.message : "Kunde inte generera quiz");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Quiz</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Frågor som visas efter artikeln. Sparas först när du klickar Spara.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generera med AI
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Lägg till fråga
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {visible.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Inga quizfrågor ännu. Generera med AI eller lägg till manuellt.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visible.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {visible.map((item, index) => (
                  <SortableQuizItem
                    key={item.id}
                    item={item}
                    index={index}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
