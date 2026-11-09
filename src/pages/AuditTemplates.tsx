import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
} from '@/components/ui/alert-dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { useCertifications } from '@/hooks/useCertifications';
import {
  useAuditTemplates,
  useCreateAuditTemplate,
  useUpdateAuditTemplate,
  useDeleteAuditTemplate,
  useAuditTemplateTasks,
  useCreateAuditTemplateTask,
  useUpdateAuditTemplateTask,
  useDeleteAuditTemplateTask,
  AuditTemplate,
  AuditTemplateTask,
} from '@/hooks/useAuditTemplates';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import {
  Plus,
  Trash2,
  FileText,
  Loader2,
  ListChecks,
  Clock,
  GripVertical,
  Pencil,
  Check,
  X
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PageHeader } from '@/components/PageHeader';
import { CSS } from '@dnd-kit/utilities';

const AUDIT_TYPE_LABELS: Record<string, string> = {
  'initial': 'Initialaudit',
  'surveillance': 'Überwachungsaudit',
  'recertification': 'Rezertifizierung',
  'six-month': '6-Monats-Audit',
};

const AUDIT_TYPE_COLORS: Record<string, string> = {
  'initial': 'bg-info/[0.12] text-info border-info/30',
  'surveillance': 'bg-amber-500/[0.15] text-amber-800 border-amber-500/40',
  'recertification': 'bg-success/[0.12] text-success border-success/30',
  'six-month': 'bg-violet-500/[0.12] text-violet-700 border-violet-500/30',
};

