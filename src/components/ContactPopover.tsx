import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Phone, Mail, User, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Contact } from '@/hooks/useContacts';

interface ContactPopoverProps {
  // Legacy single contact (fallback from client table)
  legacyName?: string;
  legacyPhone?: string | null;
  legacyEmail?: string | null;
  // Multiple contacts from contacts table
  contacts?: Contact[];
  // Client ID for navigation
  clientId?: string;
}

export const ContactPopover = ({ 
  legacyName, 
  legacyPhone, 
  legacyEmail, 
  contacts = [],
  clientId
}: ContactPopoverProps) => {
  const navigate = useNavigate();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Kopiert!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Only show contacts from the contacts table - ignore legacy data
  const hasContacts = contacts.length > 0;
  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];
  const displayName = hasContacts ? primaryContact?.name : null;
  const contactCount = contacts.length;

  // Don't show anything if there are no real contacts
  if (!hasContacts) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-auto p-1 text-xs font-normal text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20 gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <User className="h-3 w-3" />
          {displayName}
          {contactCount > 1 && (
            <Badge variant="secondary" className="ml-1 text-xs px-1">+{contactCount - 1}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 border-sky-200 dark:border-sky-800" 
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <p className="font-semibold text-sky-900 dark:text-sky-200">Ansprechpartner</p>
          </div>
          
          {hasContacts ? (
            // Multiple contacts view
            contacts.map((contact, idx) => (
              <div key={contact.id} className={`pl-6 ${idx > 0 ? "border-t pt-3" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-medium">{contact.name}</p>
                  {contact.is_primary && (
                    <Badge variant="default" className="text-xs">Haupt</Badge>
                  )}
                </div>
                {contact.role && (
                  <p className="text-xs text-muted-foreground mb-2">{contact.role}</p>
                )}
                
                {contact.phone && (
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{contact.phone}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(contact.phone!, `phone-${contact.id}`)}
                    >
                      {copiedField === `phone-${contact.id}` ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                )}
                
                {contact.email && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(contact.email!, `email-${contact.id}`)}
                    >
                      {copiedField === `email-${contact.id}` ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            // Legacy single contact view
            <div className="pl-6">
              <p className="font-medium mb-2">{legacyName}</p>
              
              {legacyPhone && (
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{legacyPhone}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(legacyPhone, 'phone')}
                  >
                    {copiedField === 'phone' ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}
              
              {legacyEmail && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{legacyEmail}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(legacyEmail, 'email')}
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}

              {!legacyPhone && !legacyEmail && (
                <p className="text-sm text-muted-foreground">Keine Kontaktdaten hinterlegt</p>
              )}
            </div>
          )}

          {/* Navigation arrow to client details */}
          {clientId && (
            <div className="border-t pt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20"
                onClick={() => navigate(`/clients/${clientId}`)}
              >
                Zum Unternehmen
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
