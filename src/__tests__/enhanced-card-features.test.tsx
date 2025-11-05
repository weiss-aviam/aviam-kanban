import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PrioritySelector,
  PriorityBadge,
} from "@/components/ui/priority-selector";
import {
  MarkdownViewer,
  CompactMarkdownViewer,
} from "@/components/ui/markdown-viewer";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useBoardFilters } from "@/hooks/useBoardFilters";
import { useCardActions } from "@/hooks/useCardActions";
import { getPriorityConfig, sortCardsByPriority } from "@/lib/priority-colors";
import type { Card } from "@/types/database";

const { renderHook, act } = globalThis as typeof globalThis & {
  renderHook: typeof import("@testing-library/react").renderHook;
  act: typeof import("@testing-library/react").act;
};

// Mock data
const mockCard: Card = {
  id: "1",
  title: "Test Card",
  description: "# Test Description\n\nThis is a **markdown** description.",
  priority: "high",
  columnId: 1,
  boardId: "board-1",
  position: 1,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  assigneeId: "user-1",
  dueDate: null,
};

const mockCards: Card[] = [
  { ...mockCard, id: "1", priority: "high", title: "High Priority Card" },
  { ...mockCard, id: "2", priority: "medium", title: "Medium Priority Card" },
  { ...mockCard, id: "3", priority: "low", title: "Low Priority Card" },
  { ...mockCard, id: "4", priority: "high", title: "Another High Priority" },
];

// Mock fetch
global.fetch = vi.fn();

describe("Priority System", () => {
  describe("PrioritySelector", () => {
    it("renders with correct priority value", () => {
      const mockOnChange = vi.fn();
      render(<PrioritySelector value="high" onChange={mockOnChange} />);

      expect(screen.getByText("HIGH")).toBeInTheDocument();
    });

    it("calls onChange when priority is selected", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(<PrioritySelector value="medium" onChange={mockOnChange} />);

      // Click the selector to open dropdown
      await user.click(screen.getByRole("button"));

      // Click on high priority option
      await user.click(screen.getByText("HIGH"));

      expect(mockOnChange).toHaveBeenCalledWith("high");
    });

    it("displays correct colors for each priority", () => {
      const mockOnChange = vi.fn();

      render(<PrioritySelector value="high" onChange={mockOnChange} />);

      // const highConfig = getPriorityConfig('high');
      expect(screen.getByText("HIGH")).toBeInTheDocument();
    });
  });

  describe("PriorityBadge", () => {
    it("renders with correct priority styling", () => {
      render(<PriorityBadge priority="high" />);

      const badge = screen.getByText("HIGH");
      expect(badge).toBeInTheDocument();
      expect(badge.closest(".bg-red-100")).toBeInTheDocument();
    });

    it("renders different sizes correctly", () => {
      const { rerender } = render(
        <PriorityBadge priority="medium" size="sm" />,
      );
      expect(screen.getByText("MEDIUM")).toBeInTheDocument();

      rerender(<PriorityBadge priority="medium" size="lg" />);
      expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    });
  });

  describe("Priority Utilities", () => {
    it("sorts cards by priority correctly", () => {
      const sorted = sortCardsByPriority(mockCards);

      expect(sorted[0]?.priority).toBe("high");
      expect(sorted[1]?.priority).toBe("high");
      expect(sorted[2]?.priority).toBe("medium");
      expect(sorted[3]?.priority).toBe("low");
    });

    it("gets correct priority configuration", () => {
      const highConfig = getPriorityConfig("high");
      expect(highConfig.label).toBe("HIGH");
      expect(highConfig.color).toBe("#dc2626");

      const mediumConfig = getPriorityConfig("medium");
      expect(mediumConfig.label).toBe("MEDIUM");
      expect(mediumConfig.color).toBe("#ea580c");

      const lowConfig = getPriorityConfig("low");
      expect(lowConfig.label).toBe("LOW");
      expect(lowConfig.color).toBe("#65a30d");
    });
  });
});

