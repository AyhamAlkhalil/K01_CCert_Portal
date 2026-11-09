import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Trash2, Download, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAuditDocuments,
  useUploadAuditDocument,
  useDeleteAuditDocument,
  getAuditDocumentUrl,
} from '@/hooks/useAuditDocuments';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const ACCEPTED_TYPES = [
  '.pdf', '.txt', '.csv',
  '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.gif', '.webp',
  '.doc', '.docx',
].join(',');

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string | null) {
  if (!mimeType) return <FileText className="h-4 w-4 text-muted-foreground" />;
  if (mimeType.startsWith('image/')) return <FileText className="h-4 w-4 text-info" />;
  if (mimeType.includes('pdf')) return <FileText className="h-4 w-4 text-destructive" />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileText className="h-4 w-4 text-success" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

interface AuditDocumentsCardProps {
  auditId: string;
}

export const AuditDocumentsCard = ({ auditId }: AuditDocumentsCardProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: documents = [], isLoading } = useAuditDocuments(auditId);
  const upload = useUploadAuditDocument();
  const remove = useDeleteAuditDocument();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        await upload.mutateAsync({ auditId, file });
        toast.success(`${file.name} hochgeladen`);
      } catch {
        toast.error(`Fehler beim Hochladen von ${file.name}`);
      }
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getAuditDocumentUrl(filePath);
    if (!url) {
      toast.error('Download-Link konnte nicht erstellt werden');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const handleDelete = (id: string, filePath: string) => {
    remove.mutate(
      { id, filePath, auditId },
      {
        onSuccess: () => toast.success('Dokument gelöscht'),
        onError: () => toast.error('Fehler beim Löschen'),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Dokumente</CardTitle>
          {documents.length > 0 && (
            <span className="text-xs text-muted-foreground">({documents.length})</span>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="h-4 w-4 mr-1" />
            {upload.isPending ? 'Lädt hoch...' : 'Hochladen'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Lädt...</p>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
            <Paperclip className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Noch keine Dokumente</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              PDF, Excel, Word, Bilder, CSV, TXT
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                {fileIcon(doc.mime_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                    {doc.file_size ? ' · ' : ''}
                    {format(new Date(doc.created_at), 'dd.MM.yyyy', { locale: de })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDownload(doc.file_path, doc.file_name)}
                    title="Herunterladen"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(doc.id, doc.file_path)}
                    disabled={remove.isPending}
                    title="Löschen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
