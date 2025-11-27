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

export function ProdutoFormModal({ open, onClose, produto }: ProdutoFormModalProps) {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    categoria: '',
    unidade_consumo: '',
    classificacao: '',
  });

  useEffect(() => {
    if (produto) {
      setFormData({
        nome: produto.nome,
        codigo: produto.codigo || '',
        categoria: produto.categoria,
        unidade_consumo: produto.unidade_consumo || '',
        classificacao: produto.classificacao || '',
      });
    } else {
      setFormData({
        nome: '',
        codigo: '',
        categoria: '',
        unidade_consumo: '',
        classificacao: '',
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
        organization_id: organizationId,
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
