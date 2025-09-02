'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Calendar, MessageSquare, Tag, User, Clock, Edit3, Send } from 'lucide-react';
import { format } from 'date-fns';
import type { CardWithDetails, User as UserType, Label, Comment } from '@/types/database';

interface CardDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: CardWithDetails | null;
  onCardUpdated: (card: any) => void;
}

export function CardDetailsModal({
  open,
  onOpenChange,
  card,
  onCardUpdated,
}: CardDetailsModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Load comments when card changes
  useEffect(() => {
    if (card && open) {
      loadComments();
    }
  }, [card, open]);

  const loadComments = async () => {
    if (!card) return;

    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/comments?cardId=${card.id}`);
      if (response.ok) {
        const commentsData = await response.json();
        setComments(commentsData);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: card.id,
          body: newComment.trim(),
        }),
      });

      if (response.ok) {
        const newCommentData = await response.json();
        setComments(prev => [...prev, newCommentData]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (!card) return null;

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
  const isDueSoon = card.dueDate && 
    new Date(card.dueDate) > new Date() && 
    new Date(card.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold pr-8">
            {card.title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="details" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">
                Activity
                {comments.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {comments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="details" className="space-y-6 mt-0">
                {/* Description */}
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  {card.description ? (
                    <p className="text-gray-700 whitespace-pre-wrap">{card.description}</p>
                  ) : (
                    <p className="text-gray-500 italic">No description provided</p>
                  )}
                </div>

                <Separator />

                {/* Card Metadata */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Assignee */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Assignee
                    </h4>
                    {card.assignee ? (
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                            {(card.assignee.name || card.assignee.email).charAt(0).toUpperCase()}
                          </div>
                        </Avatar>
                        <span className="text-sm">{card.assignee.name || card.assignee.email}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">Unassigned</span>
                    )}
                  </div>

                  {/* Due Date */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Due Date
                    </h4>
                    {card.dueDate ? (
                      <div className={`text-sm ${
                        isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-700'
                      }`}>
                        {format(new Date(card.dueDate), 'PPP')}
                        {isOverdue && ' (Overdue)'}
                        {isDueSoon && ' (Due Soon)'}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">No due date</span>
                    )}
                  </div>
                </div>

                {/* Labels */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center">
                    <Tag className="w-4 h-4 mr-2" />
                    Labels
                  </h4>
                  {card.labels && card.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {card.labels.map((label) => (
                        <Badge
                          key={label.id}
                          variant="secondary"
                          style={{ backgroundColor: label.color + '20', color: label.color }}
                        >
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">No labels</span>
                  )}
                </div>

                {/* Created Date */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Created
                  </h4>
                  <span className="text-sm text-gray-700">
                    {format(new Date(card.createdAt), 'PPP p')}
                  </span>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-0">
                {/* Add Comment Form */}
                <form onSubmit={handleSubmitComment} className="space-y-3">
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    disabled={isSubmittingComment}
                  />
                  <Button 
                    type="submit" 
                    size="sm" 
                    disabled={!newComment.trim() || isSubmittingComment}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmittingComment ? 'Posting...' : 'Post Comment'}
                  </Button>
                </form>

                <Separator />

                {/* Comments List */}
                <div className="space-y-4">
                  {isLoadingComments ? (
                    <div className="text-center py-4 text-gray-500">Loading comments...</div>
                  ) : comments.length > 0 ? (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                            {(comment.author.name || comment.author.email).charAt(0).toUpperCase()}
                          </div>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.author.name || comment.author.email}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(comment.createdAt), 'MMM d, p')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {comment.body}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No comments yet</p>
                      <p className="text-xs">Be the first to add a comment!</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-0">
                <div className="text-center py-8 text-gray-500">
                  <p>Attachments feature coming soon</p>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
