export default function GateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col bg-neutral-950 text-neutral-50 [--background:#0a0a0a] [--foreground:#ededed] [color-scheme:dark]">
      {children}
    </div>
  );
}
