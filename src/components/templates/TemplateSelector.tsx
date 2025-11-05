"use client";

import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Loader2, Layout, Star } from "lucide-react";

interface Template {
  id: number;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic: boolean;
  isOwner: boolean;
  columns: {
    id: number;
    title: string;
    position: number;
  }[];
}

interface TemplateSelectorProps {
  selectedTemplateId?: number | undefined;
  onTemplateSelect: (templateId: number | undefined) => void;
  disabled?: boolean;
}

export function TemplateSelector({
  selectedTemplateId,
  onTemplateSelect,
  disabled = false,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/templates");

      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }

      const data = await response.json();
      setTemplates(data.templates || []);

      // Auto-select default template if no template is selected
      if (!selectedTemplateId && data.templates.length > 0) {
        const defaultTemplate = data.templates.find(
          (t: Template) => t.isDefault,
        );
        if (defaultTemplate) {
          onTemplateSelect(defaultTemplate.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Column Template</Label>
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm text-gray-500">Loading templates...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Column Template</Label>
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="template-select">Column Template</Label>
        <Select
          value={selectedTemplateId?.toString() || "none"}
          onValueChange={(value) =>
            onTemplateSelect(value === "none" ? undefined : parseInt(value))
          }
          disabled={disabled}
        >
          <SelectTrigger id="template-select">
            <SelectValue placeholder="Choose a template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No template</SelectItem>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id.toString()}>
                <div className="flex items-center space-x-2">
                  <Layout className="w-4 h-4" />
                  <span>{template.name}</span>
                  {template.isDefault && (
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Preview */}
      {selectedTemplate && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {selectedTemplate.name}
              </CardTitle>
              <div className="flex space-x-1">
                {selectedTemplate.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Default
                  </Badge>
                )}
                {selectedTemplate.isPublic && (
                  <Badge variant="outline" className="text-xs">
                    Public
                  </Badge>
                )}
              </div>
            </div>
            {selectedTemplate.description && (
              <CardDescription className="text-xs">
                {selectedTemplate.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-600">
                Columns ({selectedTemplate.columns.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedTemplate.columns
                  .sort((a, b) => a.position - b.position)
                  .map((column) => (
                    <Badge
                      key={column.id}
                      variant="outline"
                      className="text-xs"
                    >
                      {column.title}
                    </Badge>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Template Option */}
      <div className="text-xs text-gray-500">
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          onClick={() => onTemplateSelect(undefined)}
          disabled={disabled}
        >
          Use custom columns instead
        </Button>
      </div>
    </div>
  );
}
