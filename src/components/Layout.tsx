import { ReactNode, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Calendar,
  Building2,
  UserCheck,
  LogOut,
  Award,
  ListChecks,
  Info,
  Menu,
  History,
  Bot,
  CheckSquare,
  KeyRound,
} from 'lucide-react';
import logo from '@/assets/logo-navy.jpg';
import logoWhite from '@/assets/logo-white.png';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface LayoutProps {
  children?: ReactNode;
}

const navigationGroups = [
  {
    label: 'Arbeitsbereich',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Audits', href: '/audits', icon: ClipboardCheck },
      { name: 'Aufgaben', href: '/tasks', icon: CheckSquare },
      { name: 'Kalender', href: '/calendar', icon: Calendar },
    ],
  },
  {
    label: 'Stammdaten',
    items: [
      { name: 'Kunden', href: '/clients', icon: Users },
      { name: 'Zertifizierer', href: '/certification-bodies', icon: Building2 },
      { name: 'Auditoren', href: '/auditors', icon: UserCheck },
      { name: 'Berater', href: '/consultants', icon: UserCheck },
    ],
  },
  {
    label: 'Verwaltung',
    items: [
      { name: 'Zertifizierungen', href: '/settings/certifications', icon: Award },
      { name: 'Audit-Vorlagen', href: '/settings/audit-templates', icon: ListChecks },
      { name: 'Aktivitäten', href: '/activity-log', icon: History },
      { name: 'Agenten', href: '/agents', icon: Bot },
    ],
  },
];

const isPathActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

const SIDEBAR_ACTION_CLASS =
  'flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60';

const SidebarContent = ({
  location,
  user,
  handleSignOut,
  onNavClick,
  onChangePassword,
}: {
  location: ReturnType<typeof useLocation>;
  user: User | null;
  handleSignOut: () => void;
  onNavClick?: () => void;
  onChangePassword: () => void;
}) => {
  const isAboutActive = location.pathname === '/about';

  return (
    <>
      <div className="flex h-[84px] shrink-0 items-center px-6">
        <img src={logoWhite} alt="cert consulting pane" className="h-12 w-auto" />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isPathActive(location.pathname, item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={onNavClick}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg px-3 py-[7px] text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                    )}
                    <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-sidebar-primary')} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-3 pb-2 pt-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[10.5px] font-semibold text-sidebar-accent-foreground">
            {user?.email?.substring(0, 2).toUpperCase()}
          </div>
          <span className="truncate text-xs text-sidebar-foreground/75" title={user?.email}>
            {user?.email}
          </span>
        </div>
        <Link
          to="/about"
          onClick={onNavClick}
          aria-current={isAboutActive ? 'page' : undefined}
          className={cn(SIDEBAR_ACTION_CLASS, isAboutActive && 'bg-sidebar-accent text-sidebar-accent-foreground')}
        >
          <Info className="h-4 w-4 shrink-0" />
          Über diese Software
        </Link>
        <button
          type="button"
          className={SIDEBAR_ACTION_CLASS}
          onClick={() => {
            onNavClick?.();
            onChangePassword();
          }}
        >
          <KeyRound className="h-4 w-4 shrink-0" />
          Passwort ändern
        </button>
        <button type="button" className={SIDEBAR_ACTION_CLASS} onClick={handleSignOut}>
          <LogOut className="h-4 w-4 shrink-0" />
          Abmelden
        </button>
      </div>
    </>
  );
};

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const scrollRef = useScrollPersistence();

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Mobile Header - Compact and modern */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-3 h-14 bg-card border-b border-border/70 shadow-xs safe-top">
          <div className="flex items-center gap-2">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[80%] max-w-[320px] p-0 bg-sidebar border-sidebar-border [&>button]:text-sidebar-foreground" aria-describedby={undefined}>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex flex-col h-full">
                  <SidebarContent
                    location={location}
                    user={user}
                    handleSignOut={handleSignOut}
                    onNavClick={() => setSheetOpen(false)}
                    onChangePassword={() => setPasswordDialogOpen(true)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <img src={logo} alt="cert consulting" className="h-8 w-auto ml-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary">
              {user?.email?.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col pb-16">
          {['/audits', '/tasks'].includes(location.pathname) ? (
            children || <Outlet />
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-auto">
              {children || <Outlet />}
            </div>
          )}
        </main>

        {/* Bottom Navigation for Mobile Auth Users */}
        {user && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-md border-t border-border/70 flex items-center justify-around px-2 z-50 shadow-[0_-4px_16px_hsl(215_45%_14%/0.05)] safe-bottom">
            {[
              { name: 'Dashboard', href: '/', icon: LayoutDashboard },
              { name: 'Kunden', href: '/clients', icon: Users },
              { name: 'Audits', href: '/audits', icon: ClipboardCheck },
              { name: 'Aufgaben', href: '/tasks', icon: CheckSquare },
            ].map((item) => {
              const isActive = isPathActive(location.pathname, item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 w-20 h-full transition-all duration-300",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-xl transition-all duration-300",
                    isActive ? "bg-primary/10" : ""
                  )}>
                    <item.icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold tracking-tight transition-all duration-300",
                    isActive ? "opacity-100" : "opacity-80"
                  )}>
                    {item.name}
                  </span>
                  {isActive && (
                    <div className="absolute -top-[1px] w-10 h-[3px] bg-primary rounded-b-full animate-fade-in" />
                  )}
                </Link>
              );
            })}
          </nav>
        )}
        <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
      </div>
    );
  }


  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar flex flex-col sticky top-0 h-screen">
        <SidebarContent
          location={location}
          user={user}
          handleSignOut={handleSignOut}
          onChangePassword={() => setPasswordDialogOpen(true)}
        />
      </aside>

      {/* Main Content - overflow-hidden so children can use h-full reliably */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        {['/audits', '/tasks'].includes(location.pathname) ? (
          children || <Outlet />
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-auto">
            {children || <Outlet />}
          </div>
        )}
      </main>
      <ChangePasswordDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
    </div>
  );
};
