'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  type?: 'default' | 'success' | 'error' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export interface ToastContextType {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);

    // Auto remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ 
  toasts, 
  onRemove 
}: { 
  toasts: ToastProps[]; 
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

function Toast({ title, description, type = 'default', onClose }: ToastProps) {
  const typeStyles = {
    default: 'bg-white border-gray-200',
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
  };

  const iconStyles = {
    default: 'text-gray-400',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
  };

  return (
    <div
      className={cn(
        'relative flex w-full items-center space-x-4 overflow-hidden rounded-md border p-4 shadow-lg transition-all',
        typeStyles[type]
      )}
    >
      <div className="flex-1">
        {title && (
          <div className="text-sm font-medium text-gray-900">{title}</div>
        )}
        {description && (
          <div className="text-sm text-gray-600">{description}</div>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-gray-100',
            iconStyles[type]
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Helper functions for common toast types
export const toast = {
  success: (message: string, title?: string) => {
    const { addToast } = React.useContext(ToastContext) || {};
    addToast?.({ title, description: message, type: 'success' });
  },
  error: (message: string, title?: string) => {
    const { addToast } = React.useContext(ToastContext) || {};
    addToast?.({ title, description: message, type: 'error' });
  },
  warning: (message: string, title?: string) => {
    const { addToast } = React.useContext(ToastContext) || {};
    addToast?.({ title, description: message, type: 'warning' });
  },
  info: (message: string, title?: string) => {
    const { addToast } = React.useContext(ToastContext) || {};
    addToast?.({ title, description: message, type: 'default' });
  },
};
