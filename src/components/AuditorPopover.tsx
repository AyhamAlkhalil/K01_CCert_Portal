import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Copy, Check, Phone, Mail, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';

interface AuditorInfo {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface AuditorPopoverProps {
  auditor: AuditorInfo | null;
}

export const AuditorPopover = ({ auditor }: AuditorPopoverProps) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Kopiert!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!auditor) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-auto p-1 text-xs font-normal text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <ClipboardCheck className="h-3 w-3" />
          {auditor.name}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 border-amber-200 dark:border-amber-800" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-warning dark:text-amber-400" />
            <p className="font-semibold text-amber-900 dark:text-amber-200">Auditor</p>
          </div>
          
          <div className="pl-6">
            <p className="font-medium mb-2">{auditor.name}</p>
            
            {auditor.phone && (
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{auditor.phone}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(auditor.phone!, 'phone')}
                >
                  {copiedField === 'phone' ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
            
            {auditor.email && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{auditor.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(auditor.email!, 'email')}
                >
                  {copiedField === 'email' ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}

            {!auditor.phone && !auditor.email && (
              <p className="text-sm text-muted-foreground">Keine Kontaktdaten hinterlegt</p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
