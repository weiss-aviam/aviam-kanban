import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@/__tests__/setup";
import {
  MentionTextarea,
  type MentionTextareaRef,
} from "@/components/ui/MentionTextarea";
import type { User } from "@/types/database";

type BoardMember = Pick<User, "id" | "name" | "email" | "avatarUrl">;

const members: BoardMember[] = [
  {
    id: "u1",
    name: "Alice Smith",
    email: "alice@example.com",
    avatarUrl: null,
  },
  { id: "u2", name: "Bob Jones", email: "bob@example.com", avatarUrl: null },
  { id: "u3", name: null, email: "carol@example.com", avatarUrl: null },
];

function setup(value = "", onChange = vi.fn()) {
  const ref = createRef<MentionTextareaRef>();
  const { rerender } = render(
    <MentionTextarea
      ref={ref}
      value={value}
      onChange={onChange}
      boardMembers={members}
      placeholder="Write a comment..."
    />,
  );
  const textarea = screen.getByRole("textbox");
  return { ref, textarea, onChange, rerender };
}

describe("MentionTextarea", () => {
  it("renders a textarea with the correct placeholder", () => {
    setup();
    expect(screen.getByPlaceholderText("Write a comment...")).toBeDefined();
  });

  it("calls onChange when the user types", () => {
    const onChange = vi.fn();
    const { textarea } = setup("", onChange);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(onChange).toHaveBeenCalledWith("Hello");
  });

  it("shows matching members dropdown when typing @partial", () => {
    const onChange = vi.fn();
    const { textarea } = setup("", onChange);
    fireEvent.change(textarea, { target: { value: "@Ali" } });
    expect(screen.getByText("Alice Smith")).toBeDefined();
    // Bob should not appear
    expect(screen.queryByText("Bob Jones")).toBeNull();
  });

  it("hides dropdown when @ trigger is absent", () => {
    const onChange = vi.fn();
    const { textarea } = setup("", onChange);
    // First open dropdown
    fireEvent.change(textarea, { target: { value: "@Ali" } });
    expect(screen.getByText("Alice Smith")).toBeDefined();
    // Then remove trigger
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.queryByText("Alice Smith")).toBeNull();
  });

  it("selects a member on mousedown and adds their id to mentionedUserIds", () => {
    const onChange = vi.fn();
    const ref = createRef<MentionTextareaRef>();
    render(
      <MentionTextarea
        ref={ref}
        value=""
        onChange={onChange}
        boardMembers={members}
      />,
    );
    // Type "@Ali" to open the dropdown
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "@Ali" } });
    const button = screen.getByText("Alice Smith").closest("button")!;
    fireEvent.mouseDown(button);
    // onChange is called (value replacement depends on controlled prop updating in real app)
    expect(onChange).toHaveBeenCalled();
    // The mentioned user id must be tracked in the ref
    expect(ref.current?.getMentionedUserIds()).toContain("u1");
  });

  it("reset() clears mentioned ids and closes dropdown", () => {
    const onChange = vi.fn();
    const ref = createRef<MentionTextareaRef>();
    render(
      <MentionTextarea
        ref={ref}
        value=""
        onChange={onChange}
        boardMembers={members}
      />,
    );
    // Type "@Ali" to open the dropdown
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "@Ali" } });
    // Select a member
    const button = screen.getByText("Alice Smith").closest("button")!;
    fireEvent.mouseDown(button);
    expect(ref.current?.getMentionedUserIds()).toContain("u1");

    ref.current?.reset();
    expect(ref.current?.getMentionedUserIds()).toHaveLength(0);
  });

  it("calls onSubmit when Ctrl+Enter is pressed", () => {
    const onSubmit = vi.fn();
    render(
      <MentionTextarea
        value="test"
        onChange={vi.fn()}
        boardMembers={members}
        onSubmit={onSubmit}
      />,
    );
    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
