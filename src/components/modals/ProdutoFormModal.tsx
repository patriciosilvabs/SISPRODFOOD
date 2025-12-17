import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';

interface Produto {
  id: string;
  nome: string;
  codigo: string | null;
  categoria: string;
  unidade_consumo: string | null;
  classificacao: string | null;
  tipo_produto: string;
  ativo: boolean;
  modo_envio?: string | null;
  peso_por_unidade_kg?: number | null;
}

interface ProdutoFormModalProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  produto?: Produto | null;
}

const categoriaOptions = [
  { value: 'congelado', label: 'Congelado' },
  { value: 'refrigerado', label: 'Refrigerado' },
  { value: 'ambiente', label: 'Ambiente' },
  { value: 'diversos', label: 'Diversos' },
  { value: 'material_escritorio', label: 'Material de Escritório / Administrativo' },
  { value: 'material_limpeza', label: 'Material de Limpeza' },
  { value: 'embalagens', label: 'Embalagens' },
  { value: 'descartaveis', label: 'Descartáveis' },
  { value: 'equipamentos', label: 'Equipamentos' },
];

const unidadeOptions = [
  { value: 'Unidade (un)', label: 'Unidade (un)' },
  { value: 'Quilograma (kg)', label: 'Quilograma (kg)' },
  { value: 'Grama (g)', label: 'Grama (g)' },
  { value: 'Litro (L)', label: 'Litro (L)' },
  { value: 'Mililitro (mL)', label: 'Mililitro (mL)' },
  { value: 'Caixa (cx)', label: 'Caixa (cx)' },
  { value: 'Pacote (pct)', label: 'Pacote (pct)' },
  { value: 'Fardo (fd)', label: 'Fardo (fd)' },
];

const classificacaoOptions = [
  { value: 'A', label: 'A - Alto consumo/valor' },
  { value: 'B', label: 'B - Consumo/valor médio' },
  { value: 'C', label: 'C - Baixo consumo/valor' },
];

const tipoProdutoOptions = [
  { value: 'lacrado', label: 'Lacrado' },
  { value: 'porcionado', label: 'Porcionado' },
  { value: 'lote', label: 'Lote' },
  { value: 'lote_kg', label: 'Lote: KG' },
  { value: 'lote_qtde', label: 'Lote: QTDE' },
  { value: 'simples', label: 'Simples' },
];

const modoEnvioOptions = [
  { value: 'peso', label: 'Por Peso (fracionado)' },
  { value: 'unidade', label: 'Por Unidade (lacrado/fechado)' },
  { value: 'lote_kg', label: 'Por Lote KG (peso fixo)' },
  { value: 'lote_qtde', label: 'Por Lote QTDE (quantidade fixa)' },
];

// Helper para obter configuração do campo dinâmico
const getCampoDinamico = (modoEnvio: string) => {
  switch (modoEnvio) {
    case 'unidade':
      return { label: 'Peso por Unidade (kg)', placeholder: 'Ex: 1.5', descricao: 'Ex: Catupiry 1,5kg = cada bisnaga pesa 1.5 kg' };
    case 'lote_kg':
      return { label: 'Peso Total do Lote (kg)', placeholder: 'Ex: 5.0', descricao: 'Ex: Caixa de frango = 5kg por caixa' };
    case 'lote_qtde':
      return { label: 'Quantidade por Lote', placeholder: 'Ex: 50', descricao: 'Ex: Caixa de salgados = 50 unidades por caixa' };
    default:
      return null;
  }
};

// Helper para descrição do modo de envio
const getDescricaoModoEnvio = (modoEnvio: string) => {
  switch (modoEnvio) {
    case 'peso':
      return '⚖️ Envio fracionado por peso (kg, g).';
    case 'unidade':
      return '📦 Enviado em unidades fechadas. O sistema converterá peso → unidades.';
    case 'lote_kg':
      return '📦 Enviado em lotes com peso fixo. Ex: caixas de 5kg.';
    case 'lote_qtde':
      return '📦 Enviado em lotes com quantidade fixa. Ex: caixas de 50 unidades.';
    default:
      return '';
  }
};

