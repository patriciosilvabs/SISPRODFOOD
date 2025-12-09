/**
 * REGRA-MÃE DE CÁLCULO DE INSUMOS POR DEMANDA
 * 
 * Esta é a ÚNICA regra válida para cálculo de insumos por demanda.
 * Qualquer multiplicação direta por lote em unidades é considerada erro lógico crítico.
 * 
 * Princípios obrigatórios:
 * - Nunca multiplicar insumo_por_lote diretamente pela quantidade de unidades
 * - Toda conversão deve partir do consumo real por UNIDADE
 * - Toda perda deve ser aplicada sobre a matéria-prima, nunca sobre o produto final
 * - Unidade nunca é lote. Lote nunca é unidade.
 */

export type TipoInsumo = 'peso' | 'unidade';

export interface ParametrosCalculoInsumo {
  demandaTotalUnidades: number;
  pesoUnitarioFinalG: number;
  equivalenciaPorLoteUnidades: number | null;
  perdaPercentual: number;
  insumo: {
    quantidadePorLote: number; // quantidade configurada por lote/traço
    tipo: TipoInsumo; // 'peso' = proporcional ao peso, 'unidade' = por unidade produzida
    unidade: string;
  };
}

export interface ProtecaoAntiExplosao {
  consumoExcedeLimite: boolean;
  limiteMaximo: number;
  consumoCalculado: number;
  razaoExcedente: number;
  mensagemErro: string | null;
}

export interface ResultadoCalculo {
  consumoCalculado: number;
  consumoEmKg: number;
  pesoTotalFinalKg: number;
  pesoTotalComPerdaKg: number;
  alertaConsumoExcessivo: boolean;
  protecao: ProtecaoAntiExplosao;
}

/**
 * Calcula o consumo de um insumo seguindo a Regra-Mãe
 * 
 * PASSO 1: Calcular peso total final = (peso_unitario × demanda) ÷ 1000
 * PASSO 2: Aplicar perda = peso_total × (1 + perda%)
 * PASSO 3: Se tipo == "peso" → consumo = peso_total_com_perda
 * PASSO 4: Se tipo == "unidade" → consumo = demanda × quantidade_por_unidade
 */