// Sortable Task Item Component
function SortableTaskItem({
  task,
  editingTaskId,
  editTask,
  setEditTask,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  isUpdating,
}: {
  task: AuditTemplateTask;
  editingTaskId: string | null;
  editTask: { title: string; description: string; days_before_audit: number };
  setEditTask: (data: { title: string; description: string; days_before_audit: number }) => void;
  onStartEdit: (task: AuditTemplateTask) => void;
  onSaveEdit: (task: AuditTemplateTask) => void;
  onCancelEdit: () => void;
  onDelete: (task: AuditTemplateTask) => void;
  isUpdating: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg group"
    >
      {editingTaskId === task.id ? (
        // Edit mode
        <div className="flex-1 space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`editTitle-${task.id}`}>Titel *</Label>
            <Input
              id={`editTitle-${task.id}`}
              value={editTask.title}
              onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`editDesc-${task.id}`}>Beschreibung</Label>
            <Textarea
              id={`editDesc-${task.id}`}
              value={editTask.description}
              onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`editDays-${task.id}`}>Tage vor Audit</Label>
            <Input
              id={`editDays-${task.id}`}
              type="number"
              min={0}
              value={editTask.days_before_audit}
              onChange={(e) => setEditTask({ ...editTask, days_before_audit: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button size="sm" onClick={() => onSaveEdit(task)} disabled={isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Check className="h-4 w-4 mr-1" />
              Speichern
            </Button>
          </div>
        </div>
      ) : (
        // View mode
        <>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{task.title}</span>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {task.days_before_audit} Tage vorher
              </Badge>
            </div>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onStartEdit(task)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(task)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Template Task List Component with full editing and drag-and-drop
function TemplateTaskList({ template }: { template: AuditTemplate }) {
  const { data: tasks, isLoading } = useAuditTemplateTasks(template.id);
  const createTask = useCreateAuditTemplateTask();
  const updateTask = useUpdateAuditTemplateTask();
  const deleteTask = useDeleteAuditTemplateTask();

  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    days_before_audit: 14,
  });
  const [editTask, setEditTask] = useState({
    title: '',
    description: '',
    days_before_audit: 14,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && tasks) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);

      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);

      // Update sort_order for all affected tasks
      try {
        await Promise.all(
          reorderedTasks.map((task, index) =>
            updateTask.mutateAsync({
              id: task.id,
              sort_order: index,
            })
          )
        );
        toast.success('Reihenfolge aktualisiert');
      } catch {
        toast.error('Fehler beim Aktualisieren der Reihenfolge');
      }
    }
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast.error('Bitte geben Sie einen Titel ein');
      return;
    }

    try {
      await createTask.mutateAsync({
        template_id: template.id,
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        days_before_audit: newTask.days_before_audit,
        sort_order: tasks?.length || 0,
      });
      toast.success('Aufgabe hinzugefügt');
      setNewTask({ title: '', description: '', days_before_audit: 14 });
      setIsAddingTask(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    }
  };

  const handleStartEdit = (task: AuditTemplateTask) => {
    setEditingTaskId(task.id);
    setEditTask({
      title: task.title,
      description: task.description || '',
      days_before_audit: task.days_before_audit,
    });
  };

  const handleSaveEdit = async (task: AuditTemplateTask) => {
    if (!editTask.title.trim()) {
      toast.error('Bitte geben Sie einen Titel ein');
      return;
    }

    try {
      await updateTask.mutateAsync({
        id: task.id,
        title: editTask.title.trim(),
        description: editTask.description.trim() || null,
        days_before_audit: editTask.days_before_audit,
      });
      toast.success('Aufgabe aktualisiert');
      setEditingTaskId(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditTask({ title: '', description: '', days_before_audit: 14 });
  };

  const handleDeleteTask = async (task: AuditTemplateTask) => {
    try {
      await deleteTask.mutateAsync({ id: task.id, templateId: template.id });
      toast.success('Aufgabe entfernt');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks && tasks.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tasks.map((task) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  editingTaskId={editingTaskId}
                  editTask={editTask}
                  setEditTask={setEditTask}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onDelete={handleDeleteTask}
                  isUpdating={updateTask.isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground py-2">
          Keine Aufgaben definiert. Fügen Sie Aufgaben hinzu, die automatisch erstellt werden.
        </p>
      )}

      {isAddingTask ? (
        <div className="space-y-3 p-4 border rounded-lg bg-background">
          <div className="space-y-2">
            <Label htmlFor="taskTitle">Aufgabentitel *</Label>
            <Input
              id="taskTitle"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="z.B. Dokumentation prüfen"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskDesc">Beschreibung</Label>
            <Textarea
              id="taskDesc"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Optionale Details zur Aufgabe"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daysBefore">Tage vor Audit</Label>
            <Input
              id="daysBefore"
              type="number"
              min={0}
              value={newTask.days_before_audit}
              onChange={(e) => setNewTask({ ...newTask, days_before_audit: parseInt(e.target.value) || 0 })}
            />
            <p className="text-xs text-muted-foreground">
              Die Aufgabe wird so viele Tage vor dem Audit-Termin fällig
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddingTask(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleAddTask} disabled={createTask.isPending}>
              {createTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hinzufügen
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsAddingTask(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Aufgabe hinzufügen
        </Button>
      )}
    </div>
  );
}

// Editable Template Card Component
function EditableTemplateCard({
  template,
  onDelete
}: {
  template: AuditTemplate;
  onDelete: (template: AuditTemplate) => void;
}) {
  const updateTemplate = useUpdateAuditTemplate();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: template.name || '',
    description: template.description || '',
  });

  const handleSave = async () => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        name: editData.name.trim() || null,
        description: editData.description.trim() || null,
      });
      toast.success('Vorlage aktualisiert');
      setIsEditing(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  };

  const handleCancel = () => {
    setEditData({
      name: template.name || '',
      description: template.description || '',
    });
    setIsEditing(false);
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 px-4">
        {isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className={AUDIT_TYPE_COLORS[template.audit_type]}>
                {AUDIT_TYPE_LABELS[template.audit_type]}
              </Badge>
              <span className="text-xs text-muted-foreground">(Typ nicht änderbar)</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`templateName-${template.id}`}>Name</Label>
              <Input
                id={`templateName-${template.id}`}
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="Optionaler Name für die Vorlage"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`templateDesc-${template.id}`}>Beschreibung</Label>
              <Textarea
                id={`templateDesc-${template.id}`}
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                placeholder="Optionale Beschreibung"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateTemplate.isPending}>
                {updateTemplate.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Check className="h-4 w-4 mr-1" />
                Speichern
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={AUDIT_TYPE_COLORS[template.audit_type]}>
                  {AUDIT_TYPE_LABELS[template.audit_type]}
                </Badge>
                {template.name && (
                  <span className="text-sm text-muted-foreground">
                    — {template.name}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(template)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {template.description}
              </p>
            )}
          </>
        )}
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-4">
        <TemplateTaskList template={template} />
      </CardContent>
    </Card>
  );
}

