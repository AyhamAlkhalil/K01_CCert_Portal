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
  ChevronDown,
  ChevronRight,
  Menu,
  History,
  Bot,
  CheckSquare,
  KeyRound,
} from 'lucide-react';
import logo from '@/assets/logo-navy.jpg';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from './ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollPersistence } from '@/hooks/useScrollPersistence';
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface LayoutProps {
  children?: ReactNode;
}

const mainNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Audits', href: '/audits', icon: ClipboardCheck },
  { name: 'Aufgaben', href: '/tasks', icon: CheckSquare },
  { name: 'Kunden', href: '/clients', icon: Users },
  { name: 'Zertifizierer', href: '/certification-bodies', icon: Building2 },
  { name: 'Auditoren', href: '/auditors', icon: UserCheck },
  { name: 'Berater', href: '/consultants', icon: UserCheck },
  { name: 'Kalender', href: '/calendar', icon: Calendar },
  { name: 'Aktivitäten', href: '/activity-log', icon: History },
  { name: 'Agenten', href: '/agents', icon: Bot },
];

const settingsNavigation = [
  { name: 'Zertifizierungen', href: '/settings/certifications', icon: Award },
  { name: 'Audit-Vorlagen', href: '/settings/audit-templates', icon: ListChecks },
];

const SidebarContent = ({
  location,
  settingsOpen,
  setSettingsOpen,
  user,
  handleSignOut,
  onNavClick,
  onChangePassword,
}: {
  location: ReturnType<typeof useLocation>;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  user: User | null;
  handleSignOut: () => void;
  onNavClick?: () => void;
  onChangePassword: () => void;
}) => {
  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <>
      <div className="flex items-center justify-center p-4 bg-white border-b border-sidebar-border shrink-0">
        <img src={logo} alt="cert consulting" className="h-12 w-auto" />
      </div>
      <nav className="p-4 space-y-1 flex-1 overflow-hidden">
        {mainNavigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="font-medium truncate">{item.name}</span>
            </Link>
          );
        })}

        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                'flex items-center justify-between w-full px-3 py-2 rounded-lg transition-colors text-sm',
                isSettingsActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <div className="flex items-center gap-3">
                <ListChecks className="h-4 w-4 shrink-0" />
                <span className="font-medium truncate">Vorlagen</span>
              </div>
              {settingsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 ml-4 space-y-1">
            {settingsNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={onNavClick}
                  className={cn(
                    'flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="text-sm text-muted-foreground truncate px-2">
          {user?.email}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            onNavClick?.();
            onChangePassword();
          }}
        >
          <KeyRound className="h-4 w-4" />
          Passwort ändern
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </Button>
      </div>
    </>
  );
};

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(
    location.pathname.startsWith('/settings')
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const scrollRef = useScrollPersistence();

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Mobile Header - Compact and modern */}
        <header className="sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur-md border-b border-border/50 safe-top">
          <div className="flex items-center gap-2">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[80%] max-w-[320px] p-0 bg-sidebar border-sidebar-border">
                <div className="flex flex-col h-full">
                  <SidebarContent
                    location={location}
                    settingsOpen={settingsOpen}
                    setSettingsOpen={setSettingsOpen}
                    user={user}
                    handleSignOut={handleSignOut}
                    onNavClick={() => setSheetOpen(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <img src={logo} alt="cert consulting" className="h-8 w-auto ml-1" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary border border-primary/20 shadow-sm">
              {user?.email?.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col pb-16">
          {['/audits', '/tasks'].includes(location.pathname) ? (
            children || <Outlet />
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-auto bg-muted/5">
              {children || <Outlet />}
            </div>
          )}
        </main>

        {/* Bottom Navigation for Mobile Auth Users */}
        {user && (
          <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-border/40 flex items-center justify-around px-2 z-50 shadow-[0_-5px_15px_rgba(0,0,0,0.03)] safe-bottom">
            {[
              { name: 'Dashboard', href: '/', icon: LayoutDashboard },
              { name: 'Kunden', href: '/clients', icon: Users },
              { name: 'Audits', href: '/audits', icon: ClipboardCheck },
              { name: 'Aufgaben', href: '/tasks', icon: CheckSquare },
            ].map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 w-20 h-full transition-all duration-300",
                    isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-xl transition-all duration-300",
                    isActive ? "bg-primary/10 scale-110 shadow-sm" : ""
                  )}>
                    <item.icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold tracking-tight transition-all duration-300",
                    isActive ? "opacity-100" : "opacity-70"
                  )}>
                    {item.name}
                  </span>
                  {isActive && (
                    <div className="absolute -top-[1px] w-10 h-[3px] bg-primary rounded-b-full shadow-[0_2px_8px_rgba(37,99,235,0.4)] animate-fade-in" />
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    );
  }


  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0 h-screen">
        <SidebarContent
          location={location}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          user={user}
          handleSignOut={handleSignOut}
        />
      </aside>

      {/* Main Content - overflow-hidden so children can use h-full reliably */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {['/audits', '/tasks'].includes(location.pathname) ? (
          children || <Outlet />
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-auto">
            {children || <Outlet />}
          </div>
        )}
      </main>
    </div>
  );
};
