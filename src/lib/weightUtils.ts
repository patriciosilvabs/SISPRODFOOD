// Utilitários para interpretação progressiva de peso
// Regra: até 3 dígitos = gramas, 4+ dígitos = quilogramas (÷1000)

export interface PesoInterpretado {
  valorRaw: number;           // Valor bruto digitado (sempre em gramas)
  valorKg: number;            // Valor convertido para kg
  valorGramas: number;        // Valor em gramas
  unidadeExibicao: 'g' | 'kg'; // Unidade para exibição
  formatado: string;          // String formatada (ex: "3 kg" ou "300 g")
}

/**
 * Interpreta valor digitado conforme regra progressiva:
 * - Até 3 dígitos = gramas
 * - 4+ dígitos = quilogramas (divide por 1000)
 */
export function parsePesoProgressivo(value: string | number): PesoInterpretado {
  const numStr = String(value).replace(/\D/g, ''); // Remove não-numéricos
  const num = parseInt(numStr) || 0;
  
  if (num === 0) {
    return {
      valorRaw: 0,
      valorGramas: 0,
      valorKg: 0,
      unidadeExibicao: 'g',
      formatado: ''
    };
  }
  
  if (numStr.length <= 3) {
    // Até 3 dígitos = gramas
    return {
      valorRaw: num,
      valorGramas: num,
      valorKg: num / 1000,
      unidadeExibicao: 'g',
      formatado: `${num} g`
    };
  } else {
    // 4+ dígitos = quilogramas
    const kg = num / 1000;
    // Preserva até 3 casas decimais (precisão em gramas), remove zeros à direita
    let kgFormatado: string;
    if (kg % 1 === 0) {
      kgFormatado = kg.toFixed(0);
    } else {
      kgFormatado = kg.toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
    }
    return {
      valorRaw: num,
      valorGramas: num,
      valorKg: kg,
      unidadeExibicao: 'kg',
      formatado: `${kgFormatado} kg`
    };
  }
}

/**
 * Formata peso para exibição com conversão automática
 */
export function formatPesoProgressivo(value: string | number): string {
  const parsed = parsePesoProgressivo(value);
  return parsed.formatado;
}

/**
 * Formata peso para exibição DENTRO do input (sem cálculos intermediários)
 * Retorna apenas o resultado final: "300 g" ou "5,5 kg"
 */
export function formatPesoParaInput(value: string | number): string {
  const numStr = String(value).replace(/\D/g, '');
  const num = parseInt(numStr) || 0;
  
  if (num === 0) return '';
  
  if (numStr.length <= 3) {
    return `${num} g`;
  } else {
    const kg = num / 1000;
    // Preserva até 3 casas decimais (precisão em gramas), remove zeros à direita
    let kgFormatado: string;
    if (kg % 1 === 0) {
      kgFormatado = kg.toFixed(0);
    } else {
      kgFormatado = kg.toFixed(3).replace(/\.?0+$/, '').replace('.', ',');
    }
    return `${kgFormatado} kg`;
  }
}

/**
 * Converte valor raw (gramas digitados) para kg para salvar no banco
 */
export function rawToKg(value: string | number): number {
  const parsed = parsePesoProgressivo(value);
  return parsed.valorKg;
}

/**
 * Converte kg (do banco) para valor raw em gramas para exibir no input
 */
export function kgToRaw(valueKg: number | null | undefined): string {
  if (!valueKg || valueKg === 0) return '';
  const gramas = Math.round(valueKg * 1000);
  return String(gramas);
}
