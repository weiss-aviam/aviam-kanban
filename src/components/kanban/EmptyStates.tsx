'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Columns, FileText, Filter } from 'lucide-react';

interface EmptyBoardProps {
  onCreateColumn: () => void;
}

export function EmptyBoard({ onCreateColumn }: EmptyBoardProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Columns className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No columns yet
          </h3>
          <p className="text-gray-600 mb-6 max-w-sm">
            Get started by creating your first column. You can organize your tasks into different stages like "To Do", "In Progress", and "Done".
          </p>
          <Button onClick={onCreateColumn}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Column
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface EmptyColumnProps {
  columnTitle: string;
  onCreateCard: () => void;
}

export function EmptyColumn({ columnTitle, onCreateCard }: EmptyColumnProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
        <FileText className="w-6 h-6 text-gray-400" />
      </div>
      <h4 className="font-medium text-gray-900 mb-2">
        No cards in {columnTitle}
      </h4>
      <p className="text-sm text-gray-600 mb-4 max-w-xs">
        Add your first card to get started with organizing your tasks.
      </p>
      <Button variant="outline" size="sm" onClick={onCreateCard}>
        <Plus className="w-4 h-4 mr-2" />
        Add Card
      </Button>
    </div>
  );
}

interface EmptyFilterResultsProps {
  onClearFilters: () => void;
  filterCount: number;
}

export function EmptyFilterResults({ onClearFilters, filterCount }: EmptyFilterResultsProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No cards match your filters
          </h3>
          <p className="text-gray-600 mb-6 max-w-sm">
            Try adjusting your filters to see more cards, or clear all filters to view the entire board.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClearFilters}>
              Clear {filterCount} filter{filterCount !== 1 ? 's' : ''}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface EmptySearchResultsProps {
  searchQuery: string;
  onClearSearch: () => void;
}

export function EmptySearchResults({ searchQuery, onClearSearch }: EmptySearchResultsProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No cards found
          </h3>
          <p className="text-gray-600 mb-6 max-w-sm">
            No cards match your search for "{searchQuery}". Try a different search term or browse all cards.
          </p>
          <Button variant="outline" onClick={onClearSearch}>
            Clear search
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

interface EmptyDashboardProps {
  onCreateBoard: () => void;
}

export function EmptyDashboard({ onCreateBoard }: EmptyDashboardProps) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Plus className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No boards yet</h3>
      <p className="text-gray-600 mb-6 max-w-sm mx-auto">
        Get started by creating your first Kanban board to organize your projects and tasks.
      </p>
      <Button onClick={onCreateBoard}>
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Board
      </Button>
    </div>
  );
}
