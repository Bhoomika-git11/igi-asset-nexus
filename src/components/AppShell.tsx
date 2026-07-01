import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Boxes, BarChart3, Upload, Download, ScrollText,
  Users, AlertTriangle, Printer, FolderTree, LogOut, Plane, Settings2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/categories", label: "Categories", icon: FolderTree },
  { to: "/alerts", label: "Low Stock Alerts", icon: AlertTriangle },
  { to: "/import", label: "Excel Import", icon: Upload },
  { to: "/export", label: "Export Data", icon: Download },
  { to: "/print", label: "Print Report", icon: Printer },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
  { to: "/users", label: "User Management", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-72 shrink-0 border-r border-border/40 glass-strong sticky top-0 h-screen flex flex-col">
        <div className="p-6 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-glow to-electric flex items-center justify-center animate-pulse-glow">
                <Plane className="w-6 h-6 text-navy-deep" />
              </div>
            </div>
            <div>
              <div className="font-bold text-glow text-lg leading-none">IGI Portal</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">AAI · Asset Ops</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className="block">
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-primary/15 text-cyan-glow shadow-[0_0_20px_oklch(0.72_0.18_220/0.15)_inset]"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-gradient-to-b from-cyan-glow to-electric" />}
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-electric to-cyan-glow flex items-center justify-center text-xs font-bold text-navy-deep">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-cyan-glow">{role ?? "..."}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive text-xs font-medium py-2 transition">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 relative">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="relative">
          {children}
        </div>
      </main>
    </div>
  );
}