export function calcularConsumoInsumo(params: ParametrosCalculoInsumo): ResultadoCalculo {
  const {
    demandaTotalUnidades,
    pesoUnitarioFinalG,
    perdaPercentual,
    insumo
  } = params;

  // PASSO 1: Calcular peso total final
  const pesoTotalFinalKg = (pesoUnitarioFinalG * demandaTotalUnidades) / 1000;

  // PASSO 2: Aplicar perda (sobre matéria-prima)
  const fatorPerda = 1 + (perdaPercentual / 100);
  const pesoTotalComPerdaKg = pesoTotalFinalKg * fatorPerda;

  let consumoCalculado: number;

  // PASSO 3/4: Calcular consumo por tipo de insumo
  if (insumo.tipo === 'peso') {
    // Insumo proporcional ao peso (ex: massa, recheio, proteína)
    // Consumo = peso total com perda aplicada
    consumoCalculado = pesoTotalComPerdaKg;
  } else {
    // Insumo por unidade (ex: embalagem, etiqueta, tampa)
    // Consumo = demanda × quantidade por unidade
    // IMPORTANTE: quantidadePorLote aqui é "por unidade", não por lote!
    consumoCalculado = demandaTotalUnidades * insumo.quantidadePorLote;
  }

  // Converter para kg se necessário
  let consumoEmKg = consumoCalculado;
  const unidadeLower = insumo.unidade.toLowerCase();
  if (unidadeLower === 'g') {
    consumoEmKg = consumoCalculado / 1000;
  } else if (unidadeLower === 'ml') {
    consumoEmKg = consumoCalculado / 1000;
  }

  // VALIDAÇÃO CRÍTICA: Alerta se consumo > 5x peso total
  const alertaConsumoExcessivo = consumoEmKg > 5 * pesoTotalComPerdaKg && insumo.tipo === 'peso';
  
  if (alertaConsumoExcessivo) {
    console.warn(
      `⚠️ ALERTA REGRA-MÃE: Consumo excessivo detectado!\n` +
      `Consumo calculado: ${consumoEmKg.toFixed(2)}kg\n` +
      `Peso total com perda: ${pesoTotalComPerdaKg.toFixed(2)}kg\n` +
      `Razão: ${(consumoEmKg / pesoTotalComPerdaKg).toFixed(1)}x`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PROTEÇÃO AUTOMÁTICA CONTRA EXPLOSÃO DE CONSUMO
  // ═══════════════════════════════════════════════════════════════
  let limiteMaximo: number;
  let consumoExcedeLimite: boolean;

  if (insumo.tipo === 'peso') {
    // Limite máximo para insumo tipo peso = peso total com perda × 3
    limiteMaximo = pesoTotalComPerdaKg * 3;
    consumoExcedeLimite = consumoEmKg > limiteMaximo;
  } else {
    // Limite máximo para insumo tipo unidade = demanda × 3
    limiteMaximo = demandaTotalUnidades * 3;
    consumoExcedeLimite = consumoCalculado > limiteMaximo;
  }

  const protecao: ProtecaoAntiExplosao = {
    consumoExcedeLimite,
    limiteMaximo,
    consumoCalculado: insumo.tipo === 'peso' ? consumoEmKg : consumoCalculado,
    razaoExcedente: consumoExcedeLimite ? (consumoEmKg / limiteMaximo) : 0,
    mensagemErro: consumoExcedeLimite 
      ? "Erro lógico detectado: consumo acima do limite físico possível. Verifique cadastro por lote/traço."
      : null
  };

  // Log de auditoria quando proteção ativa
  if (consumoExcedeLimite) {
    console.error(
      `⛔ PROTEÇÃO ANTI-EXPLOSÃO ATIVADA!\n` +
      `Consumo calculado: ${protecao.consumoCalculado.toFixed(2)} ${insumo.unidade}\n` +
      `Limite máximo: ${limiteMaximo.toFixed(2)}\n` +
      `Razão excedente: ${protecao.razaoExcedente.toFixed(1)}x`
    );
  }

  return {
    consumoCalculado,
    consumoEmKg,
    pesoTotalFinalKg,
    pesoTotalComPerdaKg,
    alertaConsumoExcessivo,
    protecao
  };
}

/**
 * Determina o tipo de insumo baseado na unidade de medida
 * 
 * Regra:
 * - 'un', 'unidade', 'pcs', 'peça' → tipo 'unidade' (contagem discreta)
 * - 'kg', 'g', 'ml', 'l' → tipo 'peso' (proporcional ao peso)
 */
export function determinarTipoInsumo(unidade: string): TipoInsumo {
  const unidadeLower = unidade.toLowerCase();
  const unidadesDiscretas = ['un', 'unidade', 'unidades', 'pcs', 'pc', 'peça', 'peças'];
  
  if (unidadesDiscretas.includes(unidadeLower)) {
    return 'unidade';
  }
  
  return 'peso';
}

/**
 * Calcula o número de lotes/traços necessários
 * APENAS para organização da fila de produção, não para cálculo de consumo
 */
export function calcularQuantidadeLotes(
  demandaTotalUnidades: number,
  equivalenciaPorLote: number
): number {
  if (equivalenciaPorLote <= 0) return 1;
  return Math.ceil(demandaTotalUnidades / equivalenciaPorLote);
}

/**
 * Valida se o cálculo de insumo está correto
 * Retorna lista de erros encontrados
 */
export function validarCalculoInsumo(params: ParametrosCalculoInsumo, consumoCalculado: number): string[] {
  const erros: string[] = [];
  
  // Erro 1: Multiplicação direta por lote
  if (params.insumo.tipo === 'peso' && params.equivalenciaPorLoteUnidades) {
    const lotes = Math.ceil(params.demandaTotalUnidades / params.equivalenciaPorLoteUnidades);
    const calculoErrado = lotes * params.insumo.quantidadePorLote;
    
    // Se consumo calculado é igual ao cálculo errado (multiplicação por lote), é erro
    if (Math.abs(consumoCalculado - calculoErrado) < 0.01 && calculoErrado > 0) {
      // Verificar se não é coincidência
      const pesoCorreto = (params.pesoUnitarioFinalG * params.demandaTotalUnidades) / 1000;
      if (Math.abs(calculoErrado - pesoCorreto) > 0.1) {
        erros.push('Possível erro: multiplicação direta por lote detectada');
      }
    }
  }
  
  // Erro 2: Consumo negativo
  if (consumoCalculado < 0) {
    erros.push('Consumo negativo não é válido');
  }
  
  return erros;
}