export default function AuditTemplates() {
  const { data: certifications, isLoading: loadingCerts } = useCertifications();
  const { data: templates, isLoading: loadingTemplates } = useAuditTemplates();
  const createTemplate = useCreateAuditTemplate();
  const deleteTemplate = useDeleteAuditTemplate();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteDialogTemplate, setDeleteDialogTemplate] = useState<AuditTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    certification_id: '',
    audit_type: '' as 'initial' | 'surveillance' | 'recertification' | 'six-month' | 'internal' | 'training' | '',
    name: '',
    description: '',
  });

  const handleCreateTemplate = async () => {
    if (!newTemplate.certification_id || !newTemplate.audit_type) {
      toast.error('Bitte wählen Sie Zertifizierung und Audittyp');
      return;
    }

    try {
      await createTemplate.mutateAsync({
        certification_id: newTemplate.certification_id,
        audit_type: newTemplate.audit_type as 'initial' | 'surveillance' | 'recertification' | 'six-month' | 'internal',
        name: newTemplate.name.trim() || null,
        description: newTemplate.description.trim() || null,
      });
      toast.success('Vorlage erstellt');
      setNewTemplate({ certification_id: '', audit_type: '', name: '', description: '' });
      setIsCreateDialogOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('duplicate')) {
        toast.error('Diese Kombination existiert bereits');
      } else {
        toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen');
      }
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteDialogTemplate) return;

    try {
      await deleteTemplate.mutateAsync(deleteDialogTemplate.id);
      toast.success('Vorlage gelöscht');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setDeleteDialogTemplate(null);
    }
  };

  // Group templates by certification
  const groupedTemplates = templates?.reduce((acc, template) => {
    const certName = template.certifications?.name || 'Unbekannt';
    if (!acc[certName]) {
      acc[certName] = [];
    }
    acc[certName].push(template);
    return acc;
  }, {} as Record<string, AuditTemplate[]>);

  const isLoading = loadingCerts || loadingTemplates;

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6 animate-fade-in">
        <PageHeader
          title="Audit-Vorlagen"
          description="Definieren Sie Aufgaben-Vorlagen für verschiedene Audit-Typen pro Zertifizierung"
        />

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                Vorlagen-Übersicht
              </CardTitle>
              <CardDescription>
                Automatische Task-Generierung bei Audit-Erstellung
              </CardDescription>
            </div>
            <Button size="sm" className="sm:size-default self-start sm:self-auto" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Neue Vorlage</span>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : templates && templates.length > 0 ? (
              <Accordion type="multiple" className="w-full">
                {Object.entries(groupedTemplates || {}).map(([certName, certTemplates]) => (
                  <AccordionItem key={certName} value={certName}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{certName}</span>
                        <Badge variant="secondary">{certTemplates.length} Vorlagen</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {certTemplates.map((template) => (
                          <EditableTemplateCard
                            key={template.id}
                            template={template}
                            onDelete={setDeleteDialogTemplate}
                          />
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-1">Keine Vorlagen vorhanden</h3>
                <p className="text-muted-foreground mb-4">
                  Erstellen Sie Vorlagen, um bei neuen Audits automatisch Aufgaben zu generieren
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Erste Vorlage erstellen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Audit-Vorlage</DialogTitle>
            <DialogDescription>
              Wählen Sie eine Zertifizierung und einen Audittyp für die neue Vorlage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Zertifizierung *</Label>
              <Select
                value={newTemplate.certification_id}
                onValueChange={(value) => setNewTemplate({ ...newTemplate, certification_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zertifizierung wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {certifications?.map((cert) => (
                    <SelectItem key={cert.id} value={cert.id}>
                      {cert.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Audittyp *</Label>
              <Select
                value={newTemplate.audit_type}
                onValueChange={(value) => setNewTemplate({ ...newTemplate, audit_type: value as Database["public"]["Enums"]["audit_type"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Audittyp wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateName">Name (optional)</Label>
              <Input
                id="templateName"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="z.B. Standard-Vorlage"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDesc">Beschreibung (optional)</Label>
              <Textarea
                id="templateDesc"
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Hinweise zur Verwendung dieser Vorlage"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateTemplate} disabled={createTemplate.isPending}>
              {createTemplate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!deleteDialogTemplate} onOpenChange={() => setDeleteDialogTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Audit-Vorlage wirklich löschen? Alle zugehörigen Aufgaben-Vorlagen werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
