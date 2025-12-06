import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  UI_PAGES_CONFIG, 
  UIPageConfig, 
  UIPermissionsConfig,
  getDefaultConfig 
} from '@/lib/ui-permissions-config';
import { 
  Settings2, 
  LayoutGrid, 
  Columns, 
  MousePointer2, 
  Save,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';

interface PagePermissionsState {
  [paginaId: string]: UIPermissionsConfig;
}

const ConfigurarInterface = () => {
  const { organizationId } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<PagePermissionsState>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Inicializar com configurações padrão
  const initializeDefaults = useCallback(() => {
    const defaults: PagePermissionsState = {};
    UI_PAGES_CONFIG.forEach(page => {
      defaults[page.id] = getDefaultConfig(page);
    });
    return defaults;
  }, []);

  // Carregar configurações do banco
  const fetchPermissions = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ui_permissions')
        .select('pagina_id, config')
        .eq('organization_id', organizationId);

      if (error) throw error;

      // Começar com defaults
      const newPermissions = initializeDefaults();

      // Sobrescrever com valores do banco
      data?.forEach(item => {
        if (item.config && typeof item.config === 'object') {
          newPermissions[item.pagina_id] = item.config as unknown as UIPermissionsConfig;
        }
      });

      setPermissions(newPermissions);
    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações de interface',
        variant: 'destructive'
      });
      setPermissions(initializeDefaults());
    } finally {
      setLoading(false);
    }
  }, [organizationId, initializeDefaults]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Toggle página ativa
  const togglePageActive = (paginaId: string) => {
    setPermissions(prev => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        ativo: !prev[paginaId].ativo
      }
    }));
    setHasChanges(true);
  };

  // Toggle seção ativa
  const toggleSecao = (paginaId: string, secaoId: string) => {
    setPermissions(prev => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        secoes: {
          ...prev[paginaId].secoes,
          [secaoId]: { ativo: !prev[paginaId].secoes[secaoId]?.ativo }
        }
      }
    }));
    setHasChanges(true);
  };

  // Toggle coluna ativa
  const toggleColuna = (paginaId: string, colunaId: string) => {
    setPermissions(prev => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        colunas: {
          ...prev[paginaId].colunas,
          [colunaId]: { ativo: !prev[paginaId].colunas[colunaId]?.ativo }
        }
      }
    }));
    setHasChanges(true);
  };

  // Toggle ação ativa
  const toggleAcao = (paginaId: string, acaoId: string) => {
    setPermissions(prev => ({
      ...prev,
      [paginaId]: {
        ...prev[paginaId],
        acoes: {
          ...prev[paginaId].acoes,
          [acaoId]: { ativo: !prev[paginaId].acoes[acaoId]?.ativo }
        }
      }
    }));
    setHasChanges(true);
  };

  // Salvar todas as configurações
  const handleSave = async () => {
    if (!organizationId) return;

    setSaving(true);
    try {
      // Fazer upsert de todas as páginas uma por uma
      for (const [paginaId, config] of Object.entries(permissions)) {
        const { error } = await supabase
          .from('ui_permissions')
          .upsert(
            {
              organization_id: organizationId,
              pagina_id: paginaId,
              config: JSON.parse(JSON.stringify(config))
            } as any, 
            { 
              onConflict: 'organization_id,pagina_id',
              ignoreDuplicates: false 
            }
          );

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Configurações de interface salvas com sucesso'
      });
      setHasChanges(false);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Resetar para padrão
  const handleReset = () => {
    setPermissions(initializeDefaults());
    setHasChanges(true);
  };

  // Contar itens ativos
  const countActive = (items: Record<string, { ativo: boolean }> | undefined): { active: number; total: number } => {
    if (!items) return { active: 0, total: 0 };
    const entries = Object.values(items);
    return {
      active: entries.filter(i => i.ativo !== false).length,
      total: entries.length
    };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings2 className="h-6 w-6" />
              Configurar Interface
            </h1>
            <p className="text-muted-foreground mt-1">
              Personalize quais elementos da interface os usuários da sua organização podem ver
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar Padrão
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>

        {hasChanges && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-600 dark:text-yellow-400">
            Você tem alterações não salvas. Clique em "Salvar Alterações" para aplicar.
          </div>
        )}

        {/* Lista de Páginas */}
        <Accordion type="multiple" className="space-y-4">
          {UI_PAGES_CONFIG.map((page) => {
            const config = permissions[page.id];
            const secoesCount = countActive(config?.secoes);
            const colunasCount = countActive(config?.colunas);
            const acoesCount = countActive(config?.acoes);

            return (
              <AccordionItem 
                key={page.id} 
                value={page.id}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={config?.ativo !== false}
                        onCheckedChange={() => togglePageActive(page.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="text-left">
                        <div className="font-medium flex items-center gap-2">
                          {page.nome}
                          {config?.ativo === false && (
                            <Badge variant="secondary" className="text-xs">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Oculta
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{page.descricao}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {page.secoes.length > 0 && (
                        <span className="flex items-center gap-1">
                          <LayoutGrid className="h-3 w-3" />
                          {secoesCount.active}/{secoesCount.total}
                        </span>
                      )}
                      {page.colunas.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Columns className="h-3 w-3" />
                          {colunasCount.active}/{colunasCount.total}
                        </span>
                      )}
                      {page.acoes.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MousePointer2 className="h-3 w-3" />
                          {acoesCount.active}/{acoesCount.total}
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-6 pt-4">
                    {/* Seções */}
                    {page.secoes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                          Seções
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {page.secoes.map((secao) => (
                            <div 
                              key={secao.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card"
                            >
                              <div>
                                <Label className="font-medium">{secao.nome}</Label>
                                {secao.descricao && (
                                  <p className="text-xs text-muted-foreground">{secao.descricao}</p>
                                )}
                              </div>
                              <Switch
                                checked={config?.secoes?.[secao.id]?.ativo !== false}
                                onCheckedChange={() => toggleSecao(page.id, secao.id)}
                                disabled={config?.ativo === false}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {page.secoes.length > 0 && (page.colunas.length > 0 || page.acoes.length > 0) && (
                      <Separator />
                    )}

                    {/* Colunas */}
                    {page.colunas.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Columns className="h-4 w-4 text-muted-foreground" />
                          Colunas de Tabelas
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {page.colunas.map((coluna) => (
                            <div 
                              key={coluna.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card"
                            >
                              <Label className="font-medium text-sm">{coluna.nome}</Label>
                              <Switch
                                checked={config?.colunas?.[coluna.id]?.ativo !== false}
                                onCheckedChange={() => toggleColuna(page.id, coluna.id)}
                                disabled={config?.ativo === false}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {page.colunas.length > 0 && page.acoes.length > 0 && (
                      <Separator />
                    )}

                    {/* Ações */}
                    {page.acoes.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                          Botões e Ações
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {page.acoes.map((acao) => (
                            <div 
                              key={acao.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card"
                            >
                              <div>
                                <Label className="font-medium text-sm">{acao.nome}</Label>
                                {acao.descricao && (
                                  <p className="text-xs text-muted-foreground">{acao.descricao}</p>
                                )}
                              </div>
                              <Switch
                                checked={config?.acoes?.[acao.id]?.ativo !== false}
                                onCheckedChange={() => toggleAcao(page.id, acao.id)}
                                disabled={config?.ativo === false}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </Layout>
  );
};

export default ConfigurarInterface;
