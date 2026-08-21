export default function GateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col bg-ink-deep text-text [color-scheme:dark]">
      {children}
    </div>
  );
}
