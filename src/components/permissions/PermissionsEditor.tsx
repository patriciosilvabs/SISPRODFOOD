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
  getPermissionDependencies
} from '@/lib/permissions';
import { Wand2, Check, ChevronDown } from 'lucide-react';

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
}

export const PermissionsEditor = ({ 
  selectedPermissions, 
  onChange,
  disabled = false
}: PermissionsEditorProps) => {
  const [presets, setPresets] = useState<PermissionPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(true);

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

  const handlePermissionToggle = (permissionKey: string, checked: boolean) => {
    if (disabled) return;

    let newPermissions = [...selectedPermissions];

    if (checked) {
      // Adicionar permissão e suas dependências
      const deps = getPermissionDependencies(permissionKey);
      newPermissions = [...new Set([...newPermissions, permissionKey, ...deps])];
    } else {
      // Remover permissão
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
      // Adicionar todas as permissões da seção
      newPermissions = [...new Set([...newPermissions, ...sectionPermKeys])];
    } else {
      // Remover todas as permissões da seção
      newPermissions = newPermissions.filter(p => !sectionPermKeys.includes(p));
    }

    onChange(newPermissions);
  };

  const handlePresetApply = (presetId: string) => {
    if (disabled) return;

    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    // Expandir permissões do preset com dependências
    const expanded = expandPermissionsWithDependencies(preset.permissions);
    onChange(expanded);
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
