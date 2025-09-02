'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Column, User, Label } from '@/types/database';

interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: number;
  boardId: number;
  columns: Column[];
  boardMembers: User[];
  boardLabels: Label[];
  onCardCreated: (card: any) => void;
}

export function CreateCardDialog({
  open,
  onOpenChange,
  columnId,
  boardId,
  columns,
  boardMembers,
  boardLabels,
  onCardCreated,
}: CreateCardDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState(columnId.toString());
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Card title is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardId,
          columnId: parseInt(selectedColumnId),
          title: title.trim(),
          description: description.trim() || undefined,
          assigneeId: assigneeId || undefined,
          dueDate: dueDate?.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create card');
      }

      const newCard = await response.json();
      onCardCreated(newCard);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setSelectedColumnId(columnId.toString());
    setAssigneeId('');
    setDueDate(undefined);
    setError('');
    onOpenChange(false);
  };

  const selectedColumn = columns.find(col => col.id === parseInt(selectedColumnId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Card</DialogTitle>
          <DialogDescription>
            Add a new card to {selectedColumn?.title || 'the board'}
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
              disabled={isLoading}
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
              disabled={isLoading}
              rows={3}
            />
          </div>

          {/* Column */}
          <div className="space-y-2">
            <Label>Column</Label>
            <Select value={selectedColumnId} onValueChange={setSelectedColumnId} disabled={isLoading}>
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
            <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isLoading}>
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
                  disabled={isLoading}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
