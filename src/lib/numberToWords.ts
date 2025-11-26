const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const dezADezenove = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function numeroAte999(num: number): string {
  if (num === 0) return '';
  if (num === 100) return 'cem';
  
  const centena = Math.floor(num / 100);
  const resto = num % 100;
  const dezena = Math.floor(resto / 10);
  const unidade = resto % 10;
  
  let resultado = '';
  
  if (centena > 0) {
    resultado = centenas[centena];
  }
  
  if (resto >= 10 && resto <= 19) {
    resultado += (resultado ? ' e ' : '') + dezADezenove[resto - 10];
  } else {
    if (dezena > 0) {
      resultado += (resultado ? ' e ' : '') + dezenas[dezena];
    }
    if (unidade > 0) {
      resultado += (resultado ? ' e ' : '') + unidades[unidade];
    }
  }
  
  return resultado;
}

function numeroParaTexto(num: number): string {
  if (num === 0) return 'zero';
  
  const milhares = Math.floor(num / 1000);
  const centenas = num % 1000;
  
  let resultado = '';
  
  if (milhares > 0) {
    if (milhares === 1) {
      resultado = 'mil';
    } else {
      resultado = numeroAte999(milhares) + ' mil';
    }
  }
  
  if (centenas > 0) {
    const textocentenas = numeroAte999(centenas);
    resultado += (resultado ? ' e ' : '') + textocentenas;
  }
  
  return resultado;
}

export function numberToWords(value: number | string, unidade: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num) || num === 0) return '';
  
  // Separar parte inteira e decimal
  const parteInteira = Math.floor(Math.abs(num));
  const parteDecimal = Math.round((Math.abs(num) - parteInteira) * 1000);
  
  let resultado = '';
  
  // Conversão baseada na unidade
  switch (unidade.toLowerCase()) {
    case 'kg':
      if (parteInteira > 0) {
        resultado = numeroParaTexto(parteInteira) + (parteInteira === 1 ? ' quilo' : ' quilos');
      }
      if (parteDecimal > 0) {
        const gramas = numeroParaTexto(parteDecimal);
        resultado += (resultado ? ' e ' : '') + gramas + (parteDecimal === 1 ? ' grama' : ' gramas');
      }
      break;
      
    case 'g':
      const totalGramas = Math.floor(num);
      resultado = numeroParaTexto(totalGramas) + (totalGramas === 1 ? ' grama' : ' gramas');
      break;
      
    case 'l':
      if (parteInteira > 0) {
        resultado = numeroParaTexto(parteInteira) + (parteInteira === 1 ? ' litro' : ' litros');
      }
      if (parteDecimal > 0) {
        const mililitros = numeroParaTexto(parteDecimal);
        resultado += (resultado ? ' e ' : '') + mililitros + (parteDecimal === 1 ? ' mililitro' : ' mililitros');
      }
      break;
      
    case 'ml':
      const totalMl = Math.floor(num);
      resultado = numeroParaTexto(totalMl) + (totalMl === 1 ? ' mililitro' : ' mililitros');
      break;
      
    case 'unidade':
    case 'unidades':
      const totalUnidades = Math.floor(num);
      resultado = numeroParaTexto(totalUnidades) + (totalUnidades === 1 ? ' unidade' : ' unidades');
      break;
      
    case 'traco':
      const totalTracos = Math.floor(num);
      resultado = numeroParaTexto(totalTracos) + (totalTracos === 1 ? ' traço' : ' traços');
      break;
      
    default:
      resultado = numeroParaTexto(Math.floor(num));
  }
  
  return resultado;
}
