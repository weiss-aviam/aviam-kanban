'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  MoreHorizontal,
  Edit,
  Archive,
  Trash2,
  Users,
  Calendar,
  Kanban
} from 'lucide-react';
import { getRoleBadgeClasses, getRoleLabel } from '../../lib/role-colors';

interface BoardCardProps {
  board: {
    id: number;
    name: string;
    isArchived: boolean;
    createdAt: string;
    ownerId: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
  };
  onEdit?: (board: any) => void;
  onArchive?: (board: any) => void;
  onDelete?: (board: any) => void;
}

export function BoardCard({ board, onEdit, onArchive, onDelete }: BoardCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };



  const canEdit = board.role === 'owner' || board.role === 'admin';
  const canDelete = board.role === 'owner';

  return (
    <Card className={`hover:shadow-md transition-shadow ${board.isArchived ? 'opacity-60' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <Kanban className="h-4 w-4 text-blue-600" />
          <CardTitle className="text-base font-medium">
            <Link 
              href={`/boards/${board.id}`}
              className="hover:text-blue-600 transition-colors"
            >
              {board.name}
            </Link>
          </CardTitle>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={getRoleBadgeClasses(board.role)}>
            {getRoleLabel(board.role)}
          </Badge>
          {(board.role === 'owner' || board.role === 'admin') && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              <Users className="w-3 h-3 mr-1" />
              Admin
            </Badge>
          )}
          {board.isArchived && (
            <Badge variant="secondary">Archived</Badge>
          )}
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => onEdit?.(board)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Board
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onArchive?.(board)}>
                      <Archive className="mr-2 h-4 w-4" />
                      {board.isArchived ? 'Unarchive' : 'Archive'}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete?.(board)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Board
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Users className="mr-1 h-3 w-3" />
              <span>Team</span>
            </div>
            <div className="flex items-center">
              <Calendar className="mr-1 h-3 w-3" />
              <span>Created {formatDate(board.createdAt)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
