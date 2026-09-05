import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "./Wordmark";
import { UserAvatar } from "./UserAvatar";
import { NotificationsList } from "./NotificationsPanel";
import { getProfile, type Profile } from "@/lib/api";
import {
  ensureBirthdayReminders,
  unreadNotificationsCount,
  useBellBounce,
  useNotificationsRealtime,
} from "@/lib/notifications";
import { fetchInbox } from "@/lib/messaging";
import { cn } from "@/lib/utils";


const NAV = [
  { to: "/feed", label: "Feed" },
  { to: "/friends", label: "Friends" },
  { to: "/groups", label: "Groups" },
  { to: "/pages", label: "Pages" },
  { to: "/messages", label: "Messages" },
  { to: "/notifications", label: "Notifications" },
] as const;

export function AppShell({
  userId,
  children,
  rail,
}: {
  userId: string;
  children: ReactNode;
  rail?: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");

  const { data: me } = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const { data: unreadNotes = 0 } = useQuery({
    queryKey: ["unread-notifications", userId],
    queryFn: () => unreadNotificationsCount(userId),
    refetchInterval: 60000,
  });

  useNotificationsRealtime(userId, () => {
    queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });
    queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  });

  useEffect(() => {
    void ensureBirthdayReminders();
  }, [userId]);

  const { data: threads = [] } = useQuery({
    queryKey: ["inbox", userId],
    queryFn: () => fetchInbox(userId),
    refetchInterval: 30000,
  });
  const unreadMessages = threads.reduce(
    (sum, t) => sum + (t.state === "accepted" && !t.archived && t.unread > 0 ? 1 : 0),
    0,
  );

  const badgeFor = (to: string) =>
    to === "/messages" ? unreadMessages : to === "/notifications" ? unreadNotes : 0;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!term.trim()) return;
    navigate({ to: "/search", search: { q: term.trim() } });
  }

  return (
    <div className="min-h-screen bg-bone text-ink">
      <div className="chrome-bar h-1.5 w-full" />

      <header className="sticky top-0 z-30 border-b border-ink/10 bg-bone/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-5 py-3">
          <Link to="/feed" aria-label="FlowText home">
            <Wordmark className="text-2xl" />
          </Link>

          <form onSubmit={submitSearch} className="ml-auto hidden sm:block">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search people, posts, groups"
              aria-label="Search FlowText"
              className="w-64 rounded-full bg-bone-soft px-4 py-1.5 text-sm text-ink ring-1 ring-ink/10 outline-none placeholder:text-ink-soft/70 focus:ring-teal/40"
            />
          </form>

          <NotificationBell userId={userId} unread={unreadNotes} />

          <Link
            to="/profile/$userId"
            params={{ userId }}
            className="sm:ml-0"
            aria-label="Your profile"
          >
            <UserAvatar
              name={me?.display_name ?? "You"}
              src={me?.avatar_url}
              className="size-9 ring-1 ring-ink/10"
            />
          </Link>
          <HamburgerMenu me={me} onSignOut={signOut} />

        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-5 py-6 pb-24 lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:pb-6">
        <nav className="hidden lg:block">
          <ul className="font-display sticky top-24 space-y-1">
            {NAV.map((item) => {
              const badge = badgeFor(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    activeProps={{ className: "bg-ink text-bone" }}
                    inactiveProps={{ className: "text-ink-soft hover:bg-bone-soft" }}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold"
                  >
                    <span>{item.label}</span>
                    {badge > 0 && (
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-full text-[11px] font-bold",
                          item.to === "/notifications" ? "bg-amber text-ink" : "bg-clay text-bone",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            <li className="pt-2">
              <Link
                to="/settings"
                className="flex rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-bone-soft"
              >
                Profile settings
              </Link>
              <Link
                to="/account"
                className="flex rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-bone-soft"
              >
                Account settings
              </Link>
            </li>
          </ul>
        </nav>

        <main className="min-w-0">{children}</main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-5">{rail}</div>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-bone/95 backdrop-blur-sm lg:hidden">
        <div className="font-display mx-auto flex max-w-[1440px] items-center justify-around px-3 py-2">
          {NAV.map((item) => {
            const badge = badgeFor(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "text-ink" }}
                inactiveProps={{ className: "text-ink-soft" }}
                className="relative px-1 text-[11px] font-semibold"
              >
                {item.label}
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-clay text-[9px] font-bold text-bone">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HamburgerMenu({
  me,
  onSignOut,
}: {
  me: Profile | null | undefined;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("flowtext-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  function go(to: string) {
    setOpen(false);
    navigate({ to });
  }

  const itemCls =
    "font-display flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-bone-soft";

  const body = (
    <div className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
      {/* Your profile */}
      <Link
        to="/profile/$userId"
        params={{ userId: me?.id ?? "" }}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-xl p-2 hover:bg-bone-soft"
      >
        <UserAvatar name={me?.display_name ?? "You"} src={me?.avatar_url} className="size-10" />
        <span className="min-w-0">
          <span className="font-display block truncate text-sm font-bold text-ink">
            {me?.display_name ?? "Your profile"}
          </span>
          <span className="block text-xs text-ink-soft">See your profile</span>
        </span>
      </Link>

      <div className="my-1 border-t border-ink/10" />

      {/* Settings & Privacy */}
      <button onClick={() => setPrivacyOpen((v) => !v)} className={itemCls} aria-expanded={privacyOpen}>
        <Settings className="size-4 text-ink-soft" />
        <span className="flex-1">Settings &amp; Privacy</span>
        {privacyOpen ? (
          <ChevronDown className="size-4 text-ink-soft" />
        ) : (
          <ChevronRight className="size-4 text-ink-soft" />
        )}
      </button>
      {privacyOpen && (
        <div className="ml-9 space-y-0.5">
          <button onClick={() => go("/settings")} className={cn(itemCls, "text-xs font-medium")}>
            Settings
          </button>
          <button onClick={() => go("/account")} className={cn(itemCls, "text-xs font-medium")}>
            Privacy Checkup
          </button>
          <button onClick={() => go("/account")} className={cn(itemCls, "text-xs font-medium")}>
            Privacy Center
          </button>
        </div>
      )}

      <button onClick={() => go("/account")} className={itemCls}>
        <Bell className="size-4 text-ink-soft" />
        Notifications settings
      </button>

      <button onClick={toggleDark} className={itemCls}>
        {dark ? <Sun className="size-4 text-ink-soft" /> : <Moon className="size-4 text-ink-soft" />}
        <span className="flex-1">Display</span>
        <span className="text-xs font-medium text-ink-soft">{dark ? "Dark" : "Light"}</span>
      </button>

      <button onClick={() => go("/help")} className={itemCls}>
        <CircleHelp className="size-4 text-ink-soft" />
        Help &amp; Support
      </button>

      <div className="my-1 border-t border-ink/10" />

      <button
        onClick={() => {
          setOpen(false);
          onSignOut();
        }}
        className={cn(itemCls, "text-clay-deep")}
      >
        <LogOut className="size-4" />
        Log Out
      </button>
    </div>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-full bg-bone-soft text-ink ring-1 ring-ink/10 hover:ring-teal/40"
      >
        <Menu className="size-5" />
      </button>

      {/* Desktop dropdown */}
      {open && (
        <div className="absolute right-0 top-11 z-50 hidden w-80 rounded-2xl bg-card shadow-xl ring-1 ring-ink/10 sm:block">
          {body}
        </div>
      )}

      {/* Mobile slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-80 max-w-[85vw] animate-in slide-in-from-right bg-card shadow-xl duration-200">
            {body}
          </aside>
        </div>
      )}
    </div>
  );
}

export function RailCard({
  title,
  children,
  tone = "soft",
}: {
  title: string;
  children: ReactNode;
  tone?: "soft" | "plain";
}) {
  return (
    <section
      className={cn(
        "rounded-2xl p-4 ring-1 ring-black/5",
        tone === "soft" ? "bg-bone-soft/60" : "bg-card",
      )}
    >
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink-soft">{children}</p>;
}
