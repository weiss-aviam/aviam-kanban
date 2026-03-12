import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@/__tests__/setup";
import { DeadlineSection } from "@/components/kanban/DeadlineSection";

// Radix Popover doesn't open in jsdom without pointer events — mock it to
// render its content inline so we can test the calendar interactions.
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

const CARD_ID = "11111111-1111-4111-8111-111111111111";
const REQUESTER_ID = "22222222-2222-4222-2222-222222222222";

const noRequests = { requests: [] };

const sampleRequests = {
  requests: [
    {
      id: "req-1",
      suggested_due_date: "2026-05-01T00:00:00Z",
      note: "Sprint delay",
      status: "pending",
      change_type: "suggestion",
      created_at: "2026-03-10T09:00:00Z",
      resolved_at: null,
      requester: {
        id: REQUESTER_ID,
        name: "Alice",
        email: "alice@example.com",
      },
      resolver: null,
    },
    {
      id: "req-2",
      suggested_due_date: "2026-04-15T00:00:00Z",
      note: null,
      status: "applied",
      change_type: "direct",
      created_at: "2026-03-05T08:00:00Z",
      resolved_at: "2026-03-05T08:00:00Z",
      requester: { id: "creator-id", name: "Bob", email: "bob@example.com" },
      resolver: { id: "creator-id", name: "Bob" },
    },
  ],
};

function mockFetchOnce(data: object, status = 200) {
  vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("DeadlineSection", () => {
  const onDueDateChange = vi.fn();
  const onDeadlineApproved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ─── Creator view ─────────────────────────────────────────────────────

  describe("when the user can edit directly (creator)", () => {
    it("renders the date picker for creators", async () => {
      mockFetchOnce(noRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-10"
          canEditDirectly={true}
          onDueDateChange={onDueDateChange}
        />,
      );

      // Should show due date label
      await waitFor(() => {
        expect(screen.getByText("Fällig am")).toBeInTheDocument();
      });
    });

    it("shows clear button when a date is set", async () => {
      mockFetchOnce(noRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-10"
          canEditDirectly={true}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Datum entfernen")).toBeInTheDocument();
      });
    });

    it("calls onDueDateChange with empty string when clear is clicked", async () => {
      mockFetchOnce(noRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-10"
          canEditDirectly={true}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() =>
        expect(screen.getByLabelText("Datum entfernen")).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByLabelText("Datum entfernen"));
      expect(onDueDateChange).toHaveBeenCalledWith("");
    });

    it("shows amber hint when there are pending suggestions", async () => {
      mockFetchOnce(sampleRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-15"
          canEditDirectly={true}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Es gibt ausstehende Terminvorschläge."),
        ).toBeInTheDocument();
      });
    });
  });

  // ─── Non-creator view ─────────────────────────────────────────────────

  describe("when the user can only suggest (non-creator)", () => {
    it("renders a read-only date display and suggest button", async () => {
      mockFetchOnce(noRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-15"
          canEditDirectly={false}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Neuen Termin vorschlagen"),
        ).toBeInTheDocument();
      });
      expect(
        screen.getByText(
          "Nur der Kartenersteller kann den Termin direkt bearbeiten.",
        ),
      ).toBeInTheDocument();
    });

    it("opens the suggestion form when the suggest button is clicked", async () => {
      mockFetchOnce(noRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate={undefined}
          canEditDirectly={false}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getByText("Neuen Termin vorschlagen"),
        ).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByText("Neuen Termin vorschlagen"));

      expect(
        screen.getByText("Terminsvorschlag einreichen"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Warum soll der Termin geändert werden?"),
      ).toBeInTheDocument();
    });

    it("hides the suggestion form when cancel is clicked", async () => {
      mockFetchOnce(noRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate={undefined}
          canEditDirectly={false}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getByText("Neuen Termin vorschlagen"),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByText("Neuen Termin vorschlagen"));
      expect(
        screen.getByText("Terminsvorschlag einreichen"),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByText("Abbrechen"));
      expect(
        screen.queryByText("Terminsvorschlag einreichen"),
      ).not.toBeInTheDocument();
    });

    it("disables the suggest button when there is already a pending request", async () => {
      mockFetchOnce(sampleRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate={undefined}
          canEditDirectly={false}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() =>
        expect(
          screen.getByText("Neuen Termin vorschlagen"),
        ).toBeInTheDocument(),
      );
      expect(screen.getByText("Neuen Termin vorschlagen")).toBeDisabled();
    });
  });

  // ─── History panel ────────────────────────────────────────────────────

  describe("history panel", () => {
    it("shows 'no history' when there are no requests", async () => {
      mockFetchOnce(noRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate={undefined}
          canEditDirectly={false}
          onDueDateChange={onDueDateChange}
        />,
      );

      fireEvent.click(screen.getByText("Terminverlauf"));

      await waitFor(() => {
        expect(
          screen.getByText("Noch keine Terminänderungen."),
        ).toBeInTheDocument();
      });
    });

    it("shows both direct and suggestion entries in history", async () => {
      mockFetchOnce(sampleRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-15"
          canEditDirectly={true}
          onDueDateChange={onDueDateChange}
          onDeadlineApproved={onDeadlineApproved}
        />,
      );

      fireEvent.click(screen.getByText("Terminverlauf"));

      await waitFor(() => {
        // Direct entry label
        expect(screen.getByText("Termin gesetzt")).toBeInTheDocument();
        // Requester name for the suggestion
        expect(screen.getByText(/Alice/)).toBeInTheDocument();
      });
    });

    it("shows approve and reject buttons for creator on pending suggestions", async () => {
      mockFetchOnce(sampleRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-15"
          canEditDirectly={true}
          onDueDateChange={onDueDateChange}
          onDeadlineApproved={onDeadlineApproved}
        />,
      );

      fireEvent.click(screen.getByText("Terminverlauf"));

      await waitFor(() => {
        expect(screen.getByText("Genehmigen")).toBeInTheDocument();
        expect(screen.getByText("Ablehnen")).toBeInTheDocument();
      });
    });

    it("does not show approve/reject buttons for non-creators", async () => {
      mockFetchOnce(sampleRequests);

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate="2026-04-15"
          canEditDirectly={false}
          onDueDateChange={onDueDateChange}
        />,
      );

      fireEvent.click(screen.getByText("Terminverlauf"));

      await waitFor(() => {
        expect(screen.queryByText("Genehmigen")).not.toBeInTheDocument();
        expect(screen.queryByText("Ablehnen")).not.toBeInTheDocument();
      });
    });

    it("fetches requests for the given card ID", async () => {
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify(noRequests), { status: 200 }),
        );

      render(
        <DeadlineSection
          cardId={CARD_ID}
          currentDueDate={undefined}
          canEditDirectly={false}
          onDueDateChange={onDueDateChange}
        />,
      );

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          `/api/cards/${CARD_ID}/deadline-requests`,
        );
      });
    });
  });
});
