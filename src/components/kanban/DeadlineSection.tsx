"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDisplayDate, formatDateTime } from "@/lib/date-format";

type DeadlineRequest = {
  id: string;
  suggested_due_date: string;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  resolved_at: string | null;
  requester: { id: string; name: string | null; email: string } | null;
  resolver: { id: string; name: string | null } | null;
};

interface DeadlineSectionProps {
  cardId: string;
  currentDueDate: string | null | undefined;
  canEditDirectly: boolean;
  disabled?: boolean;
  // Called with "YYYY-MM-DD" or "" — only used when canEditDirectly
  onDueDateChange: (value: string) => void;
  // Called when a request is approved (to refresh card due date in parent)
  onDeadlineApproved?: (newDueDate: string | null) => void;
}

const parseCalendarDate = (
  value: string | null | undefined,
): Date | undefined => {
  if (!value) return undefined;
  const iso = value.trim();
  // Handle ISO datetime strings
  const dateOnly = iso.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }
  return parsed;
};

const getCalendarFieldValue = (date: Date | undefined): string => {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function StatusBadge({
  status,
}: {
  status: "pending" | "approved" | "rejected";
}) {
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Clock className="h-3 w-3" />
        {t("editCard.deadlineStatusPending")}
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        {t("editCard.deadlineStatusApproved")}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1 text-xs opacity-80">
      <XCircle className="h-3 w-3" />
      {t("editCard.deadlineStatusRejected")}
    </Badge>
  );
}

export function DeadlineSection({
  cardId,
  currentDueDate,
  canEditDirectly,
  disabled = false,
  onDueDateChange,
  onDeadlineApproved,
}: DeadlineSectionProps) {
  const [requests, setRequests] = useState<DeadlineRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [suggestDate, setSuggestDate] = useState<Date | undefined>(undefined);
  const [suggestNote, setSuggestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch(`/api/cards/${cardId}/deadline-requests`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } finally {
      setLoadingRequests(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const selectedDate = parseCalendarDate(currentDueDate);
  const hasPending = requests.some((r) => r.status === "pending");

  const handleSuggestSubmit = async () => {
    if (!suggestDate) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/cards/${cardId}/deadline-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedDueDate: suggestDate.toISOString(),
          note: suggestNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Fehler");
        return;
      }
      setSubmitSuccess(true);
      setShowSuggestForm(false);
      setSuggestDate(undefined);
      setSuggestNote("");
      await fetchRequests();
      setHistoryOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    setResolvingId(requestId);
    try {
      const res = await fetch(
        `/api/cards/${cardId}/deadline-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (res.ok) {
        await fetchRequests();
        if (action === "approve") {
          // Find the approved request's date and notify parent
          const req = requests.find((r) => r.id === requestId);
          if (req) {
            onDeadlineApproved?.(req.suggested_due_date);
            // Also update the local date picker field
            const d = parseCalendarDate(req.suggested_due_date);
            if (d) onDueDateChange(getCalendarFieldValue(d));
          }
        }
      }
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Date display / picker */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          {t("editCard.dueDateLabel")}
        </Label>

        {canEditDirectly ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                      "h-10 flex-1 justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {selectedDate
                        ? formatDisplayDate(selectedDate)
                        : t("editCard.dueDatePlaceholder")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) =>
                      onDueDateChange(getCalendarFieldValue(date))
                    }
                    disabled={disabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {currentDueDate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  onClick={() => onDueDateChange("")}
                  aria-label={t("editCard.clearDueDate")}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            {hasPending && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("editCard.deadlinePendingRequestsHint")}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50 text-sm">
              <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={cn(!selectedDate && "text-muted-foreground")}>
                {selectedDate
                  ? formatDisplayDate(selectedDate)
                  : t("editCard.dueDatePlaceholder")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("editCard.deadlineCreatorOnly")}
            </p>
            {submitSuccess && (
              <p className="text-xs text-green-600 dark:text-green-400">
                {t("editCard.deadlineSuggestionSent")}
              </p>
            )}
            {!showSuggestForm ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || hasPending}
                onClick={() => {
                  setShowSuggestForm(true);
                  setSubmitSuccess(false);
                }}
              >
                {t("editCard.deadlineSuggestButton")}
              </Button>
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-medium">
                  {t("editCard.deadlineSuggestFormTitle")}
                </p>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {t("editCard.deadlineSuggestedDateLabel")}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !suggestDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="h-4 w-4" />
                        <span>
                          {suggestDate
                            ? formatDisplayDate(suggestDate)
                            : t("editCard.dueDatePlaceholder")}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={suggestDate}
                        onSelect={setSuggestDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {t("editCard.deadlineNoteLabel")}
                  </Label>
                  <Textarea
                    value={suggestNote}
                    onChange={(e) => setSuggestNote(e.target.value)}
                    placeholder={t("editCard.deadlineNotePlaceholder")}
                    rows={2}
                    maxLength={500}
                    className="text-xs resize-none"
                  />
                </div>
                {submitError && (
                  <p className="text-xs text-destructive">{submitError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!suggestDate || submitting}
                    onClick={handleSuggestSubmit}
                  >
                    {submitting && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    )}
                    {t("editCard.deadlineSubmitSuggestion")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSuggestForm(false);
                      setSubmitError("");
                    }}
                  >
                    {t("editCard.deadlineCancelSuggestion")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="border-t pt-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
          onClick={() => setHistoryOpen((p) => !p)}
        >
          {historyOpen ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {t("editCard.deadlineHistoryTitle")}
          {hasPending && (
            <span className="ml-1 h-2 w-2 rounded-full bg-amber-500 inline-block" />
          )}
          {loadingRequests && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
        </button>

        {historyOpen && (
          <div className="mt-2 space-y-2">
            {requests.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("editCard.deadlineNoHistory")}
              </p>
            ) : (
              requests.map((req) => {
                const suggestedDate = parseCalendarDate(req.suggested_due_date);
                return (
                  <div
                    key={req.id}
                    className="rounded-md border bg-muted/20 p-2.5 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium">
                            {suggestedDate
                              ? formatDisplayDate(suggestedDate)
                              : req.suggested_due_date}
                          </span>
                          <StatusBadge status={req.status} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {req.requester?.name ||
                            req.requester?.email ||
                            t("common.unknown")}
                          {" · "}
                          {formatDateTime(new Date(req.created_at))}
                        </p>
                        {req.note && (
                          <p className="text-xs text-muted-foreground italic">
                            {req.note}
                          </p>
                        )}
                        {req.resolver && req.resolved_at && (
                          <p className="text-[11px] text-muted-foreground">
                            {req.status === "approved"
                              ? t("editCard.deadlineStatusApproved")
                              : t("editCard.deadlineStatusRejected")}{" "}
                            {t("editCard.deadlineResolvedBy")}{" "}
                            {req.resolver.name} ·{" "}
                            {formatDateTime(new Date(req.resolved_at))}
                          </p>
                        )}
                      </div>
                      {canEditDirectly && req.status === "pending" && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950"
                            disabled={resolvingId === req.id}
                            onClick={() => handleResolve(req.id, "approve")}
                          >
                            {resolvingId === req.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              t("editCard.deadlineApproveButton")
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
                            disabled={resolvingId === req.id}
                            onClick={() => handleResolve(req.id, "reject")}
                          >
                            {t("editCard.deadlineRejectButton")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
