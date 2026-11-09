import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  useCertificationAudits, 
  useDeleteCertificationAudit,
  CertificationAudit 
} from '@/hooks/useCertificationAudits';
import { CertificationAuditDialog } from './CertificationAuditDialog';
import { AuditorPopover } from './AuditorPopover';
import { 
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ClipboardCheck,
  Pencil,
  Trash2,
  ExternalLink,
  User,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { AUDIT_TYPE_LABELS } from '@/lib/constants';

interface CertificationAuditsListProps {
  clientCertificationId: string;
  clientId: string;
  certificationId: string;
  certificationName: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'scheduled':
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Geplant
        </Badge>
      );
    case 'in-progress':
      return (
        <Badge className="gap-1 bg-amber-500 text-amber-950 border-transparent">
          <AlertCircle className="h-3 w-3" />
          In Bearbeitung
        </Badge>
      );
    case 'completed':
      return (
        <Badge className="gap-1 bg-success text-success-foreground border-transparent">
          <CheckCircle className="h-3 w-3" />
          Abgeschlossen
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Abgebrochen
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getAuditTypeBadge = (type: string) => {
  const label = AUDIT_TYPE_LABELS[type as keyof typeof AUDIT_TYPE_LABELS] || type;
  const colors: Record<string, string> = {
    'initial': 'bg-violet-500/[0.12] text-violet-700 border-violet-500/30',
    'surveillance': 'bg-amber-500/[0.15] text-amber-800 border-amber-500/40',
    'recertification': 'bg-success/[0.12] text-success border-success/30',
    'six-month': 'bg-cyan-500/10 text-cyan-700 border-cyan-500/30',
  };

  return (
    <Badge variant="outline" className={`${colors[type] || ''}`}>
      {label}
    </Badge>
  );
};

export const CertificationAuditsList = ({ 
  clientCertificationId, 
  clientId,
  certificationId,
  certificationName 
}: CertificationAuditsListProps) => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAudit, setEditingAudit] = useState<CertificationAudit | null>(null);
  const [presetType, setPresetType] = useState<string | null>(null);
  const [presetDate, setPresetDate] = useState<string | null>(null);
  
  const { data: audits = [], isLoading } = useCertificationAudits(clientCertificationId);
  const deleteAudit = useDeleteCertificationAudit();

  const handleEdit = (audit: CertificationAudit) => {
    setEditingAudit(audit);
    setDialogOpen(true);
  };

  const handleCreate = (type?: string, date?: string) => {
    setEditingAudit(null);
    setPresetType(type || null);
    setPresetDate(date || null);
    setDialogOpen(true);
  };

  const handleDelete = async (auditId: string) => {
    try {
      await deleteAudit.mutateAsync(auditId);
      toast.success('Audit erfolgreich gelöscht');
    } catch (error) {
      console.error('Error deleting audit:', error);
      toast.error('Fehler beim Löschen des Audits');
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingAudit(null);
      setPresetType(null);
      setPresetDate(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Audits
            {audits.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {audits.length}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" onClick={() => handleCreate()} className="gap-2">
            <Plus className="h-4 w-4" />
            Neues Audit
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : audits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Keine Audits vorhanden</p>
              <p className="text-sm">Erstellen Sie das erste Audit für dieses Zertifikat</p>
              <Button onClick={() => handleCreate()} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Erstes Audit erstellen
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {audits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-start justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/audits/${audit.id}`)}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getAuditTypeBadge(audit.type)}
                      {getStatusBadge(audit.status)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(audit.scheduled_date), 'dd.MM.yyyy', { locale: de })}
                      </span>
                      
                      {audit.auditors && (
                        <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <User className="h-4 w-4" />
                          <AuditorPopover 
                            auditor={{
                              id: audit.auditors.id,
                              name: audit.auditors.name,
                              email: audit.auditors.email,
                              phone: audit.auditors.phone,
                            }}
                          />
                        </span>
                      )}
                      
                      {audit.certification_bodies && (
                        <span className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {audit.certification_bodies.short_name || audit.certification_bodies.name}
                        </span>
                      )}
                    </div>
                    
                    {audit.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {audit.notes}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/audits/${audit.id}`)}
                      className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Aufgaben
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(audit)}
                      title="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Audit löschen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Das {AUDIT_TYPE_LABELS[audit.type as keyof typeof AUDIT_TYPE_LABELS]} vom{' '}
                            {format(new Date(audit.scheduled_date), 'dd.MM.yyyy', { locale: de })} wird 
                            dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(audit.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CertificationAuditDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        clientCertificationId={clientCertificationId}
        clientId={clientId}
        certificationId={certificationId}
        certificationName={certificationName}
        existingAudit={editingAudit}
        presetType={presetType}
        presetDate={presetDate}
      />
    </>
  );
};
