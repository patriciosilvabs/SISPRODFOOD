

# Plano: Suporte a Arquivos Excel e Correção de Notação Científica

## Problemas Identificados

### 1. Erro de Notação Científica
O Excel salva números grandes em notação científica (ex: `9.31966655686356e+28`), que o `parseInt()` não consegue processar. O código atual:
```typescript
const codigo_interno = parseInt(codigoStr.replace(/\D/g, ''), 10);
```
Remove todos os caracteres não numéricos, mas a notação `e+28` quebra o parsing.

### 2. Suporte a Arquivos Excel
O upload atual só aceita `.csv` e `.txt`. O usuário precisa importar diretamente de `.xls` e `.xlsx`.

---

## Solução

### Parte 1: Instalar Biblioteca xlsx (SheetJS)

Adicionar a dependência `xlsx` que permite ler arquivos Excel no navegador:
```bash
npm install xlsx
```

### Parte 2: Atualizar o Componente

**Arquivo:** `src/components/modals/ImportarMapeamentoCardapioModal.tsx`

#### 2.1 Adicionar função para parsear números grandes

```typescript
// Converte strings de números (incluindo notação científica) para inteiro
function parseNumericCode(value: string): number {
  const sanitized = sanitizeText(value);
  
  // Se contém notação científica, usar parseFloat primeiro
  if (sanitized.includes('e') || sanitized.includes('E')) {
    const num = parseFloat(sanitized);
    if (!isNaN(num) && isFinite(num)) {
      // Converter para BigInt se for muito grande, depois para número
      return Math.floor(num);
    }
  }
  
  // Tentar parsear como inteiro removendo não-dígitos
  const digits = sanitized.replace(/[^\d]/g, '');
  if (digits) {
    return parseInt(digits, 10);
  }
  
  return NaN;
}
```

#### 2.2 Adicionar parser de Excel

```typescript
import * as XLSX from 'xlsx';

async function parseExcel(file: File): Promise<ParsedCardapioItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Pegar primeira planilha
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { 
          header: 1,
          raw: false // Força strings para evitar notação científica
        });
        
        if (jsonData.length < 2) {
          resolve([]);
          return;
        }
        
        // Pular header (primeira linha)
        const items = (jsonData as string[][]).slice(1)
          .map(row => {
            const tipo = sanitizeText(String(row[0] || ''));
            const categoria = sanitizeText(String(row[1] || ''));
            const nome = sanitizeText(String(row[2] || ''));
            const codigoStr = String(row[3] || '');
            const codigo_interno = parseNumericCode(codigoStr);
            
            return { tipo, categoria, nome, codigo_interno };
          })
          .filter(item => item.codigo_interno && !isNaN(item.codigo_interno) && item.nome);
        
        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsArrayBuffer(file);
  });
}
```

#### 2.3 Atualizar função handleFileRead

```typescript
const handleFileRead = useCallback(async (file: File) => {
  setError('');
  setFileName(file.name);
  
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
  }
}, []);
```

#### 2.4 Atualizar input accept

```typescript
<input
  ref={fileInputRef}
  type="file"
  accept=".csv,.txt,.xls,.xlsx"
  onChange={handleFileChange}
  className="hidden"
/>
```

#### 2.5 Atualizar texto de instrução

```typescript
<p className="text-sm">
  Formatos aceitos: CSV, TXT, XLS, XLSX
</p>
```

#### 2.6 Atualizar parseCSV para usar a nova função de parsing

```typescript
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
    .filter(item => item.codigo_interno && !isNaN(item.codigo_interno) && item.nome);
}
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `package.json` | Adicionar dependência `xlsx` |
| `ImportarMapeamentoCardapioModal.tsx` | Adicionar import do xlsx |
| `ImportarMapeamentoCardapioModal.tsx` | Criar função `parseNumericCode()` |
| `ImportarMapeamentoCardapioModal.tsx` | Criar função `parseExcel()` |
| `ImportarMapeamentoCardapioModal.tsx` | Atualizar `handleFileRead()` para ser async |
| `ImportarMapeamentoCardapioModal.tsx` | Atualizar `parseCSV()` para usar novo parser |
| `ImportarMapeamentoCardapioModal.tsx` | Atualizar input accept e texto de ajuda |

---

## Formatos Suportados Após Implementação

| Formato | Extensão | Descrição |
|---------|----------|-----------|
| CSV | `.csv` | Separado por vírgula, ponto-e-vírgula ou tab |
| Texto | `.txt` | Separado por tab ou outros delimitadores |
| Excel 97-2003 | `.xls` | Formato binário antigo |
| Excel 2007+ | `.xlsx` | Formato XML moderno |

