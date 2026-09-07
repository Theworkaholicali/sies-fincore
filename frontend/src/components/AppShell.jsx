import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { canView } from "@/lib/perms";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Landmark, BookOpen, GraduationCap, PieChart,
  ShoppingBag, Boxes, Award, TrendingUp, FileText, ShieldCheck,
  FolderCheck, Sparkles, Settings, Search, Bell, Sun, Moon,
  ChevronLeft, LogOut, PanelLeftClose, PanelLeft, Command, CheckSquare,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const NAV = [
  { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard, path: "/" },
  { id: "finance", label: "Financial Control", icon: Landmark, path: "/finance" },
  { id: "accounting", label: "Accounting Engine", icon: BookOpen, path: "/accounting" },
  { id: "fees", label: "Student Fee Ledger", icon: GraduationCap, path: "/fees" },
  { id: "budget", label: "Budget Management", icon: PieChart, path: "/budget" },
  { id: "procurement", label: "Procurement & AP/AR", icon: ShoppingBag, path: "/procurement" },
  { id: "approvals", label: "Approval Workflows", icon: CheckSquare, path: "/approvals" },
  { id: "assets", label: "Asset Registry", icon: Boxes, path: "/assets" },
  { id: "grants", label: "Grants & Research", icon: Award, path: "/grants" },
  { id: "analytics", label: "Intelligence & Analytics", icon: TrendingUp, path: "/analytics" },
  { id: "reports", label: "Reports Center", icon: FileText, path: "/reports" },
  { id: "audit", label: "Audit Trail", icon: ShieldCheck, path: "/audit" },
  { id: "documents", label: "Document Vault", icon: FolderCheck, path: "/documents" },
  { id: "ai_assistant", label: "AI Finance Assistant", icon: Sparkles, path: "/ai" },
  { id: "administration", label: "Administration", icon: Settings, path: "/admin" },
];

const ROLE_LABELS = {
  super_admin: "Super Admin", management: "Management", principal: "Principal",
  finance_manager: "Finance Manager", accountant: "Accountant", auditor: "Auditor",
  department_head: "Department Head", procurement_officer: "Procurement Officer",
  student: "Student", vendor: "Vendor",
};

export default function AppShell() {
  const { user, logout, context } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [fy, setFy] = useState("2025-26");

  const items = NAV.filter((n) => canView(user.role, n.id));
  const current = NAV.find((n) => n.path === location.pathname) || items[0];

  useEffect(() => {
    api.get("/notifications").then((r) => setNotes(r.data)).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path) => {
    setCmdOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 sticky top-0 h-screen",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
        data-testid="app-sidebar"
      >
        <div className="flex items-center gap-2.5 h-16 px-4 border-b border-border shrink-0">
          <div className="rounded-md bg-white p-1 border border-border shrink-0">
            <img src="/sies-logo.jpg" alt="SIES" className="h-7 w-auto" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight truncate">
                SIES <span className="text-brand">FinCore</span>
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                Nerul, Navi Mumbai
              </p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-0.5">
          {items.map((n) => (
            <NavLink
              key={n.id}
              to={n.path}
              end={n.path === "/"}
              data-testid={`sidebar-module-${n.id}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-0"
                )
              }
              title={collapsed ? n.label : undefined}
            >
              <n.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{n.label}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => setCollapsed((c) => !c)}
          data-testid="sidebar-collapse-toggle"
          className="flex items-center gap-2 h-11 px-4 border-t border-border text-xs text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && "Collapse"}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="sticky top-0 z-40 h-16 border-b border-border bg-background/85 backdrop-blur-md flex items-center gap-3 px-4 sm:px-6"
          data-testid="global-header"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>SIES FinCore</span>
              <ChevronLeft className="h-3 w-3 rotate-180" />
              <span className="text-foreground font-medium truncate">
                {current?.label}
              </span>
            </div>
          </div>

          <button
            data-testid="command-search-trigger"
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-brand/40 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
            <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-border px-1.5 text-[10px] font-mono">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger
              className="w-[130px] h-9"
              data-testid="financial-year-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(context?.financial_years || [{ code: "2025-26" }]).map((f) => (
                <SelectItem key={f.code} value={f.code}>
                  FY {f.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <button
                data-testid="notifications-trigger"
                className="relative rounded-lg border border-border bg-card p-2 hover:border-brand/40 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {notes.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-brand text-[10px] font-bold text-white flex items-center justify-center">
                    {notes.length}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {notes.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No new notifications. All items are up to date.
                  </p>
                ) : (
                  notes.map((n, i) => (
                    <div key={i} className="px-4 py-3 border-b border-border/60 last:border-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            n.severity === "critical" ? "bg-negative" :
                            n.severity === "warning" ? "bg-warning" : "bg-info"
                          )}
                        />
                        <p className="text-sm font-medium">{n.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-4">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <button
            data-testid="theme-toggle-button"
            onClick={toggle}
            className="rounded-lg border border-border bg-card p-2 hover:border-brand/40 transition-colors"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                data-testid="user-menu-trigger"
                className="flex items-center gap-2 rounded-lg border border-border bg-card pl-1 pr-2.5 py-1 hover:border-brand/40 transition-colors"
              >
                <span className="h-7 w-7 rounded-md bg-brand/15 text-brand flex items-center justify-center text-xs font-bold">
                  {(user.name || "U").slice(0, 1)}
                </span>
                <span className="hidden lg:block text-left">
                  <span className="block text-xs font-semibold leading-tight max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-xs">
                Role: {ROLE_LABELS[user.role] || user.role}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                data-testid="logout-button"
                onClick={logout}
                className="text-negative focus:text-negative"
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <Outlet context={{ fy }} />
        </main>
      </div>

      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Jump to a module or run a command" data-testid="command-search-input" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {items.map((n) => (
              <CommandItem key={n.id} value={n.label} onSelect={() => go(n.path)}>
                <n.icon className="h-4 w-4 mr-2" />
                {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem value="toggle theme" onSelect={() => { toggle(); setCmdOpen(false); }}>
              {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              Toggle light / dark theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
