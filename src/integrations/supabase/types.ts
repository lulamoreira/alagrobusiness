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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clima: {
        Row: {
          atualizado_em: string
          condicao: string | null
          created_at: string
          deleted_at: string | null
          id: string
          previsao: Json | null
          regiao: string
          temperatura: number | null
          updated_at: string
        }
        Insert: {
          atualizado_em?: string
          condicao?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          previsao?: Json | null
          regiao: string
          temperatura?: number | null
          updated_at?: string
        }
        Update: {
          atualizado_em?: string
          condicao?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          previsao?: Json | null
          regiao?: string
          temperatura?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cotacoes_commodities: {
        Row: {
          atualizado_em: string
          created_at: string
          deleted_at: string | null
          id: string
          moeda: Database["public"]["Enums"]["moeda_app"]
          produto: string
          unidade_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          moeda?: Database["public"]["Enums"]["moeda_app"]
          produto: string
          unidade_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          moeda?: Database["public"]["Enums"]["moeda_app"]
          produto?: string
          unidade_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_commodities_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes_dolar: {
        Row: {
          atualizado_em: string
          created_at: string
          deleted_at: string | null
          id: string
          tipo: Database["public"]["Enums"]["tipo_dolar"]
          updated_at: string
          valor_brl: number
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          tipo: Database["public"]["Enums"]["tipo_dolar"]
          updated_at?: string
          valor_brl: number
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_dolar"]
          updated_at?: string
          valor_brl?: number
        }
        Relationships: []
      }
      noticias: {
        Row: {
          created_at: string
          deleted_at: string | null
          fonte: string | null
          id: string
          imagem: string | null
          link: string
          publicado_em: string | null
          resumo: string | null
          tema: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          fonte?: string | null
          id?: string
          imagem?: string | null
          link: string
          publicado_em?: string | null
          resumo?: string | null
          tema?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fonte?: string | null
          id?: string
          imagem?: string | null
          link?: string
          publicado_em?: string | null
          resumo?: string | null
          tema?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencias: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          idioma: Database["public"]["Enums"]["idioma_app"]
          moeda: Database["public"]["Enums"]["moeda_app"]
          temas_noticias: string[]
          tipo_dolar: Database["public"]["Enums"]["tipo_dolar"]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          idioma?: Database["public"]["Enums"]["idioma_app"]
          moeda?: Database["public"]["Enums"]["moeda_app"]
          temas_noticias?: string[]
          tipo_dolar?: Database["public"]["Enums"]["tipo_dolar"]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          idioma?: Database["public"]["Enums"]["idioma_app"]
          moeda?: Database["public"]["Enums"]["moeda_app"]
          temas_noticias?: string[]
          tipo_dolar?: Database["public"]["Enums"]["tipo_dolar"]
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          categorias_interesse: Database["public"]["Enums"]["categoria_agro"][]
          cep: string | null
          cidade: string | null
          created_at: string
          deleted_at: string | null
          email: string
          estado: string | null
          id: string
          idioma_preferido: Database["public"]["Enums"]["idioma_app"]
          latitude: number | null
          longitude: number | null
          moeda_preferida: Database["public"]["Enums"]["moeda_app"]
          nome_completo: string
          pais: string
          status: Database["public"]["Enums"]["status_perfil"]
          telefone: string | null
          termos_aceitos_em: string | null
          termos_versao: string | null
          tipo_dolar_preferido: Database["public"]["Enums"]["tipo_dolar"]
          tipo_perfil: Database["public"]["Enums"]["tipo_perfil"]
          updated_at: string
        }
        Insert: {
          categorias_interesse?: Database["public"]["Enums"]["categoria_agro"][]
          cep?: string | null
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          estado?: string | null
          id: string
          idioma_preferido?: Database["public"]["Enums"]["idioma_app"]
          latitude?: number | null
          longitude?: number | null
          moeda_preferida?: Database["public"]["Enums"]["moeda_app"]
          nome_completo?: string
          pais?: string
          status?: Database["public"]["Enums"]["status_perfil"]
          telefone?: string | null
          termos_aceitos_em?: string | null
          termos_versao?: string | null
          tipo_dolar_preferido?: Database["public"]["Enums"]["tipo_dolar"]
          tipo_perfil?: Database["public"]["Enums"]["tipo_perfil"]
          updated_at?: string
        }
        Update: {
          categorias_interesse?: Database["public"]["Enums"]["categoria_agro"][]
          cep?: string | null
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          estado?: string | null
          id?: string
          idioma_preferido?: Database["public"]["Enums"]["idioma_app"]
          latitude?: number | null
          longitude?: number | null
          moeda_preferida?: Database["public"]["Enums"]["moeda_app"]
          nome_completo?: string
          pais?: string
          status?: Database["public"]["Enums"]["status_perfil"]
          telefone?: string | null
          termos_aceitos_em?: string | null
          termos_versao?: string | null
          tipo_dolar_preferido?: Database["public"]["Enums"]["tipo_dolar"]
          tipo_perfil?: Database["public"]["Enums"]["tipo_perfil"]
          updated_at?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          codigo: string
          created_at: string
          deleted_at: string | null
          fator_kg: number
          id: string
          nome_chave: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          deleted_at?: string | null
          fator_kg: number
          id?: string
          nome_chave: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          deleted_at?: string | null
          fator_kg?: number
          id?: string
          nome_chave?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      categoria_agro: "fruta" | "grao" | "legumes" | "vegetal"
      idioma_app: "pt-BR" | "en" | "es"
      moeda_app: "BRL" | "USD" | "EUR"
      status_perfil: "ativo" | "aguardando_aprovacao" | "bloqueado"
      tipo_dolar: "comercial" | "turismo" | "paralelo"
      tipo_perfil: "comprador" | "vendedor" | "lojista" | "marca" | "admin"
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
      categoria_agro: ["fruta", "grao", "legumes", "vegetal"],
      idioma_app: ["pt-BR", "en", "es"],
      moeda_app: ["BRL", "USD", "EUR"],
      status_perfil: ["ativo", "aguardando_aprovacao", "bloqueado"],
      tipo_dolar: ["comercial", "turismo", "paralelo"],
      tipo_perfil: ["comprador", "vendedor", "lojista", "marca", "admin"],
    },
  },
} as const
