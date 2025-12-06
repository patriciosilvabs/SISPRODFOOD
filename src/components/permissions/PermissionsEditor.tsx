import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger 
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { 
  PERMISSIONS_CONFIG, 
  expandPermissionsWithDependencies,
  getPermissionDependencies,
  SECTION_TO_UI_PAGE
} from '@/lib/permissions';
import { UI_PAGES_CONFIG, getPageConfigById, UIPermissionsConfig, getDefaultConfig } from '@/lib/ui-permissions-config';
import { Wand2, Check, Columns3 } from 'lucide-react';

interface PermissionPreset {
  id: string;
  nome: string;
  descricao: string | null;
  permissions: string[];
  is_system: boolean;
}

interface PermissionsEditorProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
  userId?: string;
  organizationId?: string;
  onUIPermissionsChange?: (uiPermissions: Record<string, UIPermissionsConfig>) => void;
  initialUIPermissions?: Record<string, UIPermissionsConfig>;
}

export const PermissionsEditor = ({ 
  selectedPermissions, 
  onChange,
  disabled = false,
  userId,
  organizationId,
  onUIPermissionsChange,
  initialUIPermissions = {}
}: PermissionsEditorProps) => {
  const [presets, setPresets] = useState<PermissionPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [uiPermissions, setUIPermissions] = useState<Record<string, UIPermissionsConfig>>(initialUIPermissions);

  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const { data, error } = await supabase
          .from('permission_presets')
          .select('*')
          .order('is_system', { ascending: false })
          .order('nome');

        if (!error && data) {
          setPresets(data.map(p => ({
            ...p,
            permissions: Array.isArray(p.permissions) ? p.permissions as string[] : []
          })));
        }
      } catch (err) {
        console.error('Erro ao carregar presets:', err);
      } finally {
        setLoadingPresets(false);
      }
    };

    fetchPresets();
  }, []);

  // Carregar UI permissions existentes do usuário
  useEffect(() => {
    const fetchUIPermissions = async () => {
      if (!userId || !organizationId) return;

      try {
        const { data, error } = await supabase
          .from('ui_permissions')
          .select('pagina_id, config')
          .eq('user_id', userId)
          .eq('organization_id', organizationId);

        if (!error && data) {
          const permissions: Record<string, UIPermissionsConfig> = {};
          data.forEach(item => {
            permissions[item.pagina_id] = item.config as unknown as UIPermissionsConfig;
          });
          setUIPermissions(permissions);
        }
      } catch (err) {
        console.error('Erro ao carregar UI permissions:', err);
      }
    };

    fetchUIPermissions();
  }, [userId, organizationId]);

  const handlePermissionToggle = (permissionKey: string, checked: boolean) => {
    if (disabled) return;

    let newPermissions = [...selectedPermissions];

    if (checked) {
      const deps = getPermissionDependencies(permissionKey);
      newPermissions = [...new Set([...newPermissions, permissionKey, ...deps])];
    } else {
      newPermissions = newPermissions.filter(p => p !== permissionKey);
    }

    onChange(newPermissions);
  };

  const handleSectionToggle = (sectionKey: string, checked: boolean) => {
    if (disabled) return;

    const section = PERMISSIONS_CONFIG.find(s => s.key === sectionKey);
    if (!section) return;

    const sectionPermKeys = section.permissions.map(p => p.key);
    
    let newPermissions = [...selectedPermissions];

    if (checked) {
      newPermissions = [...new Set([...newPermissions, ...sectionPermKeys])];
    } else {
      newPermissions = newPermissions.filter(p => !sectionPermKeys.includes(p));
    }

    onChange(newPermissions);
  };

  const handlePresetApply = (presetId: string) => {
    if (disabled) return;

    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const expanded = expandPermissionsWithDependencies(preset.permissions);
    onChange(expanded);
  };

  const handleUIColumnToggle = (pageId: string, columnId: string, checked: boolean) => {
    if (disabled) return;

    const pageConfig = getPageConfigById(pageId);
    if (!pageConfig) return;

    const currentConfig = uiPermissions[pageId] || getDefaultConfig(pageConfig);
    
    const newConfig: UIPermissionsConfig = {
      ...currentConfig,
      colunas: {
        ...currentConfig.colunas,
        [columnId]: { ativo: checked }
      }
    };

    const newUIPermissions = {
      ...uiPermissions,
      [pageId]: newConfig
    };

    setUIPermissions(newUIPermissions);
    onUIPermissionsChange?.(newUIPermissions);
  };

  const handleUISecaoToggle = (pageId: string, secaoId: string, checked: boolean) => {
    if (disabled) return;

    const pageConfig = getPageConfigById(pageId);
    if (!pageConfig) return;

    const currentConfig = uiPermissions[pageId] || getDefaultConfig(pageConfig);
    
    const newConfig: UIPermissionsConfig = {
      ...currentConfig,
      secoes: {
        ...currentConfig.secoes,
        [secaoId]: { ativo: checked }
      }
    };

    const newUIPermissions = {
      ...uiPermissions,
      [pageId]: newConfig
    };

    setUIPermissions(newUIPermissions);
    onUIPermissionsChange?.(newUIPermissions);
  };

  const handleUIAcaoToggle = (pageId: string, acaoId: string, checked: boolean) => {
    if (disabled) return;

    const pageConfig = getPageConfigById(pageId);
    if (!pageConfig) return;

    const currentConfig = uiPermissions[pageId] || getDefaultConfig(pageConfig);
    
    const newConfig: UIPermissionsConfig = {
      ...currentConfig,
      acoes: {
        ...currentConfig.acoes,
        [acaoId]: { ativo: checked }
      }
    };

    const newUIPermissions = {
      ...uiPermissions,
      [pageId]: newConfig
    };

    setUIPermissions(newUIPermissions);
    onUIPermissionsChange?.(newUIPermissions);
  };

  const isColumnActive = (pageId: string, columnId: string): boolean => {
    const pageConfig = getPageConfigById(pageId);
    if (!pageConfig) return true;

    const config = uiPermissions[pageId] || getDefaultConfig(pageConfig);
    return config.colunas[columnId]?.ativo ?? true;
  };

  const isSecaoActive = (pageId: string, secaoId: string): boolean => {
    const pageConfig = getPageConfigById(pageId);
    if (!pageConfig) return true;

    const config = uiPermissions[pageId] || getDefaultConfig(pageConfig);
    return config.secoes[secaoId]?.ativo ?? true;
  };

  const isAcaoActive = (pageId: string, acaoId: string): boolean => {
    const pageConfig = getPageConfigById(pageId);
    if (!pageConfig) return true;

    const config = uiPermissions[pageId] || getDefaultConfig(pageConfig);
    return config.acoes[acaoId]?.ativo ?? true;
  };

  const isSectionFullySelected = (sectionKey: string): boolean => {
    const section = PERMISSIONS_CONFIG.find(s => s.key === sectionKey);
    if (!section) return false;
    return section.permissions.every(p => selectedPermissions.includes(p.key));
  };

  const isSectionPartiallySelected = (sectionKey: string): boolean => {
    const section = PERMISSIONS_CONFIG.find(s => s.key === sectionKey);
    if (!section) return false;
    const hasAny = section.permissions.some(p => selectedPermissions.includes(p.key));
    const hasAll = section.permissions.every(p => selectedPermissions.includes(p.key));
    return hasAny && !hasAll;
  };

  const getSectionSelectedCount = (sectionKey: string): number => {
    const section = PERMISSIONS_CONFIG.find(s => s.key === sectionKey);
    if (!section) return 0;
    return section.permissions.filter(p => selectedPermissions.includes(p.key)).length;
  };

  const sectionHasViewPermission = (sectionKey: string): boolean => {
    const viewPermission = `${sectionKey}.view`;
    const resumoViewPermission = `${sectionKey}.resumo.view`;
    return selectedPermissions.includes(viewPermission) || selectedPermissions.includes(resumoViewPermission);
  };

  const renderUIPermissionsForSection = (sectionKey: string) => {
    const pageId = SECTION_TO_UI_PAGE[sectionKey];
    if (!pageId) return null;

    const pageConfig = getPageConfigById(pageId);
    if (!pageConfig) return null;

    const hasViewAccess = sectionHasViewPermission(sectionKey);

    return (
      <div className={`mt-4 p-3 rounded-lg border border-dashed ${hasViewAccess ? 'border-primary/30 bg-primary/5' : 'border-muted bg-muted/30 opacity-50'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Columns3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Visibilidade de Colunas</span>
          {!hasViewAccess && (
            <Badge variant="outline" className="text-xs">
              Requer permissão de visualização
            </Badge>
          )}
        </div>

        {/* Colunas */}
        {pageConfig.colunas.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Colunas:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pageConfig.colunas.map(coluna => (
                <div 
                  key={coluna.id}
                  className="flex items-center gap-2 p-2 rounded bg-background/50"
                >
                  <Checkbox
                    id={`col-${pageId}-${coluna.id}`}
                    checked={isColumnActive(pageId, coluna.id)}
                    onCheckedChange={(checked) => 
                      handleUIColumnToggle(pageId, coluna.id, !!checked)
                    }
                    disabled={disabled || !hasViewAccess}
                  />
                  <Label 
                    htmlFor={`col-${pageId}-${coluna.id}`}
                    className="text-xs cursor-pointer"
                  >
                    {coluna.nome}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seções */}
        {pageConfig.secoes.length > 0 && (
          <div className="space-y-2 mt-3">
            <span className="text-xs text-muted-foreground font-medium">Seções:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pageConfig.secoes.map(secao => (
                <div 
                  key={secao.id}
                  className="flex items-center gap-2 p-2 rounded bg-background/50"
                >
                  <Checkbox
                    id={`sec-${pageId}-${secao.id}`}
                    checked={isSecaoActive(pageId, secao.id)}
                    onCheckedChange={(checked) => 
                      handleUISecaoToggle(pageId, secao.id, !!checked)
                    }
                    disabled={disabled || !hasViewAccess}
                  />
                  <Label 
                    htmlFor={`sec-${pageId}-${secao.id}`}
                    className="text-xs cursor-pointer"
                  >
                    {secao.nome}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        {pageConfig.acoes.length > 0 && (
          <div className="space-y-2 mt-3">
            <span className="text-xs text-muted-foreground font-medium">Ações:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pageConfig.acoes.map(acao => (
                <div 
                  key={acao.id}
                  className="flex items-center gap-2 p-2 rounded bg-background/50"
                >
                  <Checkbox
                    id={`acao-${pageId}-${acao.id}`}
                    checked={isAcaoActive(pageId, acao.id)}
                    onCheckedChange={(checked) => 
                      handleUIAcaoToggle(pageId, acao.id, !!checked)
                    }
                    disabled={disabled || !hasViewAccess}
                  />
                  <Label 
                    htmlFor={`acao-${pageId}-${acao.id}`}
                    className="text-xs cursor-pointer"
                  >
                    {acao.nome}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <Wand2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Aplicar Preset:</span>
        <Select onValueChange={handlePresetApply} disabled={disabled || loadingPresets}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecionar preset..." />
          </SelectTrigger>
          <SelectContent>
            {presets.map(preset => (
              <SelectItem key={preset.id} value={preset.id}>
                <div className="flex items-center gap-2">
                  <span>{preset.nome}</span>
                  {preset.is_system && (
                    <Badge variant="secondary" className="text-xs">Sistema</Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contador de permissões */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {selectedPermissions.length} permissão(ões) selecionada(s)
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onChange([])}
          disabled={disabled || selectedPermissions.length === 0}
        >
          Limpar todas
        </Button>
      </div>

      {/* Accordion de seções */}
      <Accordion type="multiple" className="w-full space-y-2">
        {PERMISSIONS_CONFIG.map(section => (
          <AccordionItem 
            key={section.key} 
            value={section.key}
            className="border rounded-lg px-4"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 flex-1">
                <Checkbox
                  checked={isSectionFullySelected(section.key)}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement).dataset.state = 
                        isSectionPartiallySelected(section.key) ? 'indeterminate' : 
                        isSectionFullySelected(section.key) ? 'checked' : 'unchecked';
                    }
                  }}
                  onCheckedChange={(checked) => handleSectionToggle(section.key, !!checked)}
                  disabled={disabled}
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=indeterminate]:bg-primary/50"
                />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{section.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {section.description}
                  </span>
                </div>
                <Badge variant="outline" className="ml-auto mr-2">
                  {getSectionSelectedCount(section.key)}/{section.permissions.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid gap-3 ml-7 mt-2">
                {section.permissions.map(permission => (
                  <div 
                    key={permission.key}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50"
                  >
                    <Checkbox
                      id={permission.key}
                      checked={selectedPermissions.includes(permission.key)}
                      onCheckedChange={(checked) => 
                        handlePermissionToggle(permission.key, !!checked)
                      }
                      disabled={disabled}
                    />
                    <div className="flex flex-col gap-0.5">
                      <Label 
                        htmlFor={permission.key}
                        className="font-medium cursor-pointer"
                      >
                        {permission.label}
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {permission.description}
                      </span>
                      {permission.dependsOn && permission.dependsOn.length > 0 && (
                        <span className="text-xs text-primary/70">
                          Requer: {permission.dependsOn.join(', ')}
                        </span>
                      )}
                    </div>
                    {selectedPermissions.includes(permission.key) && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </div>
                ))}
              </div>

              {/* UI Permissions para esta seção */}
              {renderUIPermissionsForSection(section.key)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
