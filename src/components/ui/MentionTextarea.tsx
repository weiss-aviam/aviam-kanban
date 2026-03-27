"use client";

import {
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import type { KeyboardEvent, ChangeEvent } from "react";
import type { User } from "@/types/database";
import { UserAvatar } from "@/components/ui/UserAvatar";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MentionTextareaRef = {
  /** IDs of users mentioned in the current value. */
  getMentionedUserIds: () => string[];
  /** Reset the textarea and mention tracking. */
  reset: () => void;
};

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  boardMembers: Pick<User, "id" | "name" | "email" | "avatarUrl">[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onSubmit?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

function displayName(u: Pick<User, "name" | "email">): string {
  return u.name ?? u.email.split("@")[0] ?? u.email;
}

// Detects a trailing @ trigger: "@partial" at end of string
function getMentionQuery(text: string): string | null {
  const match = /@([\w.]*)$/.exec(text);
  return match ? match[1]! : null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MentionTextarea = forwardRef<
  MentionTextareaRef,
  MentionTextareaProps
>(function MentionTextarea(
  { value, onChange, boardMembers, placeholder, disabled, className, onSubmit },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mentionedIdsRef = useRef<Set<string>>(new Set());
  const [query, setQuery] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{
    bottom: number;
    left: number;
    width: number;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    getMentionedUserIds: () => Array.from(mentionedIdsRef.current),
    reset: () => {
      mentionedIdsRef.current = new Set();
      setQuery(null);
      setSelectedIdx(0);
    },
  }));

  const filtered =
    query !== null
      ? boardMembers
          .filter((m) => {
            const q = query.toLowerCase();
            return (
              (m.name ?? "").toLowerCase().includes(q) ||
              m.email.toLowerCase().includes(q)
            );
          })
          .slice(0, 6)
      : [];

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      onChange(newVal);
      const q = getMentionQuery(newVal);
      setQuery(q);
      setSelectedIdx(0);
    },
    [onChange],
  );

  const insertMention = useCallback(
    (member: Pick<User, "id" | "name" | "email">) => {
      const name = displayName(member);
      // Replace the trailing @partial with @Name
      const newVal = value.replace(/@([\w.]*)$/, `@${name} `);
      onChange(newVal);
      mentionedIdsRef.current.add(member.id);
      setQuery(null);
      setSelectedIdx(0);
      textareaRef.current?.focus();
    },
    [value, onChange],
  );

  // Recalculate dropdown position whenever it opens or query changes.
  // Uses visualViewport so the position stays correct when the soft keyboard
  // is open on mobile (window.innerHeight does not shrink on iOS Safari).
  useEffect(() => {
    if (query === null || !wrapperRef.current) {
      // Dropdown is already hidden by the `query !== null` guard in the render;
      // no state update needed here.
      return;
    }

    const updatePosition = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const offsetTop = window.visualViewport?.offsetTop ?? 0;
      setDropdownPos({
        bottom: vh - (rect.top - offsetTop) + 4,
        left: rect.left + (window.visualViewport?.offsetLeft ?? 0),
        width: rect.width,
      });
    };

    updatePosition();

    // Re-position when the keyboard opens/closes or the viewport scrolls
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updatePosition);
      vv.addEventListener("scroll", updatePosition);
      return () => {
        vv.removeEventListener("resize", updatePosition);
        vv.removeEventListener("scroll", updatePosition);
      };
    }
    return undefined;
  }, [query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (query !== null && filtered.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIdx((i) => (i + 1) % filtered.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          const member = filtered[selectedIdx];
          if (member) {
            e.preventDefault();
            insertMention(member);
            return;
          }
        }
        if (e.key === "Escape") {
          setQuery(null);
          return;
        }
      }

      // Ctrl/Cmd+Enter submits
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    [query, filtered, selectedIdx, insertMention, onSubmit],
  );

  const dropdown =
    query !== null && filtered.length > 0 && dropdownPos
      ? createPortal(
          <div
            style={{
              position: "fixed",
              bottom: dropdownPos.bottom,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className="overflow-hidden rounded-md border border-border bg-white shadow-lg"
          >
            {filtered.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  i === selectedIdx ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <UserAvatar
                  name={m.name}
                  email={m.email}
                  avatarUrl={m.avatarUrl}
                  className="h-6 w-6 shrink-0"
                  textClassName="text-xs"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{displayName(m)}</p>
                  {m.name && (
                    <p className="truncate text-xs text-gray-400">{m.email}</p>
                  )}
                </div>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapperRef} className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={
          className ??
          "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        }
      />
      {dropdown}
    </div>
  );
});
