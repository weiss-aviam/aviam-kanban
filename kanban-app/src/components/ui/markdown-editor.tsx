'use client';

import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import { rehype } from 'rehype';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  className?: string;
  preview?: 'edit' | 'preview' | 'live';
  hideToolbar?: boolean;
  visibleDragBar?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Enter description...',
  height = 200,
  className,
  preview = 'live',
  hideToolbar = false,
  visibleDragBar = true,
}: MarkdownEditorProps) {
  const handleChange = (val?: string) => {
    onChange(val || '');
  };

  return (
    <div className={cn('markdown-editor', className)}>
      <MDEditor
        value={value}
        onChange={handleChange}
        preview={preview}
        height={height}
        hideToolbar={hideToolbar}
        visibleDragbar={visibleDragBar}
        data-color-mode="light"
        textareaProps={{
          placeholder,
          style: {
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: 'inherit',
          },
        }}
        previewOptions={{
          remarkPlugins: [remarkGfm],
          rehypePlugins: [
            [rehypeSanitize, {
              // Allow common HTML elements and attributes
              tagNames: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'br', 'hr',
                'strong', 'em', 'u', 's', 'del', 'ins',
                'ul', 'ol', 'li',
                'blockquote',
                'code', 'pre',
                'a',
                'img',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'div', 'span',
              ],
              attributes: {
                '*': ['className', 'style'],
                'a': ['href', 'title', 'target', 'rel'],
                'img': ['src', 'alt', 'title', 'width', 'height'],
                'code': ['className'],
                'pre': ['className'],
                'table': ['className'],
                'th': ['align'],
                'td': ['align'],
              },
              protocols: {
                href: ['http', 'https', 'mailto'],
                src: ['http', 'https'],
              },
            }],
          ],
        }}
      />
    </div>
  );
}

// Toolbar configuration for different use cases
export const TOOLBAR_CONFIGS = {
  minimal: [
    'bold', 'italic', 'strikethrough',
    '|',
    'unorderedListCommand', 'orderedListCommand',
    '|',
    'link', 'code',
  ],
  standard: [
    'bold', 'italic', 'strikethrough',
    '|',
    'title', 'title2', 'title3',
    '|',
    'unorderedListCommand', 'orderedListCommand', 'checkedListCommand',
    '|',
    'link', 'quote', 'code', 'codeBlock',
    '|',
    'table', 'image',
  ],
  full: [
    'bold', 'italic', 'strikethrough',
    '|',
    'title', 'title2', 'title3', 'title4', 'title5', 'title6',
    '|',
    'unorderedListCommand', 'orderedListCommand', 'checkedListCommand',
    '|',
    'link', 'quote', 'code', 'codeBlock',
    '|',
    'table', 'image',
    '|',
    'preview', 'fullscreen',
  ],
};

// Compact markdown editor for inline editing
export function CompactMarkdownEditor({
  value,
  onChange,
  placeholder = 'Add a description...',
  className,
}: Omit<MarkdownEditorProps, 'height' | 'preview'>) {
  return (
    <MarkdownEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      height={120}
      preview="edit"
      hideToolbar={false}
      visibleDragBar={false}
      className={cn('compact-markdown-editor', className)}
    />
  );
}

// Inline markdown editor for quick edits
export function InlineMarkdownEditor({
  value,
  onChange,
  placeholder = 'Click to edit...',
  className,
}: Omit<MarkdownEditorProps, 'height' | 'preview' | 'hideToolbar'>) {
  return (
    <MarkdownEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      height={80}
      preview="edit"
      hideToolbar={true}
      visibleDragBar={false}
      className={cn('inline-markdown-editor', className)}
    />
  );
}
