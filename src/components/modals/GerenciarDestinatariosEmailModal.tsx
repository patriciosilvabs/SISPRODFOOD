import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Loader2, Mail, Plus, Trash2, Send, Store } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Destinatario {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
  loja_id: string | null;
  loja_nome?: string;
}

interface Loja {
  id: string;
  nome: string;
}

interface GerenciarDestinatariosEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GerenciarDestinatariosEmailModal({
  open,
  onOpenChange,
}: GerenciarDestinatariosEmailModalProps) {
  const { organizationId } = useOrganization();
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  
  // Form state
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novaLoja, setNovaLoja] = useState<string>('todas');

  useEffect(() => {
    if (open && organizationId) {
      fetchData();
    }
  }, [open, organizationId]);

  const fetchData = async () => {
    if (!organizationId) return;
    setLoading(true);
    
    try {
      // Fetch destinatarios with loja names
      const { data: destData, error: destError } = await supabase
        .from('destinatarios_email_contagem')
        .select(`
          id,
          email,
          nome,
          ativo,
          loja_id,
          lojas:loja_id (nome)
        `)
        .eq('organization_id', organizationId)
        .order('email');

      if (destError) throw destError;

      const formattedDest = (destData || []).map((d: any) => ({
        id: d.id,
        email: d.email,
        nome: d.nome,
        ativo: d.ativo ?? true,
        loja_id: d.loja_id,
        loja_nome: d.lojas?.nome || null,
      }));
      
      setDestinatarios(formattedDest);

      // Fetch lojas (excluindo CPD)
      const { data: lojasData, error: lojasError } = await supabase
        .from('lojas')
        .select('id, nome')
        .eq('organization_id', organizationId)
        .neq('tipo', 'cpd')
        .order('nome');

      if (lojasError) throw lojasError;
      setLojas(lojasData || []);
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar destinatários');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDestinatario = async () => {
    if (!novoEmail.trim()) {
      toast.error('Digite um email');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoEmail.trim())) {
      toast.error('Email inválido');
      return;
    }

    if (!organizationId) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('destinatarios_email_contagem')
        .insert({
          organization_id: organizationId,
          email: novoEmail.trim().toLowerCase(),
          nome: novoNome.trim() || null,
          loja_id: novaLoja === 'todas' ? null : novaLoja,
          ativo: true,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Este email já está cadastrado');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Destinatário adicionado!');
      setNovoEmail('');
      setNovoNome('');
      setNovaLoja('todas');
      fetchData();
    } catch (error) {
      console.error('Erro ao adicionar:', error);
      toast.error('Erro ao adicionar destinatário');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (id: string, ativo: boolean) => {
    try {
      const { error } = await supabase
        .from('destinatarios_email_contagem')
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setDestinatarios(prev =>
        prev.map(d => d.id === id ? { ...d, ativo } : d)
      );
      
      toast.success(ativo ? 'Destinatário ativado' : 'Destinatário desativado');
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('destinatarios_email_contagem')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDestinatarios(prev => prev.filter(d => d.id !== id));
      toast.success('Destinatário removido');
    } catch (error) {
      console.error('Erro ao remover:', error);
      toast.error('Erro ao remover destinatário');
    }
  };

  const handleEnviarTeste = async () => {
    const ativosCount = destinatarios.filter(d => d.ativo).length;
    if (ativosCount === 0) {
      toast.error('Nenhum destinatário ativo para enviar email de teste');
      return;
    }

    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('enviar-email-contagem', {
        body: {
          organizationId,
          lojaId: null,
          lojaNome: 'Teste',
          diaOperacional: new Date().toLocaleDateString('pt-BR'),
          itens: [
            { nome: 'Pão de Queijo (teste)', ideal: 100, sobra: 30, aProduzir: 70 },
            { nome: 'Coxinha (teste)', ideal: 50, sobra: 10, aProduzir: 40 },
          ],
          totalIdeal: 150,
          totalSobra: 40,
          totalAProduzir: 110,
          usuarioNome: 'Sistema (Teste)',
          isTeste: true,
        },
      });

      if (error) throw error;
      toast.success(`Email de teste enviado para ${ativosCount} destinatário(s)!`);
    } catch (error) {
      console.error('Erro ao enviar teste:', error);
      toast.error('Erro ao enviar email de teste');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Destinatários de Email
          </DialogTitle>
          <DialogDescription>
            Configure quem recebe o resumo da contagem quando uma loja encerrar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Formulário de adição */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <Label className="text-sm font-medium">Adicionar Novo Destinatário</Label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email" className="text-xs text-muted-foreground">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@empresa.com"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="nome" className="text-xs text-muted-foreground">
                    Nome (opcional)
                  </Label>
                  <Input
                    id="nome"
                    placeholder="Nome do destinatário"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="loja" className="text-xs text-muted-foreground">
                    Receber de qual loja?
                  </Label>
                  <Select value={novaLoja} onValueChange={setNovaLoja}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">
                        <span className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          Todas as lojas
                        </span>
                      </SelectItem>
                      {lojas.map((loja) => (
                        <SelectItem key={loja.id} value={loja.id}>
                          {loja.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddDestinatario}
                  disabled={saving || !novoEmail.trim()}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Lista de destinatários */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">
                  Destinatários Cadastrados ({destinatarios.length})
                </Label>
                {destinatarios.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnviarTeste}
                    disabled={sendingTest}
                  >
                    {sendingTest ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar Email de Teste
                  </Button>
                )}
              </div>

              {destinatarios.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum destinatário cadastrado</p>
                  <p className="text-sm">Adicione um email acima para começar.</p>
                </div>
              ) : (
                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-2">
                    {destinatarios.map((dest) => (
                      <div
                        key={dest.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          dest.ativo
                            ? 'bg-background'
                            : 'bg-muted/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Switch
                            checked={dest.ativo}
                            onCheckedChange={(checked) =>
                              handleToggleAtivo(dest.id, checked)
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {dest.nome || dest.email}
                            </p>
                            {dest.nome && (
                              <p className="text-sm text-muted-foreground truncate">
                                {dest.email}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Store className="h-3 w-3" />
                              {dest.loja_nome || 'Todas as lojas'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(dest.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
