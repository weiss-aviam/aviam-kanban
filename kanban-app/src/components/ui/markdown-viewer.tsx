'use client';

import React from 'react';
import MDEditor from '@uiw/react-md-editor';
import { rehype } from 'rehype';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
  compact?: boolean;
  maxLines?: number;
}

export function MarkdownViewer({
  content,
  className,
  compact = false,
  maxLines,
}: MarkdownViewerProps) {
  // Handle empty or null content
  if (!content || content.trim() === '') {
    return (
      <div className={cn(
        'text-gray-500 italic text-sm',
        compact && 'text-xs',
        className
      )}>
        No description provided
      </div>
    );
  }

  const viewerClasses = cn(
    'markdown-viewer',
    compact && 'markdown-viewer-compact',
    maxLines && `line-clamp-${maxLines}`,
    className
  );

  return (
    <div className={viewerClasses}>
      <MDEditor.Markdown
        source={content}
        style={{
          backgroundColor: 'transparent',
          color: 'inherit',
          fontSize: compact ? '0.875rem' : '0.9rem',
          lineHeight: compact ? '1.4' : '1.6',
        }}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          [rehypeSanitize, {
            // Allow common HTML elements and attributes for safe rendering
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
        ]}
      />
    </div>
  );
}

// Compact viewer for card previews
export function CompactMarkdownViewer({
  content,
  className,
  maxLines = 2,
}: Omit<MarkdownViewerProps, 'compact'>) {
  return (
    <MarkdownViewer
      content={content}
      compact={true}
      maxLines={maxLines}
      className={cn('text-gray-600', className)}
    />
  );
}

// Inline viewer for single-line content
export function InlineMarkdownViewer({
  content,
  className,
}: Omit<MarkdownViewerProps, 'compact' | 'maxLines'>) {
  // For inline viewing, strip markdown and show plain text
  const plainText = content
    .replace(/[#*_`~\[\]()]/g, '') // Remove markdown characters
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .trim();

  if (!plainText) {
    return (
      <span className={cn('text-gray-500 italic text-sm', className)}>
        No description
      </span>
    );
  }

  return (
    <span className={cn('text-gray-700 text-sm', className)}>
      {plainText}
    </span>
  );
}

// Full viewer for detailed content display
export function DetailedMarkdownViewer({
  content,
  className,
}: Omit<MarkdownViewerProps, 'compact' | 'maxLines'>) {
  return (
    <MarkdownViewer
      content={content}
      className={cn('prose prose-sm max-w-none', className)}
    />
  );
}

// Utility function to extract plain text from markdown
export function extractPlainText(markdown: string, maxLength?: number): string {
  const plainText = markdown
    .replace(/[#*_`~\[\]()]/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength && plainText.length > maxLength) {
    return plainText.substring(0, maxLength) + '...';
  }

  return plainText;
}

// Utility function to check if content has markdown formatting
export function hasMarkdownFormatting(content: string): boolean {
  const markdownPatterns = [
    /#{1,6}\s/, // Headers
    /\*\*.*\*\*/, // Bold
    /\*.*\*/, // Italic
    /`.*`/, // Code
    /\[.*\]\(.*\)/, // Links
    /^[-*+]\s/m, // Lists
    /^>\s/m, // Blockquotes
    /```/, // Code blocks
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
}

// Utility function to get content preview
export function getMarkdownPreview(content: string, maxLength: number = 100): string {
  if (!content) return '';
  
  const plainText = extractPlainText(content);
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  return plainText.substring(0, maxLength).trim() + '...';
}
