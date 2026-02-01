import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ParsedCardapioItem {
  tipo: string;
  categoria: string;
  nome: string;
  codigo_interno: number;
}

interface ImportarMapeamentoCardapioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ParsedCardapioItem[]) => Promise<void>;
  isLoading?: boolean;
}

function detectDelimiter(line: string): string {
  const tabCount = (line.match(/\t/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;

  if (tabCount >= semicolonCount && tabCount >= commaCount) return '\t';
  if (semicolonCount >= commaCount) return ';';
  return ',';
}

// Remove caracteres nulos, BOM e outros caracteres problemáticos
function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\uFFFD/g, '')
    .trim();
}

function parseCSV(content: string): ParsedCardapioItem[] {
  const sanitizedContent = sanitizeText(content);
  const lines = sanitizedContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  
  return lines.slice(1)
    .map(line => {
      const parts = line.split(delimiter);
      const tipo = sanitizeText(parts[0] || '');
      const categoria = sanitizeText(parts[1] || '');
      const nome = sanitizeText(parts[2] || '');
      const codigoStr = sanitizeText(parts[3] || '');
      const codigo_interno = parseInt(codigoStr.replace(/\D/g, ''), 10);

      return { tipo, categoria, nome, codigo_interno };
    })
    .filter(item => item.codigo_interno && item.nome);
}

export function ImportarMapeamentoCardapioModal({
  open,
  onOpenChange,
  onImport,
  isLoading = false,
}: ImportarMapeamentoCardapioModalProps) {
  const [parsedItems, setParsedItems] = useState<ParsedCardapioItem[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = useCallback((file: File) => {
    setError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const items = parseCSV(content);
        
        if (items.length === 0) {
          setError('Nenhum item válido encontrado no arquivo. Verifique o formato.');
          setParsedItems([]);
        } else {
          setParsedItems(items);
        }
      } catch (err) {
        setError('Erro ao processar o arquivo. Verifique o formato.');
        setParsedItems([]);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo.');
      setParsedItems([]);
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileRead(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileRead(file);
    }
  }, [handleFileRead]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleImport = async () => {
    if (parsedItems.length === 0) return;
    await onImport(parsedItems);
    setParsedItems([]);
    setFileName('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setParsedItems([]);
    setFileName('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Itens do Cardápio Web</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV ou TXT exportado do Cardápio Web
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Upload Area */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragOver 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-primary/50",
              fileName && "border-primary/50 bg-primary/5"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {fileName ? (
              <div className="flex items-center justify-center gap-2 text-primary">
                <FileText className="h-6 w-6" />
                <span className="font-medium">{fileName}</span>
                <Check className="h-5 w-5 text-green-500" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p className="font-medium">
                  Arraste o arquivo aqui ou clique para selecionar
                </p>
                <p className="text-sm">
                  Formatos aceitos: CSV, TXT (separado por tab)
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedItems.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-green-500" />
                <span>{parsedItems.length} itens encontrados no arquivo</span>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-28 text-right">Código</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedItems.slice(0, 100).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge 
                            variant={item.tipo === 'PRODUTO' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={item.categoria}>
                          {item.categoria}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={item.nome}>
                          {item.nome}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.codigo_interno}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedItems.length > 100 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    Mostrando 100 de {parsedItems.length} itens
                  </div>
                )}
              </ScrollArea>

              <p className="text-sm text-muted-foreground">
                Estes itens serão cadastrados <strong>sem vínculo</strong> a item porcionado.
                Você poderá vincular cada um individualmente depois.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={parsedItems.length === 0 || isLoading}
          >
            {isLoading ? 'Importando...' : `Importar ${parsedItems.length} itens`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
