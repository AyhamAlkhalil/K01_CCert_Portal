import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpiringCertificationsCard } from "@/components/ExpiringCertificationsCard";
import { ExpiringWithoutAuditCard } from "@/components/ExpiringWithoutAuditCard";
import { DataQualityWarningsCard } from "@/components/DataQualityWarningsCard";
import { AuditYearStatsCard } from "@/components/AuditYearStatsCard";
import { CertificationYearStatsCard } from "@/components/CertificationYearStatsCard";
import { DashboardAIChat } from "@/components/DashboardAIChat";
import { useCertificationBodyStats } from "@/hooks/useCertificationBodies";
import { useState, useEffect } from "react";

const GREETINGS: Record<string, string> = {
  DE: "Willkommen im Portal von",
  AT: "Willkommen im Portal von",
  CH: "Willkommen im Portal von",
  US: "Welcome to the portal of",
  GB: "Welcome to the portal of",
  FR: "Bienvenue sur le portail de",
  IT: "Benvenuti nel portale di",
  ES: "Bienvenido al portal de",
  NL: "Welkom op het portaal van",
  PL: "Witamy w portalu",
  PT: "Bem-vindo ao portal de",
  BE: "Bienvenue sur le portail de",
  CZ: "Vítejte v portálu",
};

const SECONDARY_GREETINGS = [
  "Welcome to the portal of",
  "Bienvenue sur le portail de",
  "Benvenuti nel portale di",
  "Bienvenido al portal de",
  "Witamy w portalu",
];

const Dashboard = () => {
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: bodyStats = [] } = useCertificationBodyStats();

  const [greetingIndex, setGreetingIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const availableGreetings = useMemo(() => {
    const countries = new Set<string>();
    clients.forEach((c) => {
      if (c.country) countries.add(c.country.toUpperCase());
    });

    const list = ["Willkommen im Portal von"];
    countries.forEach(country => {
      const g = GREETINGS[country];
      if (g && !list.includes(g)) {
        list.push(g);
      }
    });

    // Ensure we have a few if no countries found
    if (list.length < 3) {
      SECONDARY_GREETINGS.forEach(g => {
        if (!list.includes(g)) list.push(g);
      });
    }

    return list;
  }, [clients]);

  useEffect(() => {
    if (availableGreetings.length <= 1) return;

    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setGreetingIndex((prev) => (prev + 1) % availableGreetings.length);
        setFade(true);
      }, 500); // Wait for fade out
    }, 4000);

    return () => clearInterval(interval);
  }, [availableGreetings]);

  const clientStats = useMemo(() => {
    // Nur echte Kunden zählen (Gruppen-Header haben client_number === null)
    const realClients = clients.filter((c) => c.client_number !== null);
    const totalClients = realClients.length;
    const activeClients = realClients.filter((c) => c.is_active !== false).length;
    const inactiveClients = totalClients - activeClients;

    // Unternehmensgruppen = Einträge ohne client_number (reine Dach-Container)
    const totalGroups = clients.filter((c) => c.client_number === null).length;

    return {
      totalClients,
      activeClients,
      inactiveClients,
      totalGroups,
    };
  }, [clients]);

  if (clientsLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-fade-in safe-bottom">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent italic">Dashboard</h1>
        <p className="text-sm text-muted-foreground transition-opacity duration-500 min-h-[1.5rem]" style={{ opacity: fade ? 1 : 0 }}>
          {availableGreetings[greetingIndex]} <span className="font-semibold text-foreground">certconsulting pane.</span>
        </p>
      </div>

      <DashboardAIChat className="-mx-1 sm:mx-0" />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="flex flex-col h-full bg-primary/[0.03] border-primary/10 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 px-4 pt-4 border-b border-primary/5">
            <CardTitle className="flex items-center justify-between text-sm sm:text-base">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="h-4 w-4" strokeWidth={2.5} />
                Kundenübersicht
              </div>
              <span className="text-xl font-bold text-primary">{clientStats.totalClients}</span>
            </CardTitle>
            <p className="text-[10px] text-primary/60 mt-0.5 uppercase tracking-wider font-medium">Aktueller Stand</p>
          </CardHeader>
          <CardContent className="p-4 flex-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate mr-2">Kunden (gesamt)</span>
                <span className="font-semibold tabular-nums">{clientStats.totalClients}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate mr-2">Kunden (aktiv)</span>
                <span className="font-semibold text-green-600 tabular-nums">{clientStats.activeClients}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate mr-2">Kunden (inaktiv)</span>
                <span className="font-semibold text-destructive tabular-nums">{clientStats.inactiveClients}</span>
              </div>

              {bodyStats.length > 0 && (
                <div className="flex flex-col mt-4">
                  <div className="border-t border-primary/10 my-3" />
                  <p className="text-[10px] text-primary/70 font-bold uppercase tracking-widest pb-2">
                    Zertifizierungen je Zertifizierer
                  </p>
                  <div className="max-h-[160px] lg:max-h-[120px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent">
                    {bodyStats.map((stat) => (
                      <div key={stat.bodyId} className="flex items-center justify-between text-xs py-0.5 border-b border-primary/[0.02] last:border-0 hover:bg-primary/[0.02] rounded px-1 -mx-1 transition-colors">
                        <span className="text-muted-foreground truncate mr-2" title={stat.bodyName}>
                          {stat.bodyShortName || stat.bodyName}
                        </span>
                        <span className="font-bold tabular-nums text-primary/80">{stat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <AuditYearStatsCard />
        <CertificationYearStatsCard />
      </div>

      {/* Rows: Expiring and Quality */}
      <div className="grid grid-cols-1 gap-6">
        <ExpiringWithoutAuditCard />
        <ExpiringCertificationsCard />
        <DataQualityWarningsCard />
      </div>
    </div>
  );

};

export default Dashboard;
