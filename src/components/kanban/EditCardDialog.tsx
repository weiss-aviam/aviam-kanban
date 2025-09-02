'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Card, Column, User, Label } from '@/types/database';

interface EditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card | null;
  columns: Column[];
  boardMembers: User[];
  boardLabels: Label[];
  onCardUpdated: (card: Card) => void;
  onCardDeleted: (cardId: number) => void;
}

export function EditCardDialog({
  open,
  onOpenChange,
  card,
  columns,
  boardMembers,
  boardLabels,
  onCardUpdated,
  onCardDeleted,
}: EditCardDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // Initialize form with card data
  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setSelectedColumnId(card.columnId.toString());
      setAssigneeId(card.assigneeId || '');
      setDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
    }
  }, [card]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!card || !title.trim()) {
      setError('Card title is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          columnId: parseInt(selectedColumnId),
          assigneeId: assigneeId || null,
          dueDate: dueDate?.toISOString() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update card');
      }

      const updatedCard = await response.json();
      onCardUpdated(updatedCard);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!card) return;

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete card');
      }

      onCardDeleted(card.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete card');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setSelectedColumnId('');
    setAssigneeId('');
    setDueDate(undefined);
    setError('');
    onOpenChange(false);
  };

  const selectedColumn = columns.find(col => col.id === parseInt(selectedColumnId));

  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Card</DialogTitle>
          <DialogDescription>
            Update card details in {selectedColumn?.title || 'the board'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter card title"
              disabled={isLoading || isDeleting}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter card description (optional)"
              disabled={isLoading || isDeleting}
              rows={3}
            />
          </div>

          {/* Column */}
          <div className="space-y-2">
            <Label>Column</Label>
            <Select value={selectedColumnId} onValueChange={setSelectedColumnId} disabled={isLoading || isDeleting}>
              <SelectTrigger>
                <SelectValue placeholder="Select a column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id.toString()}>
                    {column.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isLoading || isDeleting}>
              <SelectTrigger>
                <SelectValue placeholder="Select an assignee (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No assignee</SelectItem>
                {boardMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dueDate && 'text-muted-foreground'
                  )}
                  disabled={isLoading || isDeleting}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, 'PPP') : 'Pick a date (optional)'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading || isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading || isDeleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isDeleting}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Card
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
