import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
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
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in safe-bottom">
      <PageHeader
        title="Dashboard"
        description={
          <span className="transition-opacity duration-500" style={{ opacity: fade ? 1 : 0 }}>
            {availableGreetings[greetingIndex]} <span className="font-medium text-foreground">cert consulting pane</span>
          </span>
        }
      />

      <DashboardAIChat />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="flex flex-col h-full">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-start justify-between gap-3 text-[15px]">
              <span className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                Kundenübersicht
              </span>
              <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">{clientStats.totalClients}</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Aktueller Stand</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 flex-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground truncate mr-2">Kunden (gesamt)</span>
                <span className="font-medium tabular-nums">{clientStats.totalClients}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground truncate mr-2">Kunden (aktiv)</span>
                <span className="font-medium text-success tabular-nums">{clientStats.activeClients}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground truncate mr-2">Kunden (inaktiv)</span>
                <span className="font-medium text-destructive tabular-nums">{clientStats.inactiveClients}</span>
              </div>

              {bodyStats.length > 0 && (
                <div className="flex flex-col mt-4 border-t border-border/70 pt-4">
                  <p className="eyebrow pb-2.5">Zertifizierungen je Zertifizierer</p>
                  <div className="max-h-[160px] lg:max-h-[120px] overflow-y-auto space-y-2">
                    {bodyStats.map((stat) => (
                      <div key={stat.bodyId} className="flex items-center justify-between text-[13px]">
                        <span className="text-muted-foreground truncate mr-2" title={stat.bodyName}>
                          {stat.bodyShortName || stat.bodyName}
                        </span>
                        <span className="font-medium tabular-nums">{stat.count}</span>
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
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <ExpiringWithoutAuditCard />
        <ExpiringCertificationsCard />
        <DataQualityWarningsCard />
      </div>
    </div>
  );

};

export default Dashboard;
