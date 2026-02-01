

# Plano: Correção do Erro de Caracteres Unicode na Importação

## Problema Identificado

O arquivo CSV/TXT exportado contém caracteres nulos (`\u0000`) ou outras sequências Unicode inválidas que o PostgreSQL não aceita em colunas de texto. Este erro ocorre frequentemente com arquivos:
- Exportados do Excel
- Com encoding UTF-16 
- Com BOM (Byte Order Mark)
- Copiados de PDFs ou outras fontes

## Solução

Adicionar uma função de sanitização que remove todos os caracteres problemáticos antes de processar e enviar ao banco de dados.

## Alteração no Código

**Arquivo:** `src/components/modals/ImportarMapeamentoCardapioModal.tsx`

### Adicionar função de sanitização

```typescript
// Remove caracteres nulos, BOM e outros caracteres problemáticos
function sanitizeText(text: string): string {
  return text
    // Remove null characters
    .replace(/\u0000/g, '')
    // Remove BOM (Byte Order Mark)
    .replace(/^\uFEFF/, '')
    // Remove outros caracteres de controle Unicode problemáticos
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    // Remove caracteres de substituição
    .replace(/\uFFFD/g, '')
    .trim();
}
```

### Aplicar sanitização no parseCSV

```typescript
function parseCSV(content: string): ParsedCardapioItem[] {
  // Sanitizar conteúdo completo primeiro
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
```

## Detalhes Técnicos

### Caracteres Removidos

| Caractere | Código | Motivo |
|-----------|--------|--------|
| NUL | `\u0000` | Caractere nulo - PostgreSQL não aceita |
| BOM | `\uFEFF` | Byte Order Mark do UTF-8/16 |
| Controle | `\u0001-\u001F` | Caracteres de controle ASCII |
| Substituição | `\uFFFD` | Caractere de substituição Unicode |

### Dupla sanitização
- Sanitização do conteúdo completo (remove BOM no início)
- Sanitização de cada campo individualmente (garante limpeza completa)

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/modals/ImportarMapeamentoCardapioModal.tsx` | Adicionar `sanitizeText()` e aplicar no parser |

