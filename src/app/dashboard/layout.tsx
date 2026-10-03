import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — CAA League',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