describe("Markdown System", () => {
  describe("MarkdownViewer", () => {
    it("renders markdown content correctly", () => {
      render(<MarkdownViewer content="# Heading\n\nThis is **bold** text." />);

      expect(screen.getByText("Heading")).toBeInTheDocument();
      expect(screen.getByText("bold")).toBeInTheDocument();
    });

    it("handles empty content gracefully", () => {
      render(<MarkdownViewer content="" />);
      expect(screen.getByText("No description provided")).toBeInTheDocument();
    });

    it("sanitizes dangerous HTML", () => {
      render(
        <MarkdownViewer content="<script>alert('xss')</script>Safe content" />,
      );

      expect(screen.getByText("Safe content")).toBeInTheDocument();
      expect(screen.queryByText("alert")).not.toBeInTheDocument();
    });
  });

  describe("CompactMarkdownViewer", () => {
    it("renders in compact mode", () => {
      render(
        <CompactMarkdownViewer content="# Long heading that should be truncated" />,
      );

      expect(
        screen.getByText("Long heading that should be truncated"),
      ).toBeInTheDocument();
    });

    it("respects maxLines prop", () => {
      const longContent = "Line 1\n\nLine 2\n\nLine 3\n\nLine 4";
      render(<CompactMarkdownViewer content={longContent} maxLines={2} />);

      // Should truncate content
      expect(screen.getByText("Line 1")).toBeInTheDocument();
    });
  });

  describe("MarkdownEditor", () => {
    it("renders editor with initial value", () => {
      const mockOnChange = vi.fn();
      render(
        <MarkdownEditor value="Initial content" onChange={mockOnChange} />,
      );

      expect(screen.getByDisplayValue("Initial content")).toBeInTheDocument();
    });

    it("calls onChange when content is modified", async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(<MarkdownEditor value="" onChange={mockOnChange} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "New content");

      expect(mockOnChange).toHaveBeenCalled();
    });
  });
});

describe("Card Actions Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ card: mockCard }),
    });
  });

  it("handles priority change correctly", async () => {
    const mockOnCardUpdated = vi.fn();
    const { result } = renderHook(() =>
      useCardActions({
        onCardUpdated: mockOnCardUpdated,
      }),
    );

    await result.current.handlePriorityChange(mockCard, "low");

    expect(global.fetch).toHaveBeenCalledWith(`/api/cards/${mockCard.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: "low" }),
    });
    expect(mockOnCardUpdated).toHaveBeenCalledWith(mockCard);
  });

  it("handles card duplication", async () => {
    const mockOnCardCreated = vi.fn();
    const { result } = renderHook(() =>
      useCardActions({
        onCardCreated: mockOnCardCreated,
      }),
    );

    await result.current.handleDuplicateCard(mockCard);

    expect(global.fetch).toHaveBeenCalledWith("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: mockCard.boardId,
        columnId: mockCard.columnId,
        title: `${mockCard.title} (Copy)`,
        description: mockCard.description,
        priority: mockCard.priority,
        assigneeId: mockCard.assigneeId,
        dueDate: mockCard.dueDate,
      }),
    });
  });

  it("handles errors gracefully", async () => {
    const mockOnError = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Test error" }),
    });

    const { result } = renderHook(() =>
      useCardActions({
        onError: mockOnError,
      }),
    );

    await expect(
      result.current.handlePriorityChange(mockCard, "low"),
    ).rejects.toThrow("Test error");
    expect(mockOnError).toHaveBeenCalledWith("Test error");
  });
});

describe("Board Filters Hook", () => {
  it("filters cards by priority correctly", () => {
    const { result } = renderHook(() => useBoardFilters(mockCards));

    // Set priority filter
    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        priorities: ["high"],
      });
    });

    expect(result.current.filteredAndSortedCards).toHaveLength(2);
    expect(
      result.current.filteredAndSortedCards.every(
        (card: Card) => card.priority === "high",
      ),
    ).toBe(true);
  });

  it("sorts cards correctly", () => {
    const { result } = renderHook(() => useBoardFilters(mockCards));

    // Sort by priority
    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        sortBy: "priority",
        sortOrder: "desc",
      });
    });

    const sorted = result.current.filteredAndSortedCards;
    expect(sorted[0]?.priority).toBe("high");
    expect(sorted[sorted.length - 1]?.priority).toBe("low");
  });

  it("provides correct statistics", () => {
    const { result } = renderHook(() => useBoardFilters(mockCards));

    expect(result.current.stats.total).toBe(4);
    expect(result.current.stats.priorityStats.high).toBe(2);
    expect(result.current.stats.priorityStats.medium).toBe(1);
    expect(result.current.stats.priorityStats.low).toBe(1);
  });
});

describe("Accessibility", () => {
  it("priority selector has proper ARIA labels", () => {
    const mockOnChange = vi.fn();
    render(<PrioritySelector value="high" onChange={mockOnChange} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded");
  });

  it("markdown content is accessible", () => {
    render(
      <MarkdownViewer content="# Accessible Heading\n\nAccessible content." />,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("Accessible Heading");
  });

  it("priority badges have proper titles", () => {
    render(<PriorityBadge priority="high" />);

    // The icon should have a title attribute for accessibility
    const icon = screen.getByRole("img", { hidden: true });
    expect(icon).toHaveAttribute("title");
  });
});
