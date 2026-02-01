import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
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

// Converte strings de números (incluindo notação científica) para inteiro
function parseNumericCode(value: string): number {
  const sanitized = sanitizeText(value);
  
  // Se contém notação científica, usar parseFloat primeiro
  if (sanitized.includes('e') || sanitized.includes('E')) {
    const num = parseFloat(sanitized);
    if (!isNaN(num) && isFinite(num)) {
      // Para números muito grandes, usar BigInt para preservar precisão
      try {
        // Converter para string sem notação científica e depois para número
        const bigIntValue = BigInt(Math.floor(num));
        // Se o número for maior que Number.MAX_SAFE_INTEGER, retornar como number mesmo
        // O banco de dados bigint suporta esses valores
        return Number(bigIntValue);
      } catch {
        return Math.floor(num);
      }
    }
  }
  
  // Tentar parsear como inteiro removendo não-dígitos
  const digits = sanitized.replace(/[^\d]/g, '');
  if (digits) {
    // Para strings muito longas, usar BigInt
    try {
      const bigIntValue = BigInt(digits);
      return Number(bigIntValue);
    } catch {
      return parseInt(digits, 10);
    }
  }
  
  return NaN;
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
      const codigoStr = parts[3] || '';
      const codigo_interno = parseNumericCode(codigoStr);

      return { tipo, categoria, nome, codigo_interno };
    })
    .filter(item => !isNaN(item.codigo_interno) && item.codigo_interno > 0 && item.nome);
}

async function parseExcel(file: File): Promise<ParsedCardapioItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pegar primeira planilha
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { 
          header: 1,
          raw: false // Força strings para evitar notação científica
        });
        
        if (jsonData.length < 2) {
          resolve([]);
          return;
        }
        
        // Pular header (primeira linha)
        const items = (jsonData as unknown[][]).slice(1)
          .map(row => {
            const tipo = sanitizeText(String(row[0] ?? ''));
            const categoria = sanitizeText(String(row[1] ?? ''));
            const nome = sanitizeText(String(row[2] ?? ''));
            const codigoStr = String(row[3] ?? '');
            const codigo_interno = parseNumericCode(codigoStr);
            
            return { tipo, categoria, nome, codigo_interno };
          })
          .filter(item => !isNaN(item.codigo_interno) && item.codigo_interno > 0 && item.nome);
        
        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
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
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = useCallback(async (file: File) => {
    setError('');
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let items: ParsedCardapioItem[];
      
      if (extension === 'xls' || extension === 'xlsx') {
        // Arquivo Excel
        items = await parseExcel(file);
      } else {
        // Arquivo CSV/TXT
        const content = await file.text();
        items = parseCSV(content);
      }
      
      if (items.length === 0) {
        setError('Nenhum item válido encontrado no arquivo. Verifique o formato.');
        setParsedItems([]);
      } else {
        setParsedItems(items);
      }
    } catch (err) {
      console.error('Erro ao processar arquivo:', err);
      setError('Erro ao processar o arquivo. Verifique o formato.');
      setParsedItems([]);
    } finally {
      setIsProcessing(false);
    }
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
            Faça upload de um arquivo CSV, TXT ou Excel exportado do Cardápio Web
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
              accept=".csv,.txt,.xls,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Processando arquivo...</span>
              </div>
            ) : fileName ? (
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
                  Formatos aceitos: CSV, TXT, XLS, XLSX
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
          <Button variant="outline" onClick={handleClose} disabled={isLoading || isProcessing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={parsedItems.length === 0 || isLoading || isProcessing}
          >
            {isLoading ? 'Importando...' : `Importar ${parsedItems.length} itens`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
