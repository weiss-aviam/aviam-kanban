"use client";

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { cn } from "@/lib/utils";

interface MarkdownViewerProps {
  content: string;
  className?: string | undefined;
  compact?: boolean;
  maxLines?: number;
}

function TipTapViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content,
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return <EditorContent editor={editor} className={className} />;
}

export function MarkdownViewer({
  content,
  className,
  compact = false,
  maxLines,
}: MarkdownViewerProps) {
  if (!content || content.trim() === "") {
    return (
      <div
        className={cn(
          "text-gray-500 italic text-sm",
          compact && "text-xs",
          className,
        )}
      >
        No description provided
      </div>
    );
  }

  return (
    <TipTapViewer
      content={content}
      className={cn(
        "markdown-viewer",
        compact && "markdown-viewer-compact",
        maxLines === 2 && "markdown-viewer-clamp-2",
        maxLines === 3 && "markdown-viewer-clamp-3",
        className,
      )}
    />
  );
}

// Compact viewer for card previews
export function CompactMarkdownViewer({
  content,
  className,
  maxLines = 2,
}: Omit<MarkdownViewerProps, "compact">) {
  return (
    <MarkdownViewer
      content={content}
      compact={true}
      maxLines={maxLines}
      className={cn("text-gray-600", className)}
    />
  );
}

// Inline viewer for single-line content
export function InlineMarkdownViewer({
  content,
  className,
}: Omit<MarkdownViewerProps, "compact" | "maxLines">) {
  const plainText = content
    .replace(/[#*_`~\[\]()]/g, "")
    .replace(/\n/g, " ")
    .trim();

  if (!plainText) {
    return (
      <span className={cn("text-gray-500 italic text-sm", className)}>
        No description
      </span>
    );
  }

  return (
    <span className={cn("text-gray-700 text-sm", className)}>{plainText}</span>
  );
}

// Full viewer for detailed content display
export function DetailedMarkdownViewer({
  content,
  className,
}: Omit<MarkdownViewerProps, "compact" | "maxLines">) {
  return <MarkdownViewer content={content} className={className} />;
}

// Utility function to extract plain text from markdown
export function extractPlainText(markdown: string, maxLength?: number): string {
  const plainText = markdown
    .replace(/[#*_`~\[\]()]/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (maxLength && plainText.length > maxLength) {
    return plainText.substring(0, maxLength) + "...";
  }

  return plainText;
}

// Utility function to check if content has markdown formatting
export function hasMarkdownFormatting(content: string): boolean {
  const markdownPatterns = [
    /#{1,6}\s/,
    /\*\*.*\*\*/,
    /\*.*\*/,
    /`.*`/,
    /\[.*\]\(.*\)/,
    /^[-*+]\s/m,
    /^>\s/m,
    /```/,
  ];

  return markdownPatterns.some((pattern) => pattern.test(content));
}

// Utility function to get content preview
export function getMarkdownPreview(
  content: string,
  maxLength: number = 100,
): string {
  if (!content) return "";

  const plainText = extractPlainText(content);

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return plainText.substring(0, maxLength).trim() + "...";
}
