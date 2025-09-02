import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanCard } from '../KanbanCard';
import type { Card } from '@/types/database';

const mockCard: Card = {
  id: 1,
  boardId: 1,
  columnId: 1,
  title: 'Test Card',
  description: 'Test Description',
  assigneeId: 'user-1',
  dueDate: new Date('2024-12-31'),
  position: 1,
  createdAt: new Date('2024-01-01'),
  assignee: {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2024-01-01'),
  },
  labels: [
    {
      id: 1,
      boardId: 1,
      name: 'Bug',
      color: '#ef4444',
    },
  ],
};

describe('KanbanCard', () => {
  it('renders card title', () => {
    render(<KanbanCard card={mockCard} />);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('renders card description', () => {
    render(<KanbanCard card={mockCard} />);
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('renders assignee avatar', () => {
    render(<KanbanCard card={mockCard} />);
    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of name
  });

  it('renders labels', () => {
    render(<KanbanCard card={mockCard} />);
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<KanbanCard card={mockCard} onClick={onClick} />);
    
    fireEvent.click(screen.getByText('Test Card'));
    expect(onClick).toHaveBeenCalled();
  });

  it('shows due date', () => {
    render(<KanbanCard card={mockCard} />);
    expect(screen.getByText('Dec 31')).toBeInTheDocument();
  });

  it('shows overdue indicator for past due dates', () => {
    const overdueCard = {
      ...mockCard,
      dueDate: new Date('2020-01-01'),
    };
    
    render(<KanbanCard card={overdueCard} />);
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
  });

  it('renders without assignee', () => {
    const cardWithoutAssignee = {
      ...mockCard,
      assigneeId: null,
      assignee: null,
    };
    
    render(<KanbanCard card={cardWithoutAssignee} />);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('renders without labels', () => {
    const cardWithoutLabels = {
      ...mockCard,
      labels: [],
    };
    
    render(<KanbanCard card={cardWithoutLabels} />);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });
});
