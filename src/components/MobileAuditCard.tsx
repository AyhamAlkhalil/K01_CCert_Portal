import { Audit } from '@/types/audit';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Building2, User, ChevronRight, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { AUDIT_TYPE_LABELS, AUDIT_STATUS_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface MobileAuditCardProps {
  audit: Audit;
  onClick: () => void;
}

export const MobileAuditCard = ({ audit, onClick }: MobileAuditCardProps) => {
  const statusConfig = AUDIT_STATUS_CONFIG[audit.status];
  const pendingTasks = audit.tasks.filter(t => t.status !== 'completed').length;
  
  return (
    <Card 
      className="mb-3 active:scale-[0.98] transition-transform cursor-pointer border-l-4 overflow-hidden shadow-sm"
      style={{ borderLeftColor: `hsl(var(--${statusConfig.variant === 'destructive' ? 'destructive' : statusConfig.variant === 'secondary' ? 'muted' : 'primary'}))` }}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12px] font-bold text-foreground">
                {format(audit.scheduledDate, 'dd.MM.yyyy')}
              </span>
            </div>
            <h3 className="font-bold text-sm leading-tight text-foreground line-clamp-1">{audit.clientName}</h3>
          </div>
          <Badge 
            variant={statusConfig.variant} 
            className={cn("text-[10px] px-1.5 py-0 h-5", statusConfig.className)}
          >
            {statusConfig.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-y-3 gap-x-2 mb-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <ClipboardCheck className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{AUDIT_TYPE_LABELS[audit.type]}</span>
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">
              {audit.auditorName || 'Kein Auditor'}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-hidden col-span-2">
            <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">
              {audit.certificationBodyName || 'Kein Zertifizierer'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="flex gap-1 flex-wrap">
            {audit.certifications.slice(0, 2).map((cert, i) => (
              <Badge key={i} variant="outline" className="text-[9px] px-1.5 h-4 font-normal">
                {cert}
              </Badge>
            ))}
            {audit.certifications.length > 2 && (
              <span className="text-[9px] text-muted-foreground">+{audit.certifications.length - 2}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
             {pendingTasks > 0 ? (
               <span className="text-[10px] font-bold text-destructive">{pendingTasks} Offen</span>
             ) : (
               <span className="text-[10px] font-bold text-success">Erledigt</span>
             )}
             <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
