import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Boards',
};

export default function BoardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

