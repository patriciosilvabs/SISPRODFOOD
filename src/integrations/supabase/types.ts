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
      erros_devolucoes: {
        Row: {
          created_at: string
          descricao: string
          foto_url: string | null
          id: string
          loja_id: string
          loja_nome: string
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
        ]
      }
      estoque_cpd: {
        Row: {
          data_ultima_movimentacao: string | null
          id: string
          produto_id: string
          quantidade: number | null
        }
        Insert: {
          data_ultima_movimentacao?: string | null
          id?: string
          produto_id: string
          quantidade?: number | null
        }
        Update: {
          data_ultima_movimentacao?: string | null
          id?: string
          produto_id?: string
          quantidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_cpd_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
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
          quantidade: number | null
        }
        Insert: {
          data_ultima_movimentacao?: string | null
          estoque_minimo?: number | null
          id?: string
          item_porcionado_id: string
          loja_id: string
          quantidade?: number | null
        }
        Update: {
          data_ultima_movimentacao?: string | null
          estoque_minimo?: number | null
          id?: string
          item_porcionado_id?: string
          loja_id?: string
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
        ]
      }
      insumos: {
        Row: {
          created_at: string | null
          data_ultima_movimentacao: string | null
          dias_cobertura_desejado: number | null
          estoque_minimo: number | null
          id: string
          lead_time_real_dias: number | null
          nome: string
          perda_percentual: number | null
          quantidade_em_estoque: number | null
          unidade_medida: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_ultima_movimentacao?: string | null
          dias_cobertura_desejado?: number | null
          estoque_minimo?: number | null
          id?: string
          lead_time_real_dias?: number | null
          nome: string
          perda_percentual?: number | null
          quantidade_em_estoque?: number | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_ultima_movimentacao?: string | null
          dias_cobertura_desejado?: number | null
          estoque_minimo?: number | null
          id?: string
          lead_time_real_dias?: number | null
          nome?: string
          perda_percentual?: number | null
          quantidade_em_estoque?: number | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
        }
        Relationships: []
      }
      insumos_extras: {
        Row: {
          id: string
          insumo_id: string
          item_porcionado_id: string
          nome: string
          quantidade: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
        }
        Insert: {
          id?: string
          insumo_id: string
          item_porcionado_id: string
          nome: string
          quantidade: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
        }
        Update: {
          id?: string
          insumo_id?: string
          item_porcionado_id?: string
          nome?: string
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
        ]
      }
      insumos_log: {
        Row: {
          data: string | null
          id: string
          insumo_id: string
          insumo_nome: string
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          data?: string | null
          id?: string
          insumo_id: string
          insumo_nome: string
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_movimento"]
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          data?: string | null
          id?: string
          insumo_id?: string
          insumo_nome?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["tipo_movimento"]
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
          baixar_producao_inicio: boolean | null
          created_at: string | null
          equivalencia_traco: number | null
          id: string
          insumo_vinculado_id: string | null
          nome: string
          perda_percentual_adicional: number | null
          peso_unitario_g: number
          unidade_medida: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string | null
        }
        Insert: {
          baixar_producao_inicio?: boolean | null
          created_at?: string | null
          equivalencia_traco?: number | null
          id?: string
          insumo_vinculado_id?: string | null
          nome: string
          perda_percentual_adicional?: number | null
          peso_unitario_g: number
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
        }
        Update: {
          baixar_producao_inicio?: boolean | null
          created_at?: string | null
          equivalencia_traco?: number | null
          id?: string
          insumo_vinculado_id?: string | null
          nome?: string
          perda_percentual_adicional?: number | null
          peso_unitario_g?: number
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itens_porcionados_insumo_vinculado_id_fkey"
            columns: ["insumo_vinculado_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          responsavel: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          responsavel: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          responsavel?: string
        }
        Relationships: []
      }
      lojas_acesso: {
        Row: {
          created_at: string | null
          id: string
          loja_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          loja_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          loja_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_acesso_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_lotes: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          id: string
          item_id: string
          item_nome: string
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
            foreignKeyName: "producao_lotes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_registros: {
        Row: {
          data_fim: string | null
          data_inicio: string | null
          id: string
          item_id: string
          item_nome: string
          peso_final_kg: number | null
          peso_programado_kg: number | null
          producao_lote_id: string | null
          sobra_kg: number | null
          status: string | null
          unidades_programadas: number | null
          unidades_reais: number | null
          usuario_id: string
          usuario_nome: string
        }
        Insert: {
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          item_id: string
          item_nome: string
          peso_final_kg?: number | null
          peso_programado_kg?: number | null
          producao_lote_id?: string | null
          sobra_kg?: number | null
          status?: string | null
          unidades_programadas?: number | null
          unidades_reais?: number | null
          usuario_id: string
          usuario_nome: string
        }
        Update: {
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          item_id?: string
          item_nome?: string
          peso_final_kg?: number | null
          peso_programado_kg?: number | null
          producao_lote_id?: string | null
          sobra_kg?: number | null
          status?: string | null
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
          categoria: Database["public"]["Enums"]["categoria_produto"]
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["categoria_produto"]
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["categoria_produto"]
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "Admin" | "Produção" | "Loja"
      categoria_produto: "congelado" | "refrigerado" | "ambiente" | "diversos"
      tipo_movimento: "entrada" | "saida"
      unidade_medida: "kg" | "unidade" | "g" | "ml" | "l" | "traco"
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
      app_role: ["Admin", "Produção", "Loja"],
      categoria_produto: ["congelado", "refrigerado", "ambiente", "diversos"],
      tipo_movimento: ["entrada", "saida"],
      unidade_medida: ["kg", "unidade", "g", "ml", "l", "traco"],
    },
  },
} as const
