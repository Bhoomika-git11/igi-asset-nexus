import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Boxes, BarChart3, Upload, Download, ScrollText,
  Users, AlertTriangle, Printer, FolderTree, LogOut, Settings2, Menu, X, ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, roleLabel } from "@/lib/auth";
import { AAILogo } from "@/components/AAILogo";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "viewer"] },
  { to: "/inventory", label: "Inventory", icon: Boxes, roles: ["admin", "manager", "viewer"] },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, roles: ["admin", "manager"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/categories", label: "Categories", icon: FolderTree, roles: ["admin", "manager"] },
  { to: "/alerts", label: "Low Stock Alerts", icon: AlertTriangle, roles: ["admin", "manager"] },
  { to: "/import", label: "Excel Import", icon: Upload, roles: ["admin"] },
  { to: "/export", label: "Export Data", icon: Download, roles: ["admin", "manager", "viewer"] },
  { to: "/print", label: "Print Report", icon: Printer, roles: ["admin", "manager", "viewer"] },
  { to: "/audit", label: "Audit Log", icon: ScrollText, roles: ["admin"] },
  { to: "/users", label: "User Management", icon: Users, roles: ["admin", "manager"] },
  { to: "/settings", label: "Settings", icon: Settings2, roles: ["admin", "manager", "viewer"] },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  };

  const SidebarInner = (
    <>
      <div className="p-6 border-b border-border/40">
        <div className="flex items-center gap-3 min-w-0">
          <AAILogo className="w-11 h-11 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-glow text-sm leading-tight truncate">Airports Authority</div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-glow mt-0.5">of India · AAI</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.filter((item) => !role || (item.roles as readonly string[]).includes(role)).map((item) => {
          const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              preload="intent"
              onClick={() => setMobileOpen(false)}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition hover:translate-x-1 ${
                active
                  ? "bg-primary/15 text-cyan-glow shadow-[0_0_20px_oklch(0.72_0.18_220/0.15)_inset]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-gradient-to-b from-cyan-glow to-electric" />}
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

      </nav>

      <div className="p-4 border-t border-border/40">
        <div className="flex items-center gap-3 mb-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-electric to-cyan-glow flex items-center justify-center text-xs font-bold text-navy-deep">
            {user?.email?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">{user?.email}</div>
            <div className="text-[10px] uppercase tracking-wider text-cyan-glow">{roleLabel(role)}</div>

          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive text-xs font-medium py-2 transition">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 border-r border-border/40 glass-strong sticky top-0 h-screen flex-col">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed left-0 top-0 h-full w-72 z-50 glass-strong border-r border-border/40 flex flex-col lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-white/10 text-muted-foreground"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
              {SidebarInner}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0 relative animate-bg-drift">
        {/* Top navbar */}
        <div className="sticky top-0 z-20 backdrop-blur-xl bg-navy-deep/40 border-b border-cyan-glow/30 shadow-[0_1px_0_0_oklch(0.82_0.17_200/0.35),0_8px_30px_-10px_oklch(0.82_0.17_200/0.25)]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 py-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md hover:bg-white/10 text-cyan-glow"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <AAILogo className="w-8 h-8 shrink-0" />
              <div className="text-xs sm:text-sm font-semibold tracking-tight truncate">Airports Authority of India</div>
              <span className="ml-2 text-[10px] uppercase tracking-widest text-cyan-glow/80 hidden md:inline shrink-0">IT Asset Command Center</span>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground hidden sm:block truncate max-w-[40vw]">{roleLabel(role)} · {user?.email}</div>
          </div>
        </div>
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
