import { useState, useCallback, useMemo } from 'react';
import { ClipboardPaste, AlertCircle, Check, Lightbulb } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ParsedCardapioItem {
  tipo: string;
  categoria: string;
  nome: string;
  codigo_interno: number;
}

interface ImportarTextoCardapioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: ParsedCardapioItem[]) => Promise<void>;
  isLoading?: boolean;
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

function detectDelimiter(line: string): string {
  const tabCount = (line.match(/\t/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;

  if (tabCount >= semicolonCount && tabCount >= commaCount && tabCount > 0) return '\t';
  if (semicolonCount >= commaCount && semicolonCount > 0) return ';';
  if (commaCount > 0) return ',';
  return '\t'; // fallback
}

// Tenta extrair código numérico de uma string (ex: "Pizza 12345" → 12345)
function extrairCodigoDeTexto(texto: string): number | null {
  // Busca padrões comuns: "nome - 12345", "nome (12345)", "nome 12345"
  const patterns = [
    /[-–]\s*(\d+)\s*$/,           // "nome - 12345"
    /\(\s*(\d+)\s*\)\s*$/,        // "nome (12345)"
    /\s+(\d{3,})\s*$/,            // "nome 12345" (pelo menos 3 dígitos)
    /^(\d+)\s*[-–:]/,             // "12345 - nome"
    /^(\d+)\s+/,                  // "12345 nome"
  ];
  
  for (const pattern of patterns) {
    const match = texto.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }
  
  return null;
}

// Remove o código do nome se ele estiver no final
function removerCodigoDoNome(nome: string, codigo: number): string {
  const codigoStr = String(codigo);
  const patterns = [
    new RegExp(`\\s*[-–]\\s*${codigoStr}\\s*$`),
    new RegExp(`\\s*\\(\\s*${codigoStr}\\s*\\)\\s*$`),
    new RegExp(`\\s+${codigoStr}\\s*$`),
  ];
  
  let resultado = nome;
  for (const pattern of patterns) {
    resultado = resultado.replace(pattern, '');
  }
  
  return resultado.trim();
}

function parseTextoSimples(texto: string): ParsedCardapioItem[] {
  const sanitized = sanitizeText(texto);
  const lines = sanitized.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) return [];
  
  const delimiter = detectDelimiter(lines[0]);
  const items: ParsedCardapioItem[] = [];
  
  for (const line of lines) {
    const parts = line.split(delimiter).map(p => sanitizeText(p));
    
    // Ignora linhas de cabeçalho comuns
    const primeiroValor = parts[0]?.toLowerCase() || '';
    if (['tipo', 'type', 'categoria', 'category', 'nome', 'name', 'produto', 'código', 'codigo', 'id'].includes(primeiroValor)) {
      continue;
    }
    
    let tipo = '';
    let categoria = '';
    let nome = '';
    let codigo: number | null = null;
    
    if (parts.length >= 4) {
      // Formato completo: TIPO | CATEGORIA | NOME | CÓDIGO
      tipo = parts[0] || '';
      categoria = parts[1] || '';
      nome = parts[2] || '';
      const codigoStr = parts[3] || '';
      codigo = parseInt(codigoStr.replace(/\D/g, ''), 10);
    } else if (parts.length === 3) {
      // Pode ser: TIPO | NOME | CÓDIGO ou CATEGORIA | NOME | CÓDIGO
      const ultimoValor = parts[2] || '';
      const codigoPossivel = parseInt(ultimoValor.replace(/\D/g, ''), 10);
      
      if (!isNaN(codigoPossivel) && codigoPossivel > 0) {
        // TIPO/CATEGORIA | NOME | CÓDIGO
        tipo = parts[0] || '';
        nome = parts[1] || '';
        codigo = codigoPossivel;
      } else {
        // TIPO | CATEGORIA | NOME (sem código)
        tipo = parts[0] || '';
        categoria = parts[1] || '';
        nome = parts[2] || '';
      }
    } else if (parts.length === 2) {
      // Formato simples: NOME | CÓDIGO
      const segundoValor = parts[1] || '';
      const codigoPossivel = parseInt(segundoValor.replace(/\D/g, ''), 10);
      
      if (!isNaN(codigoPossivel) && codigoPossivel > 0) {
        nome = parts[0] || '';
        codigo = codigoPossivel;
      } else {
        // Sem código válido - tenta extrair do primeiro valor
        nome = parts[0] || '';
        codigo = extrairCodigoDeTexto(nome);
        if (codigo) {
          nome = removerCodigoDoNome(nome, codigo);
        }
      }
    } else if (parts.length === 1) {
      // Apenas uma coluna - tenta extrair código do texto
      const textoCompleto = parts[0] || '';
      codigo = extrairCodigoDeTexto(textoCompleto);
      if (codigo) {
        nome = removerCodigoDoNome(textoCompleto, codigo);
      } else {
        nome = textoCompleto;
      }
    }
    
    // Só adiciona se tiver nome e código válido
    if (nome && codigo && !isNaN(codigo) && codigo > 0) {
      items.push({
        tipo: tipo.toUpperCase(),
        categoria,
        nome,
        codigo_interno: codigo,
      });
    }
  }
  
  // Remove duplicatas por código
  const uniqueItems = items.reduce((acc, item) => {
    if (!acc.some(i => i.codigo_interno === item.codigo_interno)) {
      acc.push(item);
    }
    return acc;
  }, [] as ParsedCardapioItem[]);
  
  return uniqueItems;
}

export function ImportarTextoCardapioModal({
  open,
  onOpenChange,
  onImport,
  isLoading = false,
}: ImportarTextoCardapioModalProps) {
  const [texto, setTexto] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const parsedItems = useMemo(() => {
    if (!texto.trim()) return [];
    return parseTextoSimples(texto);
  }, [texto]);

  const handleImport = useCallback(async () => {
    if (parsedItems.length === 0) return;
    
    setIsImporting(true);
    try {
      await onImport(parsedItems);
      setTexto('');
      onOpenChange(false);
    } finally {
      setIsImporting(false);
    }
  }, [parsedItems, onImport, onOpenChange]);

  const handleClose = useCallback(() => {
    setTexto('');
    onOpenChange(false);
  }, [onOpenChange]);

  const loading = isLoading || isImporting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            Importar via Texto
          </DialogTitle>
          <DialogDescription>
            Cole o texto com os produtos do cardápio abaixo
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Textarea */}
          <div className="space-y-2">
            <Textarea
              placeholder="Cole aqui o texto copiado do Cardápio Web ou planilha..."
              className="min-h-[150px] font-mono text-sm"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Dica */}
          <Alert className="bg-muted/50 border-muted">
            <Lightbulb className="h-4 w-4" />
            <AlertDescription className="text-xs text-muted-foreground">
              <strong>Formatos aceitos:</strong> Nome + Código separados por tab, vírgula ou ponto-e-vírgula.
              <br />
              Exemplos: "Pizza Calabresa → 12345" ou "PRODUTO | PIZZAS | Pizza Calabresa | 12345"
            </AlertDescription>
          </Alert>

          {/* Preview */}
          {texto.trim() && (
            <>
              {parsedItems.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{parsedItems.length} itens encontrados</span>
                  </div>

                  <ScrollArea className="flex-1 border rounded-lg max-h-[250px]">
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
                        {parsedItems.slice(0, 50).map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {item.tipo ? (
                                <Badge 
                                  variant={item.tipo === 'PRODUTO' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {item.tipo}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate" title={item.categoria}>
                              {item.categoria || '-'}
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
                    {parsedItems.length > 50 && (
                      <div className="p-2 text-center text-sm text-muted-foreground border-t">
                        Mostrando 50 de {parsedItems.length} itens
                      </div>
                    )}
                  </ScrollArea>

                  <p className="text-sm text-muted-foreground">
                    Estes itens serão cadastrados <strong>sem vínculo</strong> a item porcionado.
                    Você poderá vincular cada um individualmente depois.
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>Nenhum item válido encontrado. Verifique o formato do texto.</span>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={parsedItems.length === 0 || loading}
          >
            {loading ? 'Importando...' : `Importar ${parsedItems.length} itens`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
