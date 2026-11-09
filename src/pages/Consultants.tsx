import { useState, useMemo } from 'react';
import { useConsultants, useCreateConsultant, useUpdateConsultant, useDeleteConsultant, DbConsultant } from '@/hooks/useConsultants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Search, User, Mail, Phone } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';

const Consultants = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showDialog, setShowDialog] = useState(false);
    const [editingConsultant, setEditingConsultant] = useState<DbConsultant | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    const { data: consultants = [], isLoading } = useConsultants();
    const createConsultant = useCreateConsultant();
    const updateConsultant = useUpdateConsultant();
    const deleteConsultant = useDeleteConsultant();

    const filteredConsultants = useMemo(() => {
        return consultants.filter(consultant =>
            consultant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            consultant.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [consultants, searchQuery]);

    const resetForm = () => {
        setName('');
        setEmail('');
        setPhone('');
        setEditingConsultant(null);
    };

    const openCreateDialog = () => {
        resetForm();
        setShowDialog(true);
    };

    const openEditDialog = (consultant: DbConsultant) => {
        setEditingConsultant(consultant);
        setName(consultant.name);
        setEmail(consultant.email || '');
        setPhone(consultant.phone || '');
        setShowDialog(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name) {
            toast.error('Bitte geben Sie einen Namen ein');
            return;
        }

        try {
            if (editingConsultant) {
                await updateConsultant.mutateAsync({
                    id: editingConsultant.id,
                    name,
                    email: email || null,
                    phone: phone || null,
                });
                toast.success('Berater erfolgreich aktualisiert');
            } else {
                await createConsultant.mutateAsync({
                    name,
                    email: email || null,
                    phone: phone || null,
                });
                toast.success('Berater erfolgreich erstellt');
            }
            setShowDialog(false);
            resetForm();
        } catch (error) {
            console.error('Error saving consultant:', error);
            toast.error('Fehler beim Speichern');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteConsultant.mutateAsync(id);
            toast.success('Berater erfolgreich gelöscht');
        } catch (error) {
            console.error('Error deleting consultant:', error);
            toast.error('Fehler beim Löschen');
        }
    };

    return (
        <>
            <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
                <PageHeader
                    title="Berater"
                    description={`${consultants.length} Einträge`}
                    actions={
                        <Button className="w-full sm:w-auto" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4" />
                            Neuer Berater
                        </Button>
                    }
                />

                <div className="relative sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {isLoading ? (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                ) : filteredConsultants.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Keine Berater gefunden</p>
                            <Button onClick={openCreateDialog} className="mt-4">
                                <Plus className="h-4 w-4 mr-2" />
                                Ersten Berater anlegen
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Kontakt</TableHead>
                                    <TableHead className="w-[100px]">Aktionen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredConsultants.map((consultant) => (
                                    <TableRow key={consultant.id}>
                                        <TableCell className="font-medium">{consultant.name}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 text-sm">
                                                {consultant.email && (
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <Mail className="h-3 w-3" />
                                                        <a href={`mailto:${consultant.email}`} className="hover:text-primary hover:underline">
                                                            {consultant.email}
                                                        </a>
                                                    </div>
                                                )}
                                                {consultant.phone && (
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <Phone className="h-3 w-3" />
                                                        <a href={`tel:${consultant.phone}`} className="hover:text-primary hover:underline">
                                                            {consultant.phone}
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditDialog(consultant)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Berater löschen?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Möchten Sie "{consultant.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(consultant.id)}>
                                                                Löschen
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingConsultant ? 'Berater bearbeiten' : 'Neuer Berater'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingConsultant ? 'Bearbeiten Sie die Beraterdaten' : 'Erstellen Sie einen neuen Berater'}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="z.B. Jan Pane"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">E-Mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="berater@beispiel.de"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Telefon</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+49 123 456789"
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                                    Abbrechen
                                </Button>
                                <Button type="submit" disabled={createConsultant.isPending || updateConsultant.isPending}>
                                    {createConsultant.isPending || updateConsultant.isPending ? 'Speichert...' : 'Speichern'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
};

export default Consultants;
