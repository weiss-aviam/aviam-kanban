'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Plus, Loader2 } from 'lucide-react';
import type { Column, User, Label as DatabaseLabel } from '../../types/database';

interface CreateCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: number;
  boardId: string;
  columns: Column[];
  boardMembers: User[];
  boardLabels: DatabaseLabel[];
  currentUser: User | undefined;
  onCardCreated: (card: any) => void;
}

export function CreateCardDialog({
  open,
  onOpenChange,
  columnId,
  boardId,
  columns,
  boardMembers,

  currentUser,
  onCardCreated,
}: CreateCardDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState(columnId.toString());
  const [assigneeId, setAssigneeId] = useState<string>(currentUser?.id || 'none');
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
          assigneeId: assigneeId === 'none' ? undefined : assigneeId,
          dueDate: dueDate?.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create card');
      }

      const { card } = await response.json();
      onCardCreated(card);
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
    setAssigneeId(currentUser?.id || 'none');
    setDueDate(undefined);
    setError('');
    onOpenChange(false);
  };

  const selectedColumn = columns.find(col => col.id === parseInt(selectedColumnId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Card
          </DialogTitle>
          <DialogDescription>
            Add a new card to {selectedColumn?.title || 'the selected column'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="card-title">Title</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter card title"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-description">Description (Optional)</Label>
            <Textarea
              id="card-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter card description"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-column">Column</Label>
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

          <div className="space-y-2">
            <Label htmlFor="card-assignee">Assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Select an assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No assignee</SelectItem>
                {currentUser && (
                  <SelectItem key={currentUser.id} value={currentUser.id}>
                    {currentUser.name || currentUser.email} (YOU)
                  </SelectItem>
                )}
                {boardMembers?.filter(member => member.id !== currentUser?.id)
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-due-date">Due Date (Optional)</Label>
            <Input
              id="card-due-date"
              type="date"
              value={dueDate ? dueDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value) : undefined)}
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Card
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
