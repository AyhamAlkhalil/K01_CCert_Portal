import { useState, useMemo } from 'react';
import { FolderTree, Building2, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClients, useUpdateClient, DbClient } from '@/hooks/useClients';
import { toast } from 'sonner';

interface MoveClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: DbClient;
}

export const MoveClientDialog = ({ open, onOpenChange, client }: MoveClientDialogProps) => {
  const [selectedParentId, setSelectedParentId] = useState<string>(client.parent_client_id || 'none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: allClients = [] } = useClients();
  const updateClient = useUpdateClient();

  // Get all potential parent groups
  const availableGroups = useMemo(() => {
    // Find all children of current client to exclude them
    const getDescendantIds = (clientId: string): string[] => {
      const directChildren = allClients.filter(c => c.parent_client_id === clientId);
      const descendantIds: string[] = directChildren.map(c => c.id);
      directChildren.forEach(child => {
        descendantIds.push(...getDescendantIds(child.id));
      });
      return descendantIds;
    };

    const excludedIds = new Set([client.id, ...getDescendantIds(client.id)]);

    // A company group is either explicitly marked by missing client_number
    // or implicitly by already having children.
    const hasChildren = (clientId: string) => allClients.some(c => c.parent_client_id === clientId);
    const isCompanyGroup = (c: DbClient) => c.client_number === null || hasChildren(c.id);
    
    // Only show top-level company groups as targets
    return allClients.filter(c => 
      !excludedIds.has(c.id) && 
      c.parent_client_id === null && 
      isCompanyGroup(c)
    );
  }, [allClients, client.id]);

  // Find current parent name
  const currentParent = useMemo(() => {
    if (!client.parent_client_id) return null;
    return allClients.find(c => c.id === client.parent_client_id);
  }, [allClients, client.parent_client_id]);

  // Find selected parent name
  const selectedParent = useMemo(() => {
    if (selectedParentId === 'none') return null;
    return allClients.find(c => c.id === selectedParentId);
  }, [allClients, selectedParentId]);

  const handleMove = async () => {
    const newParentId = selectedParentId === 'none' ? null : selectedParentId;
    
    // No change
    if (newParentId === client.parent_client_id) {
      onOpenChange(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await updateClient.mutateAsync({
        id: client.id,
        parent_client_id: newParentId,
      });
      
      if (newParentId) {
        const newParent = allClients.find(c => c.id === newParentId);
        toast.success(`"${client.name}" wurde zu "${newParent?.name}" verschoben`);
      } else {
        toast.success(`"${client.name}" ist jetzt eine eigenständige Unternehmensgruppe`);
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error moving client:', error);
      toast.error('Fehler beim Verschieben des Kunden');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Kunde verschieben
          </DialogTitle>
          <DialogDescription>
            Verschieben Sie "{client.name}" in eine andere Unternehmensgruppe oder machen Sie ihn zur eigenständigen Gruppe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Aktuelle Zuordnung
            </label>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              {currentParent ? (
                <>
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{currentParent.name}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>{client.name}</span>
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">{client.name}</span>
                  <span className="text-muted-foreground text-sm ml-2">(Eigenständig)</span>
                </>
              )}
            </div>
          </div>

          {/* New location selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Neue Unternehmensgruppe
            </label>
            <Select value={selectedParentId} onValueChange={setSelectedParentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unternehmensgruppe wählen..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span>Keine Gruppe (eigenständig)</span>
                  </div>
                </SelectItem>
                {availableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-muted-foreground" />
                      <span>{group.name}</span>
                      {group.country && (
                        <span className="text-xs text-muted-foreground">({group.country})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview of new location */}
          {selectedParentId !== (client.parent_client_id || 'none') && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Neue Zuordnung
              </label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                {selectedParent ? (
                  <>
                    <FolderTree className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedParent.name}</span>
                    <ArrowRight className="h-4 w-4 text-primary mx-1" />
                    <Building2 className="h-4 w-4 text-primary" />
                    <span>{client.name}</span>
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">{client.name}</span>
                    <span className="text-primary text-sm ml-2">(wird eigenständig)</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleMove} 
            disabled={isSubmitting || selectedParentId === (client.parent_client_id || 'none')}
          >
            {isSubmitting ? 'Wird verschoben...' : 'Verschieben'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
