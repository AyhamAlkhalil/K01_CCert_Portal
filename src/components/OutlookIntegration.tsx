import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Check, Cloud, RefreshCw, Unplug, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OutlookIntegrationProps {
  auditCount?: number;
  audits?: Array<{
    id: string;
    clientName: string;
    type: string;
    status: string;
    scheduledDate: string;
    certifications?: string[];
    notes?: string;
    clientAddress?: string;
    eventType?: 'audit' | 'certification';
    isAllDay?: boolean;
    title?: string;
  }>;
}

export const OutlookIntegration = ({ auditCount = 0, audits = [] }: OutlookIntegrationProps) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncedEvents, setSyncedEvents] = useState(0);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
    
    // Listen for OAuth callback messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'outlook-auth-success') {
        setIsConnected(true);
        setIsConnecting(false);
        toast({
          title: "Outlook verbunden",
          description: "Ihr Microsoft-Konto wurde erfolgreich verknüpft.",
        });
      } else if (event.data?.type === 'outlook-auth-error') {
        setIsConnecting(false);
        toast({
          title: "Verbindungsfehler",
          description: typeof event.data?.error === 'string' && event.data.error.trim().length > 0
            ? event.data.error
            : "Die Authentifizierung ist fehlgeschlagen.",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) {
      setIsCheckingStatus(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsCheckingStatus(false);
        return;
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const statusResponse = await fetch(`${baseUrl}/functions/v1/outlook-auth?action=status`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await statusResponse.json();
      setIsConnected(data.connected === true);
    } catch (error) {
      console.error('Error checking Outlook status:', error);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleConnect = async () => {
    if (!user) {
      toast({
        title: "Nicht angemeldet",
        description: "Bitte melden Sie sich zuerst an.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session');
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${baseUrl}/functions/v1/outlook-auth?action=get-auth-url`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.authUrl) {
        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        window.open(
          data.authUrl,
          'outlook-oauth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error) {
      console.error('Error connecting to Outlook:', error);
      setIsConnecting(false);
      toast({
        title: "Verbindungsfehler",
        description: "Konnte keine Verbindung zu Microsoft herstellen.",
        variant: "destructive",
      });
    }
  };

  const handleSync = async () => {
    if (!user || audits.length === 0) {
      toast({
        title: "Keine Termine",
        description: "Es gibt keine Audits zum Synchronisieren.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session');
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${baseUrl}/functions/v1/outlook-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audits }),
      });

      const data = await response.json();

      if (data.reconnectRequired) {
        setIsConnected(false);
        toast({
          title: "Erneute Anmeldung erforderlich",
          description: "Bitte verbinden Sie Ihr Outlook-Konto erneut.",
          variant: "destructive",
        });
        return;
      }

      if (data.success) {
        setLastSynced(new Date());
        setSyncedEvents(data.synced);
        toast({
          title: "Synchronisierung abgeschlossen",
          description: `${data.synced} Audit-Termine wurden mit Outlook synchronisiert.${data.failed > 0 ? ` ${data.failed} fehlgeschlagen.` : ''}`,
        });
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Error syncing to Outlook:', error);
      toast({
        title: "Synchronisierungsfehler",
        description: "Die Termine konnten nicht synchronisiert werden.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No session');
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${baseUrl}/functions/v1/outlook-auth?action=disconnect`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      setIsConnected(false);
      setLastSynced(null);
      setSyncedEvents(0);
      
      toast({
        title: "Verbindung getrennt",
        description: "Die Outlook-Integration wurde deaktiviert.",
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Fehler",
        description: "Verbindung konnte nicht getrennt werden.",
        variant: "destructive",
      });
    }
  };

  if (isCheckingStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              isConnected ? "bg-success/10" : "bg-muted"
            )}>
              <Cloud className={cn(
                "h-5 w-5",
                isConnected ? "text-success" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <CardTitle className="text-base">Microsoft Outlook</CardTitle>
              <CardDescription className="text-xs">
                Kalendersynchronisierung
              </CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className={cn(
            "shrink-0 whitespace-nowrap",
            isConnected && "bg-success/[0.12] text-success border-success/30"
          )}>
            {isConnected ? "Verbunden" : "Nicht verbunden"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Verfügbare Termine</span>
              <span className="font-medium text-foreground">{auditCount}</span>
            </div>
            {lastSynced && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Letzte Synchronisierung</span>
                <span className="font-medium text-foreground">
                  {lastSynced.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ({syncedEvents} Termine)
                </span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={handleSync}
                disabled={isSyncing || auditCount === 0}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {isSyncing ? "Synchronisiere..." : "Jetzt synchronisieren"}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleDisconnect}
              >
                <Unplug className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Verbinden Sie Ihr Microsoft-Konto, um Audit-Termine in Ihren Outlook-Kalender zu übertragen.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-success" />
                Termine zu Outlook hinzufügen
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-success" />
                Kundendetails im Termin
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-success" />
                Sichere OAuth-Verbindung
              </li>
            </ul>
            <Button 
              className="w-full" 
              onClick={handleConnect}
              disabled={isConnecting || !user}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              {isConnecting ? "Verbinde..." : "Mit Microsoft anmelden"}
            </Button>
            {!user && (
              <p className="text-xs text-muted-foreground text-center">
                Bitte melden Sie sich an, um Outlook zu verbinden.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