export function ProdutoFormModal({ open, onClose, produto }: ProdutoFormModalProps) {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    categoria: '',
    unidade_consumo: '',
    classificacao: '',
    tipo_produto: 'simples',
    ativo: true,
    modo_envio: 'peso',
    peso_por_unidade_kg: '',
    dias_cobertura_desejado: '7',
    lead_time_real_dias: '2',
  });

  useEffect(() => {
    if (produto) {
      setFormData({
        nome: produto.nome,
        codigo: produto.codigo || '',
        categoria: produto.categoria,
        unidade_consumo: produto.unidade_consumo || '',
        classificacao: produto.classificacao || '',
        tipo_produto: produto.tipo_produto || 'simples',
        ativo: produto.ativo ?? true,
        modo_envio: produto.modo_envio || 'peso',
        peso_por_unidade_kg: produto.peso_por_unidade_kg?.toString() || '',
        dias_cobertura_desejado: (produto as any).dias_cobertura_desejado?.toString() || '7',
        lead_time_real_dias: (produto as any).lead_time_real_dias?.toString() || '2',
      });
    } else {
      setFormData({
        nome: '',
        codigo: '',
        categoria: '',
        unidade_consumo: '',
        classificacao: '',
        tipo_produto: 'simples',
        ativo: true,
        modo_envio: 'peso',
        peso_por_unidade_kg: '',
        dias_cobertura_desejado: '7',
        lead_time_real_dias: '2',
      });
    }
  }, [produto, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }

    if (!formData.codigo.trim()) {
      toast.error('Código é obrigatório');
      return;
    }

    if (!formData.categoria) {
      toast.error('Categoria é obrigatória');
      return;
    }

    // Validação do campo dinâmico baseado no modo de envio
    const modoRequerCampo = ['unidade', 'lote_kg', 'lote_qtde'].includes(formData.modo_envio);
    if (modoRequerCampo && (!formData.peso_por_unidade_kg || parseFloat(formData.peso_por_unidade_kg) <= 0)) {
      const campoDinamico = getCampoDinamico(formData.modo_envio);
      toast.error(`${campoDinamico?.label || 'Campo'} é obrigatório para este modo de envio`);
      return;
    }

    try {
      setLoading(true);

      if (!organizationId) {
        toast.error('Organização não identificada. Faça login novamente.');
        return;
      }

      const dataToSave = {
        nome: formData.nome.trim(),
        codigo: formData.codigo.trim(),
        categoria: formData.categoria as any,
        unidade_consumo: formData.unidade_consumo.trim() || null,
        classificacao: formData.classificacao || null,
        tipo_produto: formData.tipo_produto as any,
        ativo: formData.ativo,
        organization_id: organizationId,
        modo_envio: formData.modo_envio,
        peso_por_unidade_kg: ['unidade', 'lote_kg', 'lote_qtde'].includes(formData.modo_envio) && formData.peso_por_unidade_kg 
          ? parseFloat(formData.peso_por_unidade_kg) 
          : null,
        dias_cobertura_desejado: parseInt(formData.dias_cobertura_desejado) || 7,
        lead_time_real_dias: parseInt(formData.lead_time_real_dias) || 2,
      };

      if (produto) {
        // Update existing
        const { error } = await supabase
          .from('produtos')
          .update(dataToSave)
          .eq('id', produto.id);

        if (error) throw error;
        toast.success('Produto atualizado com sucesso');
      } else {
        // Create new
        const { error } = await supabase
          .from('produtos')
          .insert([dataToSave]);

        if (error) throw error;
        toast.success('Produto criado com sucesso');
      }

      onClose(true);
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      
      if (error.code === '23505') {
        toast.error('Já existe um produto com este código');
      } else {
        toast.error('Erro ao salvar produto');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {produto ? 'Editar Produto' : 'Adicionar Produto'}
            </DialogTitle>
            <DialogDescription>
              {produto
                ? 'Atualize as informações do produto'
                : 'Preencha as informações do novo produto'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Produto *</Label>
              <Input
                id="nome"
                placeholder="Ex: Bobina Máquina de Cartão"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                placeholder="Ex: BOB-001"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                required
              >
                <SelectTrigger id="categoria">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoriaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidade_consumo">Unidade de Consumo</Label>
              <Select
                value={formData.unidade_consumo}
                onValueChange={(value) =>
                  setFormData({ ...formData, unidade_consumo: value })
                }
              >
                <SelectTrigger id="unidade_consumo">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidadeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="classificacao">Classificação ABC</Label>
              <Select
                value={formData.classificacao}
                onValueChange={(value) =>
                  setFormData({ ...formData, classificacao: value })
                }
              >
                <SelectTrigger id="classificacao">
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  {classificacaoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parâmetros Lista de Compras */}
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-3">📊 Parâmetros Lista de Compras</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dias_cobertura">Dias de Cobertura</Label>
                  <Input
                    id="dias_cobertura"
                    type="number"
                    min="1"
                    value={formData.dias_cobertura_desejado}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dias_cobertura_desejado: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Dias de estoque desejado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lead_time">Lead Time (dias)</Label>
                  <Input
                    id="lead_time"
                    type="number"
                    min="0"
                    value={formData.lead_time_real_dias}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lead_time_real_dias: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo entrega fornecedor
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_produto">Tipo de Produto *</Label>
              <Select
                value={formData.tipo_produto}
                onValueChange={(value) =>
                  setFormData({ ...formData, tipo_produto: value })
                }
              >
                <SelectTrigger id="tipo_produto">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipoProdutoOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modo_envio">Modo de Envio *</Label>
              <Select
                value={formData.modo_envio}
                onValueChange={(value) =>
                  setFormData({ ...formData, modo_envio: value, peso_por_unidade_kg: value === 'peso' ? '' : formData.peso_por_unidade_kg })
                }
              >
                <SelectTrigger id="modo_envio">
                  <SelectValue placeholder="Selecione o modo" />
                </SelectTrigger>
                <SelectContent>
                  {modoEnvioOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getDescricaoModoEnvio(formData.modo_envio)}
              </p>
            </div>

            {/* Campo dinâmico baseado no modo de envio */}
            {getCampoDinamico(formData.modo_envio) && (
              <div className="space-y-2">
                <Label htmlFor="peso_por_unidade_kg">{getCampoDinamico(formData.modo_envio)?.label} *</Label>
                <Input
                  id="peso_por_unidade_kg"
                  type="number"
                  step={formData.modo_envio === 'lote_qtde' ? '1' : '0.01'}
                  min={formData.modo_envio === 'lote_qtde' ? '1' : '0.01'}
                  placeholder={getCampoDinamico(formData.modo_envio)?.placeholder}
                  value={formData.peso_por_unidade_kg}
                  onChange={(e) => setFormData({ ...formData, peso_por_unidade_kg: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {getCampoDinamico(formData.modo_envio)?.descricao}
                </p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="ativo" className="cursor-pointer">
                Produto ativo
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose()}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : produto ? 'Salvar Alterações' : 'Adicionar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
