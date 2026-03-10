"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Minus,
  FileCode2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean | undefined;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EditorWithMarkdown = {
  storage: { markdown: { getMarkdown: () => string } };
  commands: { setContent: (content: string) => boolean };
};

function getMarkdown(ed: unknown): string {
  return (ed as EditorWithMarkdown).storage.markdown.getMarkdown();
}

function setEditorContent(ed: unknown, md: string) {
  (ed as EditorWithMarkdown).commands.setContent(md);
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Enter description...",
  height = 200,
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"wysiwyg" | "markdown">("wysiwyg");
  const [rawMarkdown, setRawMarkdown] = useState(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({ placeholder }),
    ],
    immediatelyRender: false,
    content: value,
    onUpdate({ editor: ed }) {
      const md = getMarkdown(ed);
      setRawMarkdown(md);
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none px-3 py-2",
        style: `min-height: ${height - 44}px`,
      },
    },
  });

  // Sync external value changes (e.g. form reset when opening a different card)
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor);
    if (current !== value) {
      setEditorContent(editor, value);
      // Defer state update to avoid calling setState synchronously inside an effect
      queueMicrotask(() => setRawMarkdown(value));
    }
  }, [value, editor]);

  const switchToMarkdown = useCallback(() => {
    if (!editor) return;
    const md = getMarkdown(editor);
    setRawMarkdown(md);
    setMode("markdown");
  }, [editor]);

  const switchToWysiwyg = useCallback(() => {
    if (!editor) return;
    setEditorContent(editor, rawMarkdown);
    onChange(rawMarkdown);
    setMode("wysiwyg");
  }, [editor, rawMarkdown, onChange]);

  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawMarkdown(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div
      className={cn(
        "rounded-md border bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b bg-muted/40 px-2 py-1 flex-wrap">
        {mode === "wysiwyg" ? (
          <>
            <ToolbarButton
              title="Bold"
              active={editor?.isActive("bold")}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Italic"
              active={editor?.isActive("italic")}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Strikethrough"
              active={editor?.isActive("strike")}
              onClick={() => editor?.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
              title="Heading 1"
              active={editor?.isActive("heading", { level: 1 })}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()
              }
            >
              <Heading1 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 2"
              active={editor?.isActive("heading", { level: 2 })}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 3"
              active={editor?.isActive("heading", { level: 3 })}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
            >
              <Heading3 className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
              title="Bullet list"
              active={editor?.isActive("bulletList")}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Ordered list"
              active={editor?.isActive("orderedList")}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
              title="Blockquote"
              active={editor?.isActive("blockquote")}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Inline code"
              active={editor?.isActive("code")}
              onClick={() => editor?.chain().focus().toggleCode().run()}
            >
              <Code className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Code block"
              active={editor?.isActive("codeBlock")}
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              <Code2 className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Horizontal rule"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            >
              <Minus className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mode toggle */}
        <button
          type="button"
          title={
            mode === "wysiwyg"
              ? "Switch to Markdown source"
              : "Switch to visual editor"
          }
          onMouseDown={(e) => {
            e.preventDefault();
            mode === "wysiwyg" ? switchToMarkdown() : switchToWysiwyg();
          }}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors",
            mode === "markdown"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <FileCode2 className="h-3 w-3" />
          MD
        </button>
      </div>

      {/* Editor area */}
      {mode === "wysiwyg" ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          value={rawMarkdown}
          onChange={handleRawChange}
          className="w-full resize-none bg-transparent px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
          style={{ minHeight: height - 44 }}
          spellCheck={false}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact variant (used in small dialogs)
// ---------------------------------------------------------------------------

export function CompactMarkdownEditor({
  value,
  onChange,
  placeholder = "Add a description...",
  className,
}: Omit<MarkdownEditorProps, "height">) {
  return (
    <MarkdownEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      height={120}
      className={cn("compact-markdown-editor", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Inline variant (no toolbar, minimal height)
// ---------------------------------------------------------------------------

export function InlineMarkdownEditor({
  value,
  onChange,
  placeholder = "Click to edit...",
  className,
}: Omit<MarkdownEditorProps, "height">) {
  return (
    <MarkdownEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      height={80}
      className={cn("inline-markdown-editor", className)}
    />
  );
}

// Keep old export shape so nothing else breaks
export const TOOLBAR_CONFIGS = {};
