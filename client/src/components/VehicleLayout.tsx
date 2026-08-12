import { HardDrive, Wifi, WifiOff } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

interface VehicleLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function VehicleLayout({ children, title, subtitle }: VehicleLayoutProps) {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground" aria-live="polite">
            <HardDrive className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">端末内に保存</span>
            <span className="rounded-full px-2 py-1" style={{ backgroundColor: online ? "#dcfce7" : "#fef3c7", color: online ? "#166534" : "#92400e" }}>
              {online ? <Wifi className="mr-1 inline h-3 w-3" aria-hidden="true" /> : <WifiOff className="mr-1 inline h-3 w-3" aria-hidden="true" />}
              {online ? "オンライン" : "オフライン"}
            </span>
          </div>
        </div>
      </header>
      <main className="container py-6 sm:py-8">{children}</main>
    </div>
  );
}
