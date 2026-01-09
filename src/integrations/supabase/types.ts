export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alertas_estoque: {
        Row: {
          created_at: string | null
          dias_cobertura_restante: number | null
          enviado_em: string | null
          estoque_atual: number | null
          id: string
          item_id: string
          item_nome: string
          item_tipo: string
          organization_id: string | null
          resolvido_em: string | null
          status_alerta: string
        }
        Insert: {
          created_at?: string | null
          dias_cobertura_restante?: number | null
          enviado_em?: string | null
          estoque_atual?: number | null
          id?: string
          item_id: string
          item_nome: string
          item_tipo: string
          organization_id?: string | null
          resolvido_em?: string | null
          status_alerta: string
        }
        Update: {
          created_at?: string | null
          dias_cobertura_restante?: number | null
          enviado_em?: string | null
          estoque_atual?: number | null
          id?: string
          item_id?: string
          item_nome?: string
          item_tipo?: string
          organization_id?: string | null
          resolvido_em?: string | null
          status_alerta?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_estoque_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string | null
          user_agent: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_alertas: {
        Row: {
          alertas_email_ativos: boolean | null
          created_at: string | null
          emails_destinatarios: string[] | null
          enviar_apenas_criticos: boolean | null
          frequencia: string | null
          horario_envio_preferido: string | null
          id: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          alertas_email_ativos?: boolean | null
          created_at?: string | null
          emails_destinatarios?: string[] | null
          enviar_apenas_criticos?: boolean | null
          frequencia?: string | null
          horario_envio_preferido?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alertas_email_ativos?: boolean | null
          created_at?: string | null
          emails_destinatarios?: string[] | null
          enviar_apenas_criticos?: boolean | null
          frequencia?: string | null
          horario_envio_preferido?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracao_alertas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          id: string
          organization_id: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          id?: string
          organization_id?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          id?: string
          organization_id?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_sistema_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consumo_historico: {
        Row: {
          consumo_programado: number
          consumo_real: number
          created_at: string | null
          data: string | null
          id: string
          insumo_id: string
          insumo_nome: string
          item_id: string
          item_nome: string
          organization_id: string | null
          producao_registro_id: string | null
          tipo_insumo: string
          unidade: string
          usuario_id: string
          usuario_nome: string
          variacao: number | null
          variacao_percentual: number | null
        }
        Insert: {
          consumo_programado: number
          consumo_real: number
          created_at?: string | null
          data?: string | null
          id?: string
          insumo_id: string
          insumo_nome: string
          item_id: string
          item_nome: string
          organization_id?: string | null
          producao_registro_id?: string | null
          tipo_insumo?: string
          unidade?: string
          usuario_id: string
          usuario_nome: string
          variacao?: number | null
          variacao_percentual?: number | null
        }
        Update: {
          consumo_programado?: number
          consumo_real?: number
          created_at?: string | null
          data?: string | null
          id?: string
          insumo_id?: string
          insumo_nome?: string
          item_id?: string
          item_nome?: string
          organization_id?: string | null
          producao_registro_id?: string | null
          tipo_insumo?: string
          unidade?: string
          usuario_id?: string
          usuario_nome?: string
          variacao?: number | null
          variacao_percentual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consumo_historico_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_historico_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_historico_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_historico_producao_registro_id_fkey"
            columns: ["producao_registro_id"]
            isOneToOne: false
            referencedRelation: "producao_registros"
            referencedColumns: ["id"]
          },
        ]
      }
      contagem_porcionados: {
        Row: {
          a_produzir: number | null
          created_at: string
          dia_operacional: string
          final_sobra: number
          id: string
          ideal_amanha: number
          item_porcionado_id: string
          loja_id: string
          organization_id: string | null
          peso_total_g: number | null
          updated_at: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          a_produzir?: number | null
          created_at?: string
          dia_operacional: string
          final_sobra?: number
          id?: string
          ideal_amanha?: number
          item_porcionado_id: string
          loja_id: string
          organization_id?: string | null
          peso_total_g?: number | null
          updated_at?: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          a_produzir?: number | null
          created_at?: string
          dia_operacional?: string
          final_sobra?: number
          id?: string
          ideal_amanha?: number
          item_porcionado_id?: string
          loja_id?: string
          organization_id?: string | null
          peso_total_g?: number | null
          updated_at?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "contagem_porcionados_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagem_porcionados_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contagem_porcionados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_pendentes: {
        Row: {
          accepted_at: string | null
          convidado_por_id: string
          convidado_por_nome: string
          created_at: string
          email: string
          expires_at: string
          id: string
          lojas_ids: string[] | null
          organization_id: string
          permissions: string[] | null
          roles: string[]
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          convidado_por_id: string
          convidado_por_nome: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          lojas_ids?: string[] | null
          organization_id: string
          permissions?: string[] | null
          roles?: string[]
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          convidado_por_id?: string
          convidado_por_nome?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          lojas_ids?: string[] | null
          organization_id?: string
          permissions?: string[] | null
          roles?: string[]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_pendentes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erros_devolucoes: {
        Row: {
          created_at: string
          descricao: string
          foto_url: string | null
          id: string
          loja_id: string
          loja_nome: string
          organization_id: string | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          descricao: string
          foto_url?: string | null
          id?: string
          loja_id: string
          loja_nome: string
          organization_id?: string | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string
          descricao?: string
          foto_url?: string | null
          id?: string
          loja_id?: string
          loja_nome?: string
          organization_id?: string | null
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "erros_devolucoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erros_devolucoes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_cpd: {
        Row: {
          data_ultima_movimentacao: string | null
          id: string
          item_porcionado_id: string
          organization_id: string | null
          quantidade: number | null
        }
        Insert: {
          data_ultima_movimentacao?: string | null
          id?: string
          item_porcionado_id: string
          organization_id?: string | null
          quantidade?: number | null
        }
        Update: {
          data_ultima_movimentacao?: string | null
          id?: string
          item_porcionado_id?: string
          organization_id?: string | null
          quantidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_cpd_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: true
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_cpd_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_cpd_produtos: {
        Row: {
          created_at: string | null
          data_ultima_movimentacao: string | null
          id: string
          organization_id: string | null
          produto_id: string
          quantidade: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_ultima_movimentacao?: string | null
          id?: string
          organization_id?: string | null
          produto_id: string
          quantidade?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_ultima_movimentacao?: string | null
          id?: string
          organization_id?: string | null
          produto_id?: string
          quantidade?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_cpd_produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_cpd_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_loja_itens: {
        Row: {
          data_ultima_movimentacao: string | null
          estoque_minimo: number | null
          id: string
          item_porcionado_id: string
          loja_id: string
          organization_id: string | null
          quantidade: number | null
        }
        Insert: {
          data_ultima_movimentacao?: string | null
          estoque_minimo?: number | null
          id?: string
          item_porcionado_id: string
          loja_id: string
          organization_id?: string | null
          quantidade?: number | null
        }
        Update: {
          data_ultima_movimentacao?: string | null
          estoque_minimo?: number | null
          id?: string
          item_porcionado_id?: string
          loja_id?: string
          organization_id?: string | null
          quantidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_loja_itens_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_loja_itens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_loja_itens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_loja_produtos: {
        Row: {
          created_at: string | null
          data_confirmacao_recebimento: string | null
          data_ultima_atualizacao: string | null
          data_ultima_contagem: string | null
          data_ultimo_envio: string | null
          id: string
          loja_id: string
          organization_id: string | null
          produto_id: string
          quantidade: number
          quantidade_ultimo_envio: number | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          created_at?: string | null
          data_confirmacao_recebimento?: string | null
          data_ultima_atualizacao?: string | null
          data_ultima_contagem?: string | null
          data_ultimo_envio?: string | null
          id?: string
          loja_id: string
          organization_id?: string | null
          produto_id: string
          quantidade?: number
          quantidade_ultimo_envio?: number | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          created_at?: string | null
          data_confirmacao_recebimento?: string | null
          data_ultima_atualizacao?: string | null
          data_ultima_contagem?: string | null
          data_ultimo_envio?: string | null
          id?: string
          loja_id?: string
          organization_id?: string | null
          produto_id?: string
          quantidade?: number
          quantidade_ultimo_envio?: number | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_loja_produtos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_loja_produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_loja_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      estoques_ideais_semanais: {
        Row: {
          created_at: string
          domingo: number
          id: string
          item_porcionado_id: string
          loja_id: string
          organization_id: string | null
          quarta: number
          quinta: number
          sabado: number
          segunda: number
          sexta: number
          terca: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domingo?: number
          id?: string
          item_porcionado_id: string
          loja_id: string
          organization_id?: string | null
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domingo?: number
          id?: string
          item_porcionado_id?: string
          loja_id?: string
          organization_id?: string | null
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoques_ideais_semanais_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoques_ideais_semanais_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoques_ideais_semanais_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          classificacao: string | null
          created_at: string | null
          data_ultima_movimentacao: string | null
          dias_cobertura_desejado: number | null
          estoque_minimo: number | null
          id: string
          lead_time_real_dias: number | null
          nome: string
          organization_id: string | null
          perda_percentual: number | null
          quantidade_em_estoque: number | null
          unidade_medida: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string | null
        }
        Insert: {
          classificacao?: string | null
          created_at?: string | null
          data_ultima_movimentacao?: string | null
          dias_cobertura_desejado?: number | null
          estoque_minimo?: number | null
          id?: string
          lead_time_real_dias?: number | null
          nome: string
          organization_id?: string | null
          perda_percentual?: number | null
          quantidade_em_estoque?: number | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
        }
        Update: {
          classificacao?: string | null
          created_at?: string | null
          data_ultima_movimentacao?: string | null
          dias_cobertura_desejado?: number | null
          estoque_minimo?: number | null
          id?: string
          lead_time_real_dias?: number | null
          nome?: string
          organization_id?: string | null
          perda_percentual?: number | null
          quantidade_em_estoque?: number | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insumos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos_estoque_minimo_semanal: {
        Row: {
          created_at: string
          domingo: number
          id: string
          insumo_id: string
          organization_id: string | null
          quarta: number
          quinta: number
          sabado: number
          segunda: number
          sexta: number
          terca: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domingo?: number
          id?: string
          insumo_id: string
          organization_id?: string | null
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domingo?: number
          id?: string
          insumo_id?: string
          organization_id?: string | null
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_estoque_minimo_semanal_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_estoque_minimo_semanal_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos_extras: {
        Row: {
          consumo_por_traco_g: number | null
          escala_configuracao: string | null
          id: string
          insumo_id: string
          is_principal: boolean
          item_porcionado_id: string
          nome: string
          organization_id: string | null
          quantidade: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
        }
        Insert: {
          consumo_por_traco_g?: number | null
          escala_configuracao?: string | null
          id?: string
          insumo_id: string
          is_principal?: boolean
          item_porcionado_id: string
          nome: string
          organization_id?: string | null
          quantidade: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
        }
        Update: {
          consumo_por_traco_g?: number | null
          escala_configuracao?: string | null
          id?: string
          insumo_id?: string
          is_principal?: boolean
          item_porcionado_id?: string
          nome?: string
          organization_id?: string | null
          quantidade?: number
          unidade?: Database["public"]["Enums"]["unidade_medida"]
        }
        Relationships: [
          {
            foreignKeyName: "insumos_extras_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_extras_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_extras_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos_log: {
        Row: {
          data: string | null
          estoque_anterior: number | null
          estoque_resultante: number | null
          id: string
          insumo_id: string
          insumo_nome: string
          organization_id: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          unidade_origem: string | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          data?: string | null
          estoque_anterior?: number | null
          estoque_resultante?: number | null
          id?: string
          insumo_id: string
          insumo_nome: string
          organization_id?: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          unidade_origem?: string | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          data?: string | null
          estoque_anterior?: number | null
          estoque_resultante?: number | null
          id?: string
          insumo_id?: string
          insumo_nome?: string
          organization_id?: string | null
          quantidade?: number
          tipo?: Database["public"]["Enums"]["tipo_movimento"]
          unidade_origem?: string | null
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "insumos_log_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_porcionados: {
        Row: {
          ativo: boolean
          baixar_producao_inicio: boolean | null
          consumo_por_traco_g: number | null
          created_at: string | null
          equivalencia_traco: number | null
          farinha_por_lote_kg: number | null
          fator_consumo_embalagem_por_porcao: number | null
          id: string
          insumo_embalagem_id: string | null
          insumo_vinculado_id: string | null
          margem_lote_percentual: number | null
          massa_gerada_por_lote_kg: number | null
          nome: string
          organization_id: string | null
          perda_cozimento_percentual: number | null
          perda_percentual_adicional: number | null
          peso_alvo_bolinha_g: number | null
          peso_maximo_bolinha_g: number | null
          peso_medio_operacional_bolinha_g: number | null
          peso_minimo_bolinha_g: number | null
          peso_pronto_g: number | null
          peso_unitario_g: number
          quantidade_por_lote: number | null
          tempo_timer_minutos: number | null
          timer_ativo: boolean | null
          unidade_embalagem: string | null
          unidade_medida: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string | null
          usa_embalagem_por_porcao: boolean | null
          usa_traco_massa: boolean | null
        }
        Insert: {
          ativo?: boolean
          baixar_producao_inicio?: boolean | null
          consumo_por_traco_g?: number | null
          created_at?: string | null
          equivalencia_traco?: number | null
          farinha_por_lote_kg?: number | null
          fator_consumo_embalagem_por_porcao?: number | null
          id?: string
          insumo_embalagem_id?: string | null
          insumo_vinculado_id?: string | null
          margem_lote_percentual?: number | null
          massa_gerada_por_lote_kg?: number | null
          nome: string
          organization_id?: string | null
          perda_cozimento_percentual?: number | null
          perda_percentual_adicional?: number | null
          peso_alvo_bolinha_g?: number | null
          peso_maximo_bolinha_g?: number | null
          peso_medio_operacional_bolinha_g?: number | null
          peso_minimo_bolinha_g?: number | null
          peso_pronto_g?: number | null
          peso_unitario_g: number
          quantidade_por_lote?: number | null
          tempo_timer_minutos?: number | null
          timer_ativo?: boolean | null
          unidade_embalagem?: string | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
          usa_embalagem_por_porcao?: boolean | null
          usa_traco_massa?: boolean | null
        }
        Update: {
          ativo?: boolean
          baixar_producao_inicio?: boolean | null
          consumo_por_traco_g?: number | null
          created_at?: string | null
          equivalencia_traco?: number | null
          farinha_por_lote_kg?: number | null
          fator_consumo_embalagem_por_porcao?: number | null
          id?: string
          insumo_embalagem_id?: string | null
          insumo_vinculado_id?: string | null
          margem_lote_percentual?: number | null
          massa_gerada_por_lote_kg?: number | null
          nome?: string
          organization_id?: string | null
          perda_cozimento_percentual?: number | null
          perda_percentual_adicional?: number | null
          peso_alvo_bolinha_g?: number | null
          peso_maximo_bolinha_g?: number | null
          peso_medio_operacional_bolinha_g?: number | null
          peso_minimo_bolinha_g?: number | null
          peso_pronto_g?: number | null
          peso_unitario_g?: number
          quantidade_por_lote?: number | null
          tempo_timer_minutos?: number | null
          timer_ativo?: boolean | null
          unidade_embalagem?: string | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
          usa_embalagem_por_porcao?: boolean | null
          usa_traco_massa?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_porcionados_insumo_embalagem_id_fkey"
            columns: ["insumo_embalagem_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_porcionados_insumo_vinculado_id_fkey"
            columns: ["insumo_vinculado_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_porcionados_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_reserva_diaria: {
        Row: {
          created_at: string
          domingo: number
          id: string
          item_porcionado_id: string
          organization_id: string | null
          quarta: number
          quinta: number
          sabado: number
          segunda: number
          sexta: number
          terca: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domingo?: number
          id?: string
          item_porcionado_id: string
          organization_id?: string | null
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domingo?: number
          id?: string
          item_porcionado_id?: string
          organization_id?: string | null
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_reserva_diaria_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_reserva_diaria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_audio: {
        Row: {
          ativo: boolean | null
          audio_url: string
          created_at: string | null
          descricao: string | null
          dias_semana: number[] | null
          horario: string
          id: string
          organization_id: string | null
          perfis_destino: string[] | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          audio_url: string
          created_at?: string | null
          descricao?: string | null
          dias_semana?: number[] | null
          horario: string
          id?: string
          organization_id?: string | null
          perfis_destino?: string[] | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          audio_url?: string
          created_at?: string | null
          descricao?: string | null
          dias_semana?: number[] | null
          horario?: string
          id?: string
          organization_id?: string | null
          perfis_destino?: string[] | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_audio_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          created_at: string | null
          cutoff_operacional: string
          fuso_horario: string
          id: string
          nome: string
          organization_id: string | null
          responsavel: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          cutoff_operacional?: string
          fuso_horario?: string
          id?: string
          nome: string
          organization_id?: string | null
          responsavel: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          cutoff_operacional?: string
          fuso_horario?: string
          id?: string
          nome?: string
          organization_id?: string | null
          responsavel?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lojas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas_acesso: {
        Row: {
          created_at: string | null
          id: string
          loja_id: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          loja_id: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          loja_id?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_acesso_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lojas_acesso_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lojas_acesso_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_cpd_produtos: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          organization_id: string | null
          produto_id: string
          produto_nome: string
          quantidade: number
          quantidade_anterior: number
          quantidade_posterior: number
          tipo: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          organization_id?: string | null
          produto_id: string
          produto_nome: string
          quantidade: number
          quantidade_anterior?: number
          quantidade_posterior?: number
          tipo: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          organization_id?: string | null
          produto_id?: string
          produto_nome?: string
          quantidade?: number
          quantidade_anterior?: number
          quantidade_posterior?: number
          tipo?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_cpd_produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_cpd_produtos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque_log: {
        Row: {
          created_at: string
          data_hora_servidor: string
          documento_url: string | null
          entidade_id: string
          entidade_nome: string
          entidade_tipo: string
          estoque_anterior: number
          estoque_resultante: number
          id: string
          observacao: string | null
          organization_id: string
          quantidade: number
          referencia_id: string | null
          referencia_tipo: string | null
          tipo_movimentacao: string
          unidade_destino: string | null
          unidade_origem: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string
          data_hora_servidor?: string
          documento_url?: string | null
          entidade_id: string
          entidade_nome: string
          entidade_tipo: string
          estoque_anterior: number
          estoque_resultante: number
          id?: string
          observacao?: string | null
          organization_id: string
          quantidade: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo_movimentacao: string
          unidade_destino?: string | null
          unidade_origem: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string
          data_hora_servidor?: string
          documento_url?: string | null
          entidade_id?: string
          entidade_nome?: string
          entidade_tipo?: string
          estoque_anterior?: number
          estoque_resultante?: number
          id?: string
          observacao?: string | null
          organization_id?: string
          quantidade?: number
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo_movimentacao?: string
          unidade_destino?: string | null
          unidade_origem?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          slug: string
          subscription_expires_at: string | null
          subscription_plan: string | null
          subscription_status: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          woovi_customer_id: string | null
          woovi_subscription_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          slug: string
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          woovi_customer_id?: string | null
          woovi_subscription_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          slug?: string
          subscription_expires_at?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          woovi_customer_id?: string | null
          woovi_subscription_id?: string | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      pedidos_compra: {
        Row: {
          created_at: string | null
          data_pedido: string | null
          data_prevista_entrega: string | null
          data_recebimento: string | null
          fornecedor: string
          id: string
          numero_pedido: string
          observacao: string | null
          organization_id: string | null
          recebido_por_id: string | null
          recebido_por_nome: string | null
          status: string
          updated_at: string | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string | null
          data_pedido?: string | null
          data_prevista_entrega?: string | null
          data_recebimento?: string | null
          fornecedor: string
          id?: string
          numero_pedido: string
          observacao?: string | null
          organization_id?: string | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string
          updated_at?: string | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string | null
          data_pedido?: string | null
          data_prevista_entrega?: string | null
          data_recebimento?: string | null
          fornecedor?: string
          id?: string
          numero_pedido?: string
          observacao?: string | null
          organization_id?: string | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string
          updated_at?: string | null
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_compra_itens: {
        Row: {
          created_at: string | null
          divergencia: boolean | null
          id: string
          observacao_divergencia: string | null
          organization_id: string | null
          pedido_id: string
          produto_id: string
          produto_nome: string
          quantidade_recebida: number | null
          quantidade_solicitada: number
          unidade: string | null
        }
        Insert: {
          created_at?: string | null
          divergencia?: boolean | null
          id?: string
          observacao_divergencia?: string | null
          organization_id?: string | null
          pedido_id: string
          produto_id: string
          produto_nome: string
          quantidade_recebida?: number | null
          quantidade_solicitada: number
          unidade?: string | null
        }
        Update: {
          created_at?: string | null
          divergencia?: boolean | null
          id?: string
          observacao_divergencia?: string | null
          organization_id?: string | null
          pedido_id?: string
          produto_id?: string
          produto_nome?: string
          quantidade_recebida?: number | null
          quantidade_solicitada?: number
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_compra_itens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_compra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_compra_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      perdas_producao: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          item_nome: string
          motivo: string
          organization_id: string | null
          peso_perdido_kg: number | null
          producao_registro_id: string
          quantidade_perdida: number
          tipo_perda: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          item_nome: string
          motivo: string
          organization_id?: string | null
          peso_perdido_kg?: number | null
          producao_registro_id: string
          quantidade_perdida: number
          tipo_perda: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          item_nome?: string
          motivo?: string
          organization_id?: string | null
          peso_perdido_kg?: number | null
          producao_registro_id?: string
          quantidade_perdida?: number
          tipo_perda?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_organization"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_producao_registro"
            columns: ["producao_registro_id"]
            isOneToOne: false
            referencedRelation: "producao_registros"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_presets: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_system: boolean
          nome: string
          organization_id: string | null
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome: string
          organization_id?: string | null
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          organization_id?: string | null
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_assinatura: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          destaque: boolean | null
          id: string
          intervalo: string | null
          max_lojas: number | null
          max_usuarios: number | null
          nome: string
          preco_centavos: number
          recursos: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          destaque?: boolean | null
          id?: string
          intervalo?: string | null
          max_lojas?: number | null
          max_usuarios?: number | null
          nome: string
          preco_centavos?: number
          recursos?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          destaque?: boolean | null
          id?: string
          intervalo?: string | null
          max_lojas?: number | null
          max_usuarios?: number | null
          nome?: string
          preco_centavos?: number
          recursos?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      producao_lotes: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          id: string
          item_id: string
          item_nome: string
          organization_id: string | null
          peso_total_programado_kg: number | null
          status: string | null
          unidades_programadas: number | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          item_id: string
          item_nome: string
          organization_id?: string | null
          peso_total_programado_kg?: number | null
          status?: string | null
          unidades_programadas?: number | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          item_id?: string
          item_nome?: string
          organization_id?: string | null
          peso_total_programado_kg?: number | null
          status?: string | null
          unidades_programadas?: number | null
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_lotes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_lotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_lotes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_massa_historico: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          lotes_produzidos: number
          massa_total_utilizada_g: number
          novo_peso_medio_operacional_g: number | null
          organization_id: string
          peso_final_g: number
          peso_medio_operacional_anterior_g: number | null
          peso_medio_real_bolinha_g: number
          producao_registro_id: string | null
          quantidade_esperada: number
          quantidade_real_produzida: number
          sobra_perda_g: number | null
          status_calibracao: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          lotes_produzidos: number
          massa_total_utilizada_g: number
          novo_peso_medio_operacional_g?: number | null
          organization_id: string
          peso_final_g: number
          peso_medio_operacional_anterior_g?: number | null
          peso_medio_real_bolinha_g: number
          producao_registro_id?: string | null
          quantidade_esperada: number
          quantidade_real_produzida: number
          sobra_perda_g?: number | null
          status_calibracao: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          lotes_produzidos?: number
          massa_total_utilizada_g?: number
          novo_peso_medio_operacional_g?: number | null
          organization_id?: string
          peso_final_g?: number
          peso_medio_operacional_anterior_g?: number | null
          peso_medio_real_bolinha_g?: number
          producao_registro_id?: string | null
          quantidade_esperada?: number
          quantidade_real_produzida?: number
          sobra_perda_g?: number | null
          status_calibracao?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_massa_historico_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_massa_historico_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_massa_historico_producao_registro_id_fkey"
            columns: ["producao_registro_id"]
            isOneToOne: false
            referencedRelation: "producao_registros"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_registros: {
        Row: {
          bloqueado_por_traco_anterior: boolean | null
          data_fim: string | null
          data_fim_porcionamento: string | null
          data_fim_preparo: string | null
          data_inicio: string | null
          data_inicio_porcionamento: string | null
          data_inicio_preparo: string | null
          data_referencia: string | null
          demanda_lojas: number | null
          detalhes_lojas: Json | null
          farinha_consumida_kg: number | null
          id: string
          item_id: string
          item_nome: string
          lote_producao_id: string | null
          lotes_masseira: number | null
          massa_total_gerada_kg: number | null
          observacao_porcionamento: string | null
          observacao_preparo: string | null
          organization_id: string | null
          peso_final_kg: number | null
          peso_medio_real_bolinha_g: number | null
          peso_preparo_kg: number | null
          peso_programado_kg: number | null
          producao_lote_id: string | null
          reserva_configurada: number | null
          sequencia_traco: number | null
          sobra_kg: number | null
          sobra_preparo_kg: number | null
          sobra_reserva: number | null
          status: string | null
          status_calibracao: string | null
          timer_status: string | null
          unidades_programadas: number | null
          unidades_reais: number | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          bloqueado_por_traco_anterior?: boolean | null
          data_fim?: string | null
          data_fim_porcionamento?: string | null
          data_fim_preparo?: string | null
          data_inicio?: string | null
          data_inicio_porcionamento?: string | null
          data_inicio_preparo?: string | null
          data_referencia?: string | null
          demanda_lojas?: number | null
          detalhes_lojas?: Json | null
          farinha_consumida_kg?: number | null
          id?: string
          item_id: string
          item_nome: string
          lote_producao_id?: string | null
          lotes_masseira?: number | null
          massa_total_gerada_kg?: number | null
          observacao_porcionamento?: string | null
          observacao_preparo?: string | null
          organization_id?: string | null
          peso_final_kg?: number | null
          peso_medio_real_bolinha_g?: number | null
          peso_preparo_kg?: number | null
          peso_programado_kg?: number | null
          producao_lote_id?: string | null
          reserva_configurada?: number | null
          sequencia_traco?: number | null
          sobra_kg?: number | null
          sobra_preparo_kg?: number | null
          sobra_reserva?: number | null
          status?: string | null
          status_calibracao?: string | null
          timer_status?: string | null
          unidades_programadas?: number | null
          unidades_reais?: number | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          bloqueado_por_traco_anterior?: boolean | null
          data_fim?: string | null
          data_fim_porcionamento?: string | null
          data_fim_preparo?: string | null
          data_inicio?: string | null
          data_inicio_porcionamento?: string | null
          data_inicio_preparo?: string | null
          data_referencia?: string | null
          demanda_lojas?: number | null
          detalhes_lojas?: Json | null
          farinha_consumida_kg?: number | null
          id?: string
          item_id?: string
          item_nome?: string
          lote_producao_id?: string | null
          lotes_masseira?: number | null
          massa_total_gerada_kg?: number | null
          observacao_porcionamento?: string | null
          observacao_preparo?: string | null
          organization_id?: string | null
          peso_final_kg?: number | null
          peso_medio_real_bolinha_g?: number | null
          peso_preparo_kg?: number | null
          peso_programado_kg?: number | null
          producao_lote_id?: string | null
          reserva_configurada?: number | null
          sequencia_traco?: number | null
          sobra_kg?: number | null
          sobra_preparo_kg?: number | null
          sobra_reserva?: number | null
          status?: string | null
          status_calibracao?: string | null
          timer_status?: string | null
          unidades_programadas?: number | null
          unidades_reais?: number | null
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_registros_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_registros_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_registros_producao_lote_id_fkey"
            columns: ["producao_lote_id"]
            isOneToOne: false
            referencedRelation: "producao_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_registros_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["categoria_produto"]
          classificacao: string | null
          codigo: string | null
          created_at: string | null
          dias_cobertura_desejado: number | null
          id: string
          lead_time_real_dias: number | null
          modo_envio: string | null
          nome: string
          organization_id: string | null
          peso_por_unidade_kg: number | null
          tipo_produto: Database["public"]["Enums"]["tipo_produto"]
          unidade_consumo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: Database["public"]["Enums"]["categoria_produto"]
          classificacao?: string | null
          codigo?: string | null
          created_at?: string | null
          dias_cobertura_desejado?: number | null
          id?: string
          lead_time_real_dias?: number | null
          modo_envio?: string | null
          nome: string
          organization_id?: string | null
          peso_por_unidade_kg?: number | null
          tipo_produto?: Database["public"]["Enums"]["tipo_produto"]
          unidade_consumo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["categoria_produto"]
          classificacao?: string | null
          codigo?: string | null
          created_at?: string | null
          dias_cobertura_desejado?: number | null
          id?: string
          lead_time_real_dias?: number | null
          modo_envio?: string | null
          nome?: string
          organization_id?: string | null
          peso_por_unidade_kg?: number | null
          tipo_produto?: Database["public"]["Enums"]["tipo_produto"]
          unidade_consumo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_estoque_minimo_semanal: {
        Row: {
          created_at: string
          domingo: number
          id: string
          loja_id: string
          organization_id: string | null
          produto_id: string
          quarta: number
          quinta: number
          sabado: number
          segunda: number
          sexta: number
          terca: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domingo?: number
          id?: string
          loja_id: string
          organization_id?: string | null
          produto_id: string
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domingo?: number
          id?: string
          loja_id?: string
          organization_id?: string | null
          produto_id?: string
          quarta?: number
          quinta?: number
          sabado?: number
          segunda?: number
          sexta?: number
          terca?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_estoque_minimo_semanal_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_estoque_minimo_semanal_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_estoque_minimo_semanal_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          nome: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      romaneio_itens: {
        Row: {
          created_at: string | null
          id: string
          item_nome: string
          item_porcionado_id: string | null
          organization_id: string | null
          peso_recebido_kg: number | null
          peso_total_kg: number | null
          producao_registro_id: string | null
          quantidade: number
          quantidade_recebida: number | null
          quantidade_volumes: number | null
          romaneio_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_nome: string
          item_porcionado_id?: string | null
          organization_id?: string | null
          peso_recebido_kg?: number | null
          peso_total_kg?: number | null
          producao_registro_id?: string | null
          quantidade: number
          quantidade_recebida?: number | null
          quantidade_volumes?: number | null
          romaneio_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_nome?: string
          item_porcionado_id?: string | null
          organization_id?: string | null
          peso_recebido_kg?: number | null
          peso_total_kg?: number | null
          producao_registro_id?: string | null
          quantidade?: number
          quantidade_recebida?: number | null
          quantidade_volumes?: number | null
          romaneio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "romaneio_itens_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneio_itens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneio_itens_producao_registro_id_fkey"
            columns: ["producao_registro_id"]
            isOneToOne: false
            referencedRelation: "producao_registros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneio_itens_romaneio_id_fkey"
            columns: ["romaneio_id"]
            isOneToOne: false
            referencedRelation: "romaneios"
            referencedColumns: ["id"]
          },
        ]
      }
      romaneios: {
        Row: {
          created_at: string | null
          data_criacao: string | null
          data_envio: string | null
          data_recebimento: string | null
          id: string
          loja_id: string
          loja_nome: string
          observacao: string | null
          organization_id: string | null
          peso_total_envio_g: number | null
          peso_total_recebido_g: number | null
          quantidade_volumes_envio: number | null
          quantidade_volumes_recebido: number | null
          recebido_por_id: string | null
          recebido_por_nome: string | null
          status: string | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string | null
          data_criacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          id?: string
          loja_id: string
          loja_nome: string
          observacao?: string | null
          organization_id?: string | null
          peso_total_envio_g?: number | null
          peso_total_recebido_g?: number | null
          quantidade_volumes_envio?: number | null
          quantidade_volumes_recebido?: number | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string | null
          data_criacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          id?: string
          loja_id?: string
          loja_nome?: string
          observacao?: string | null
          organization_id?: string | null
          peso_total_envio_g?: number | null
          peso_total_recebido_g?: number | null
          quantidade_volumes_envio?: number | null
          quantidade_volumes_recebido?: number | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string | null
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "romaneios_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      romaneios_avulsos: {
        Row: {
          created_at: string | null
          data_criacao: string | null
          data_envio: string | null
          data_recebimento: string | null
          id: string
          loja_destino_id: string
          loja_destino_nome: string
          loja_origem_id: string
          loja_origem_nome: string
          observacao: string | null
          organization_id: string | null
          recebido_por_id: string | null
          recebido_por_nome: string | null
          status: string
          usuario_criacao_id: string
          usuario_criacao_nome: string
        }
        Insert: {
          created_at?: string | null
          data_criacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          id?: string
          loja_destino_id: string
          loja_destino_nome: string
          loja_origem_id: string
          loja_origem_nome: string
          observacao?: string | null
          organization_id?: string | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string
          usuario_criacao_id: string
          usuario_criacao_nome: string
        }
        Update: {
          created_at?: string | null
          data_criacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          id?: string
          loja_destino_id?: string
          loja_destino_nome?: string
          loja_origem_id?: string
          loja_origem_nome?: string
          observacao?: string | null
          organization_id?: string | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string
          usuario_criacao_id?: string
          usuario_criacao_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "romaneios_avulsos_loja_destino_id_fkey"
            columns: ["loja_destino_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_avulsos_loja_origem_id_fkey"
            columns: ["loja_origem_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_avulsos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      romaneios_avulsos_itens: {
        Row: {
          created_at: string | null
          id: string
          item_nome: string
          item_porcionado_id: string | null
          organization_id: string | null
          peso_kg: number | null
          peso_recebido_kg: number | null
          quantidade: number
          quantidade_recebida: number | null
          romaneio_avulso_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_nome: string
          item_porcionado_id?: string | null
          organization_id?: string | null
          peso_kg?: number | null
          peso_recebido_kg?: number | null
          quantidade: number
          quantidade_recebida?: number | null
          romaneio_avulso_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_nome?: string
          item_porcionado_id?: string | null
          organization_id?: string | null
          peso_kg?: number | null
          peso_recebido_kg?: number | null
          quantidade?: number
          quantidade_recebida?: number | null
          romaneio_avulso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "romaneios_avulsos_itens_item_porcionado_id_fkey"
            columns: ["item_porcionado_id"]
            isOneToOne: false
            referencedRelation: "itens_porcionados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_avulsos_itens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_avulsos_itens_romaneio_avulso_id_fkey"
            columns: ["romaneio_avulso_id"]
            isOneToOne: false
            referencedRelation: "romaneios_avulsos"
            referencedColumns: ["id"]
          },
        ]
      }
      romaneios_produtos: {
        Row: {
          created_at: string | null
          data_criacao: string | null
          data_envio: string | null
          data_recebimento: string | null
          id: string
          loja_id: string
          loja_nome: string
          observacao: string | null
          observacao_recebimento: string | null
          organization_id: string | null
          recebido_por_id: string | null
          recebido_por_nome: string | null
          status: string
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          created_at?: string | null
          data_criacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          id?: string
          loja_id: string
          loja_nome: string
          observacao?: string | null
          observacao_recebimento?: string | null
          organization_id?: string | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          created_at?: string | null
          data_criacao?: string | null
          data_envio?: string | null
          data_recebimento?: string | null
          id?: string
          loja_id?: string
          loja_nome?: string
          observacao?: string | null
          observacao_recebimento?: string | null
          organization_id?: string | null
          recebido_por_id?: string | null
          recebido_por_nome?: string | null
          status?: string
          usuario_id?: string
          usuario_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "romaneios_produtos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_produtos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      romaneios_produtos_itens: {
        Row: {
          created_at: string | null
          divergencia: boolean | null
          id: string
          observacao_divergencia: string | null
          organization_id: string | null
          produto_id: string
          produto_nome: string
          quantidade: number
          quantidade_recebida: number | null
          romaneio_id: string
          unidade: string | null
        }
        Insert: {
          created_at?: string | null
          divergencia?: boolean | null
          id?: string
          observacao_divergencia?: string | null
          organization_id?: string | null
          produto_id: string
          produto_nome: string
          quantidade: number
          quantidade_recebida?: number | null
          romaneio_id: string
          unidade?: string | null
        }
        Update: {
          created_at?: string | null
          divergencia?: boolean | null
          id?: string
          observacao_divergencia?: string | null
          organization_id?: string | null
          produto_id?: string
          produto_nome?: string
          quantidade?: number
          quantidade_recebida?: number | null
          romaneio_id?: string
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "romaneios_produtos_itens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_produtos_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "romaneios_produtos_itens_romaneio_id_fkey"
            columns: ["romaneio_id"]
            isOneToOne: false
            referencedRelation: "romaneios_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_reposicao: {
        Row: {
          created_at: string | null
          data_atendimento: string | null
          data_solicitacao: string | null
          id: string
          loja_id: string
          loja_nome: string
          observacao: string | null
          organization_id: string
          produto_id: string
          produto_nome: string
          quantidade_atendida: number | null
          quantidade_solicitada: number
          status: string
          usuario_atendente_id: string | null
          usuario_atendente_nome: string | null
          usuario_solicitante_id: string
          usuario_solicitante_nome: string
        }
        Insert: {
          created_at?: string | null
          data_atendimento?: string | null
          data_solicitacao?: string | null
          id?: string
          loja_id: string
          loja_nome: string
          observacao?: string | null
          organization_id: string
          produto_id: string
          produto_nome: string
          quantidade_atendida?: number | null
          quantidade_solicitada?: number
          status?: string
          usuario_atendente_id?: string | null
          usuario_atendente_nome?: string | null
          usuario_solicitante_id: string
          usuario_solicitante_nome: string
        }
        Update: {
          created_at?: string | null
          data_atendimento?: string | null
          data_solicitacao?: string | null
          id?: string
          loja_id?: string
          loja_nome?: string
          observacao?: string | null
          organization_id?: string
          produto_id?: string
          produto_nome?: string
          quantidade_atendida?: number | null
          quantidade_solicitada?: number
          status?: string
          usuario_atendente_id?: string | null
          usuario_atendente_nome?: string | null
          usuario_solicitante_id?: string
          usuario_solicitante_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_reposicao_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reposicao_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reposicao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_history: {
        Row: {
          amount_cents: number | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          payment_method: string | null
          woovi_charge_id: string | null
          woovi_correlation_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          payment_method?: string | null
          woovi_charge_id?: string | null
          woovi_correlation_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          payment_method?: string | null
          woovi_charge_id?: string | null
          woovi_correlation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_permissions: {
        Row: {
          config: Json
          created_at: string
          id: string
          organization_id: string
          pagina_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          organization_id: string
          pagina_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          organization_id?: string
          pagina_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ui_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_page_access: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          organization_id: string
          page_route: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id: string
          page_route: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          page_route?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_page_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          organization_id: string
          permission_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          organization_id: string
          permission_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          organization_id?: string
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_dia_operacional: {
        Args: { p_loja_id: string; p_timestamp?: string }
        Returns: string
      }
      check_slug_exists: { Args: { slug_to_check: string }; Returns: boolean }
      criar_ou_atualizar_producao_registro:
        | {
            Args: {
              p_item_id: string
              p_organization_id: string
              p_usuario_id: string
              p_usuario_nome: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_dia_operacional?: string
              p_item_id: string
              p_organization_id: string
              p_usuario_id: string
              p_usuario_nome: string
            }
            Returns: Json
          }
      decrementar_estoque_cpd: {
        Args: { p_item_id: string; p_quantidade: number }
        Returns: undefined
      }
      get_cpd_loja_id: { Args: { p_organization_id: string }; Returns: string }
      get_current_date: { Args: never; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      get_user_profile: { Args: { _user_id: string }; Returns: string }
      has_page_access: {
        Args: { _page_route: string; _user_id: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      incrementar_estoque_cpd: {
        Args: { p_item_id: string; p_quantidade: number }
        Returns: undefined
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      registrar_movimentacao_estoque: {
        Args: {
          p_entidade_id: string
          p_entidade_nome: string
          p_entidade_tipo: string
          p_observacao?: string
          p_organization_id?: string
          p_quantidade: number
          p_referencia_id?: string
          p_referencia_tipo?: string
          p_tipo_movimentacao: string
          p_unidade_destino?: string
          p_unidade_origem: string
          p_usuario_id: string
          p_usuario_nome: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "Admin" | "Produção" | "Loja" | "SuperAdmin"
      categoria_produto:
        | "congelado"
        | "refrigerado"
        | "ambiente"
        | "diversos"
        | "material_escritorio"
        | "material_limpeza"
        | "embalagens"
        | "descartaveis"
        | "equipamentos"
      tipo_movimento: "entrada" | "saida"
      tipo_produto:
        | "lacrado"
        | "porcionado"
        | "lote"
        | "simples"
        | "lote_kg"
        | "lote_qtde"
      unidade_medida:
        | "kg"
        | "unidade"
        | "g"
        | "ml"
        | "l"
        | "traco"
        | "lote"
        | "lote_com_perda"
        | "lote_sem_perda"
        | "saco"
        | "caixa"
        | "fardo"
        | "lote_masseira"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["Admin", "Produção", "Loja", "SuperAdmin"],
      categoria_produto: [
        "congelado",
        "refrigerado",
        "ambiente",
        "diversos",
        "material_escritorio",
        "material_limpeza",
        "embalagens",
        "descartaveis",
        "equipamentos",
      ],
      tipo_movimento: ["entrada", "saida"],
      tipo_produto: [
        "lacrado",
        "porcionado",
        "lote",
        "simples",
        "lote_kg",
        "lote_qtde",
      ],
      unidade_medida: [
        "kg",
        "unidade",
        "g",
        "ml",
        "l",
        "traco",
        "lote",
        "lote_com_perda",
        "lote_sem_perda",
        "saco",
        "caixa",
        "fardo",
        "lote_masseira",
      ],
    },
  },
} as const
