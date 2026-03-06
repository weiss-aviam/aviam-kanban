"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Columns, FileText, Filter } from "lucide-react";
import { t } from "@/lib/i18n";

export function EmptyBoard() {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Columns className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("emptyStates.noColumnsTitle")}
          </h3>
          <p className="text-gray-600 mb-6 max-w-sm">
            {t("emptyStates.noColumnsDescription")}
          </p>
          <p className="text-sm text-gray-500">
            {t("emptyStates.noColumnsHint")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface EmptyColumnProps {
  columnTitle: string;
  onCreateCard?: (() => void) | undefined;
}

export function EmptyColumn({ columnTitle, onCreateCard }: EmptyColumnProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
        <FileText className="w-6 h-6 text-gray-400" />
      </div>
      <h4 className="font-medium text-gray-900 mb-2">
        {t("emptyStates.noCardsTitle", { columnTitle })}
      </h4>
      <p className="text-sm text-gray-600 mb-4 max-w-xs">
        {t("emptyStates.noCardsDescription")}
      </p>
      {onCreateCard && (
        <Button variant="outline" size="sm" onClick={onCreateCard}>
          <Plus className="w-4 h-4 mr-2" />
          {t("emptyStates.noCardsButton")}
        </Button>
      )}
    </div>
  );
}

interface EmptyFilterResultsProps {
  onClearFilters: () => void;
  filterCount: number;
}

export function EmptyFilterResults({
  onClearFilters,
  filterCount,
}: EmptyFilterResultsProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("emptyStates.noFilterMatchTitle")}
          </h3>
          <p className="text-gray-600 mb-6 max-w-sm">
            {t("emptyStates.noFilterMatchDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={onClearFilters}>
              {t("emptyStates.clearFilters", { count: filterCount })}
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

export function EmptySearchResults({
  searchQuery,
  onClearSearch,
}: EmptySearchResultsProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t("emptyStates.noSearchTitle")}
          </h3>
          <p className="text-gray-600 mb-6 max-w-sm">
            {t("emptyStates.noSearchDescription", { query: searchQuery })}
          </p>
          <Button variant="outline" onClick={onClearSearch}>
            {t("emptyStates.clearSearch")}
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
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {t("emptyStates.noBoardsTitle")}
      </h3>
      <p className="text-gray-600 mb-6 max-w-sm mx-auto">
        {t("emptyStates.noBoardsDescription")}
      </p>
      <Button onClick={onCreateBoard}>
        <Plus className="w-4 h-4 mr-2" />
        {t("emptyStates.createFirstBoard")}
      </Button>
    </div>
  );
}
