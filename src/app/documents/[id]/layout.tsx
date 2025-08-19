// Generate static paths for static export
export async function generateStaticParams() {
  // In production, this would fetch from your API
  // For now, return some mock IDs to avoid build errors
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' }
  ];
}

export default function DocumentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}