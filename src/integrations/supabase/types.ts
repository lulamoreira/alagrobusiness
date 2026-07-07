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
      agenda_eventos: {
        Row: {
          anuncio_id: string | null
          concluido: boolean
          created_at: string
          data: string
          deleted_at: string | null
          descricao: string | null
          hora: string | null
          id: string
          tipo: Database["public"]["Enums"]["tipo_evento"]
          titulo: string
          updated_at: string
          usuario_id: string
          venda_id: string | null
        }
        Insert: {
          anuncio_id?: string | null
          concluido?: boolean
          created_at?: string
          data: string
          deleted_at?: string | null
          descricao?: string | null
          hora?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_evento"]
          titulo: string
          updated_at?: string
          usuario_id: string
          venda_id?: string | null
        }
        Update: {
          anuncio_id?: string | null
          concluido?: boolean
          created_at?: string
          data?: string
          deleted_at?: string | null
          descricao?: string | null
          hora?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_evento"]
          titulo?: string
          updated_at?: string
          usuario_id?: string
          venda_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_eventos_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_preco: {
        Row: {
          ativo: boolean
          condicao: string
          created_at: string
          deleted_at: string | null
          disparado: boolean
          id: string
          moeda: Database["public"]["Enums"]["moeda_app"]
          referencia: string
          tipo_alerta: string
          ultima_notificacao_em: string | null
          updated_at: string
          usuario_id: string
          valor_alvo: number
        }
        Insert: {
          ativo?: boolean
          condicao: string
          created_at?: string
          deleted_at?: string | null
          disparado?: boolean
          id?: string
          moeda?: Database["public"]["Enums"]["moeda_app"]
          referencia: string
          tipo_alerta: string
          ultima_notificacao_em?: string | null
          updated_at?: string
          usuario_id: string
          valor_alvo: number
        }
        Update: {
          ativo?: boolean
          condicao?: string
          created_at?: string
          deleted_at?: string | null
          disparado?: boolean
          id?: string
          moeda?: Database["public"]["Enums"]["moeda_app"]
          referencia?: string
          tipo_alerta?: string
          ultima_notificacao_em?: string | null
          updated_at?: string
          usuario_id?: string
          valor_alvo?: number
        }
        Relationships: []
      }
      anuncios: {
        Row: {
          aceita_permuta: boolean
          categoria: Database["public"]["Enums"]["categoria_agro"]
          cep: string | null
          certificacoes: string[]
          cidade: string | null
          created_at: string
          data_colheita: string | null
          deleted_at: string | null
          descricao: string | null
          estado: string | null
          fotos: string[]
          id: string
          latitude: number | null
          longitude: number | null
          modalidade_entrega: Database["public"]["Enums"]["modalidade_entrega"]
          moeda: Database["public"]["Enums"]["moeda_app"]
          permuta_descricao: string | null
          preco: number
          preco_unidade_id: string
          produto: string
          qualidade: string | null
          quantidade_disponivel: number
          quantidade_unidade_id: string
          raio_entrega_km: number | null
          status: Database["public"]["Enums"]["status_anuncio"]
          titulo: string
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          aceita_permuta?: boolean
          categoria: Database["public"]["Enums"]["categoria_agro"]
          cep?: string | null
          certificacoes?: string[]
          cidade?: string | null
          created_at?: string
          data_colheita?: string | null
          deleted_at?: string | null
          descricao?: string | null
          estado?: string | null
          fotos?: string[]
          id?: string
          latitude?: number | null
          longitude?: number | null
          modalidade_entrega?: Database["public"]["Enums"]["modalidade_entrega"]
          moeda?: Database["public"]["Enums"]["moeda_app"]
          permuta_descricao?: string | null
          preco: number
          preco_unidade_id: string
          produto: string
          qualidade?: string | null
          quantidade_disponivel: number
          quantidade_unidade_id: string
          raio_entrega_km?: number | null
          status?: Database["public"]["Enums"]["status_anuncio"]
          titulo: string
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          aceita_permuta?: boolean
          categoria?: Database["public"]["Enums"]["categoria_agro"]
          cep?: string | null
          certificacoes?: string[]
          cidade?: string | null
          created_at?: string
          data_colheita?: string | null
          deleted_at?: string | null
          descricao?: string | null
          estado?: string | null
          fotos?: string[]
          id?: string
          latitude?: number | null
          longitude?: number | null
          modalidade_entrega?: Database["public"]["Enums"]["modalidade_entrega"]
          moeda?: Database["public"]["Enums"]["moeda_app"]
          permuta_descricao?: string | null
          preco?: number
          preco_unidade_id?: string
          produto?: string
          qualidade?: string | null
          quantidade_disponivel?: number
          quantidade_unidade_id?: string
          raio_entrega_km?: number | null
          status?: Database["public"]["Enums"]["status_anuncio"]
          titulo?: string
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anuncios_preco_unidade_id_fkey"
            columns: ["preco_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncios_quantidade_unidade_id_fkey"
            columns: ["quantidade_unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anuncios_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          created_at: string
          deleted_at: string | null
          fim: string | null
          id: string
          inicio: string
          origem: Database["public"]["Enums"]["origem_assinatura"]
          periodo: string | null
          plano_id: string
          status: Database["public"]["Enums"]["assinatura_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ate: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          origem?: Database["public"]["Enums"]["origem_assinatura"]
          periodo?: string | null
          plano_id: string
          status?: Database["public"]["Enums"]["assinatura_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ate?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          fim?: string | null
          id?: string
          inicio?: string
          origem?: Database["public"]["Enums"]["origem_assinatura"]
          periodo?: string | null
          plano_id?: string
          status?: Database["public"]["Enums"]["assinatura_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ate?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas: {
        Row: {
          created_at: string
          deleted_at: string | null
          descricao: string | null
          duracao_seg: number | null
          gratis: boolean
          id: string
          modulo_id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          duracao_seg?: number | null
          gratis?: boolean
          id?: string
          modulo_id: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          duracao_seg?: number | null
          gratis?: boolean
          id?: string
          modulo_id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      aulas_video: {
        Row: {
          aula_id: string
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
          video_provider: string
          video_url: string
        }
        Insert: {
          aula_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          video_provider: string
          video_url: string
        }
        Update: {
          aula_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          video_provider?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "aulas_video_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: true
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados: {
        Row: {
          codigo: string
          created_at: string
          curso_id: string
          deleted_at: string | null
          emitido_em: string
          id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          codigo: string
          created_at?: string
          curso_id: string
          deleted_at?: string | null
          emitido_em?: string
          id?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          codigo?: string
          created_at?: string
          curso_id?: string
          deleted_at?: string | null
          emitido_em?: string
          id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      commodities_catalogo: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          deleted_at: string | null
          id: string
          nome: Json
          ordem: number
          unidade_padrao_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: Json
          ordem?: number
          unidade_padrao_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          nome?: Json
          ordem?: number
          unidade_padrao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commodities_catalogo_unidade_padrao_id_fkey"
            columns: ["unidade_padrao_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos: {
        Row: {
          assunto: string
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          ip: string | null
          lida: boolean
          mensagem: string
          nome: string
          origem: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          assunto: string
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          ip?: string | null
          lida?: boolean
          mensagem: string
          nome: string
          origem?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          assunto?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          ip?: string | null
          lida?: boolean
          mensagem?: string
          nome?: string
          origem?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      conversas: {
        Row: {
          anuncio_id: string
          comprador_id: string
          created_at: string
          deleted_at: string | null
          id: string
          last_message_at: string
          status_negociacao: Database["public"]["Enums"]["negociacao_status"]
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          anuncio_id: string
          comprador_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          status_negociacao?: Database["public"]["Enums"]["negociacao_status"]
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          anuncio_id?: string
          comprador_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_message_at?: string
          status_negociacao?: Database["public"]["Enums"]["negociacao_status"]
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_cortesia: {
        Row: {
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          dias: number | null
          email: string
          expira_em: string
          id: string
          plano_codigo: string
          status: Database["public"]["Enums"]["convite_status"]
          token: string
          updated_at: string
          usado_em: string | null
          usado_por: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          dias?: number | null
          email: string
          expira_em?: string
          id?: string
          plano_codigo?: string
          status?: Database["public"]["Enums"]["convite_status"]
          token?: string
          updated_at?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          deleted_at?: string | null
          dias?: number | null
          email?: string
          expira_em?: string
          id?: string
          plano_codigo?: string
          status?: Database["public"]["Enums"]["convite_status"]
          token?: string
          updated_at?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Relationships: []
      }
      cotacoes_commodities: {
        Row: {
          atualizado_em: string
          created_at: string
          data: string
          deleted_at: string | null
          fonte: string
          fonte_url: string | null
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
          data?: string
          deleted_at?: string | null
          fonte?: string
          fonte_url?: string | null
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
          data?: string
          deleted_at?: string | null
          fonte?: string
          fonte_url?: string | null
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
      cotacoes_dolar_historico: {
        Row: {
          created_at: string
          data: string
          deleted_at: string | null
          id: string
          tipo: Database["public"]["Enums"]["tipo_dolar"]
          updated_at: string
          valor_brl: number
        }
        Insert: {
          created_at?: string
          data?: string
          deleted_at?: string | null
          id?: string
          tipo: Database["public"]["Enums"]["tipo_dolar"]
          updated_at?: string
          valor_brl: number
        }
        Update: {
          created_at?: string
          data?: string
          deleted_at?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_dolar"]
          updated_at?: string
          valor_brl?: number
        }
        Relationships: []
      }
      cursos: {
        Row: {
          capa_url: string | null
          categoria: string | null
          created_at: string
          deleted_at: string | null
          descricao: string | null
          id: string
          ordem: number
          publicado: boolean
          titulo: string
          updated_at: string
        }
        Insert: {
          capa_url?: string | null
          categoria?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          publicado?: boolean
          titulo: string
          updated_at?: string
        }
        Update: {
          capa_url?: string | null
          categoria?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          publicado?: boolean
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          deleted_at: string | null
          id: string
          lida: boolean
          remetente_id: string
          updated_at: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lida?: boolean
          remetente_id: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          lida?: boolean
          remetente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          created_at: string
          curso_id: string
          deleted_at: string | null
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curso_id: string
          deleted_at?: string | null
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curso_id?: string
          deleted_at?: string | null
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
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
      planos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          deleted_at: string | null
          descricao: Json
          id: string
          limites: Json
          moeda: Database["public"]["Enums"]["moeda_app"]
          nome: Json
          ordem: number
          preco_anual: number
          preco_mensal: number
          stripe_price_id_anual: string | null
          stripe_price_id_mensal: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          deleted_at?: string | null
          descricao?: Json
          id?: string
          limites?: Json
          moeda?: Database["public"]["Enums"]["moeda_app"]
          nome?: Json
          ordem?: number
          preco_anual?: number
          preco_mensal?: number
          stripe_price_id_anual?: string | null
          stripe_price_id_mensal?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: Json
          id?: string
          limites?: Json
          moeda?: Database["public"]["Enums"]["moeda_app"]
          nome?: Json
          ordem?: number
          preco_anual?: number
          preco_mensal?: number
          stripe_price_id_anual?: string | null
          stripe_price_id_mensal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      preferencias: {
        Row: {
          cotacoes_selecionadas: string[]
          created_at: string
          deleted_at: string | null
          id: string
          idioma: Database["public"]["Enums"]["idioma_app"]
          moeda: Database["public"]["Enums"]["moeda_app"]
          tema: Database["public"]["Enums"]["tema_app"]
          temas_noticias: string[]
          tipo_dolar: Database["public"]["Enums"]["tipo_dolar"]
          tipos_dolar_visiveis: string[]
          updated_at: string
          usuario_id: string
        }
        Insert: {
          cotacoes_selecionadas?: string[]
          created_at?: string
          deleted_at?: string | null
          id?: string
          idioma?: Database["public"]["Enums"]["idioma_app"]
          moeda?: Database["public"]["Enums"]["moeda_app"]
          tema?: Database["public"]["Enums"]["tema_app"]
          temas_noticias?: string[]
          tipo_dolar?: Database["public"]["Enums"]["tipo_dolar"]
          tipos_dolar_visiveis?: string[]
          updated_at?: string
          usuario_id: string
        }
        Update: {
          cotacoes_selecionadas?: string[]
          created_at?: string
          deleted_at?: string | null
          id?: string
          idioma?: Database["public"]["Enums"]["idioma_app"]
          moeda?: Database["public"]["Enums"]["moeda_app"]
          tema?: Database["public"]["Enums"]["tema_app"]
          temas_noticias?: string[]
          tipo_dolar?: Database["public"]["Enums"]["tipo_dolar"]
          tipos_dolar_visiveis?: string[]
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
          admin_permissoes: Json
          avatar_url: string | null
          categorias_interesse: Database["public"]["Enums"]["categoria_agro"][]
          cep: string | null
          cidade: string | null
          created_at: string
          deleted_at: string | null
          email: string
          estado: string | null
          id: string
          idioma_preferido: Database["public"]["Enums"]["idioma_app"]
          is_super_admin: boolean
          latitude: number | null
          longitude: number | null
          moeda_preferida: Database["public"]["Enums"]["moeda_app"]
          nome_completo: string
          pais: string
          perfil_completo: boolean
          status: Database["public"]["Enums"]["status_perfil"]
          telefone: string | null
          termos_aceitos_em: string | null
          termos_versao: string | null
          tipo_dolar_preferido: Database["public"]["Enums"]["tipo_dolar"]
          tipo_perfil: Database["public"]["Enums"]["tipo_perfil"]
          updated_at: string
        }
        Insert: {
          admin_permissoes?: Json
          avatar_url?: string | null
          categorias_interesse?: Database["public"]["Enums"]["categoria_agro"][]
          cep?: string | null
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          estado?: string | null
          id: string
          idioma_preferido?: Database["public"]["Enums"]["idioma_app"]
          is_super_admin?: boolean
          latitude?: number | null
          longitude?: number | null
          moeda_preferida?: Database["public"]["Enums"]["moeda_app"]
          nome_completo?: string
          pais?: string
          perfil_completo?: boolean
          status?: Database["public"]["Enums"]["status_perfil"]
          telefone?: string | null
          termos_aceitos_em?: string | null
          termos_versao?: string | null
          tipo_dolar_preferido?: Database["public"]["Enums"]["tipo_dolar"]
          tipo_perfil?: Database["public"]["Enums"]["tipo_perfil"]
          updated_at?: string
        }
        Update: {
          admin_permissoes?: Json
          avatar_url?: string | null
          categorias_interesse?: Database["public"]["Enums"]["categoria_agro"][]
          cep?: string | null
          cidade?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          estado?: string | null
          id?: string
          idioma_preferido?: Database["public"]["Enums"]["idioma_app"]
          is_super_admin?: boolean
          latitude?: number | null
          longitude?: number | null
          moeda_preferida?: Database["public"]["Enums"]["moeda_app"]
          nome_completo?: string
          pais?: string
          perfil_completo?: boolean
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
      progresso_aulas: {
        Row: {
          assistido_em: string | null
          aula_id: string
          concluida: boolean
          created_at: string
          deleted_at: string | null
          id: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          assistido_em?: string | null
          aula_id: string
          concluida?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          assistido_em?: string | null
          aula_id?: string
          concluida?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progresso_aulas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events_processados: {
        Row: {
          event_id: string
          payload: Json | null
          processado_em: string
          tipo: string
        }
        Insert: {
          event_id: string
          payload?: Json | null
          processado_em?: string
          tipo: string
        }
        Update: {
          event_id?: string
          payload?: Json | null
          processado_em?: string
          tipo?: string
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
      vendas: {
        Row: {
          anuncio_id: string
          comprador_nome: string | null
          created_at: string
          data_recebimento: string | null
          data_venda: string
          deleted_at: string | null
          id: string
          moeda: Database["public"]["Enums"]["moeda_app"]
          quantidade: number
          status_pagamento: Database["public"]["Enums"]["pagamento_status"]
          unidade_id: string
          updated_at: string
          valor_total: number
          vendedor_id: string
        }
        Insert: {
          anuncio_id: string
          comprador_nome?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_venda?: string
          deleted_at?: string | null
          id?: string
          moeda?: Database["public"]["Enums"]["moeda_app"]
          quantidade: number
          status_pagamento?: Database["public"]["Enums"]["pagamento_status"]
          unidade_id: string
          updated_at?: string
          valor_total: number
          vendedor_id: string
        }
        Update: {
          anuncio_id?: string
          comprador_nome?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_venda?: string
          deleted_at?: string | null
          id?: string
          moeda?: Database["public"]["Enums"]["moeda_app"]
          quantidade?: number
          status_pagamento?: Database["public"]["Enums"]["pagamento_status"]
          unidade_id?: string
          updated_at?: string
          valor_total?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendas_anuncio_id_fkey"
            columns: ["anuncio_id"]
            isOneToOne: false
            referencedRelation: "anuncios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _aplicar_cortesia: {
        Args: { p_dias: number; p_plano_codigo: string; p_usuario: string }
        Returns: undefined
      }
      admin_acessos_set_status: {
        Args: {
          p_status: Database["public"]["Enums"]["status_perfil"]
          p_usuario: string
        }
        Returns: undefined
      }
      admin_cancelar_convite: { Args: { p_id: string }; Returns: undefined }
      admin_criar_convite: {
        Args: { p_dias?: number; p_email: string; p_plano?: string }
        Returns: {
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          dias: number | null
          email: string
          expira_em: string
          id: string
          plano_codigo: string
          status: Database["public"]["Enums"]["convite_status"]
          token: string
          updated_at: string
          usado_em: string | null
          usado_por: string | null
        }
        SetofOptions: {
          from: "*"
          to: "convites_cortesia"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_user: { Args: { p_usuario: string }; Returns: undefined }
      admin_grant_admin: {
        Args: { p_permissoes: Json; p_usuario: string }
        Returns: undefined
      }
      admin_grant_plan: {
        Args: { p_dias?: number; p_plano_codigo?: string; p_usuario: string }
        Returns: undefined
      }
      admin_kpis: { Args: never; Returns: Json }
      admin_list_admins: {
        Args: never
        Returns: {
          admin_permissoes: Json
          email: string
          id: string
          is_super_admin: boolean
          nome_completo: string
        }[]
      }
      admin_list_cortesias: {
        Args: never
        Returns: {
          email: string
          fim: string
          inicio: string
          nome_completo: string
          plano_codigo: string
          usuario_id: string
        }[]
      }
      admin_listar_convites: {
        Args: never
        Returns: {
          created_at: string
          criado_por: string | null
          deleted_at: string | null
          dias: number | null
          email: string
          expira_em: string
          id: string
          plano_codigo: string
          status: Database["public"]["Enums"]["convite_status"]
          token: string
          updated_at: string
          usado_em: string | null
          usado_por: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "convites_cortesia"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_moderar_anuncio: {
        Args: { p_acao: string; p_anuncio_id: string; p_motivo: string }
        Returns: undefined
      }
      admin_revoke_admin: { Args: { p_usuario: string }; Returns: undefined }
      admin_revoke_plan: { Args: { p_usuario: string }; Returns: undefined }
      admin_search_users: {
        Args: { p_query: string }
        Returns: {
          email: string
          fim: string
          id: string
          nome_completo: string
          origem: string
          plano_codigo: string
          status: string
          tipo_perfil: string
        }[]
      }
      admin_set_user_status: {
        Args: {
          p_status: Database["public"]["Enums"]["status_perfil"]
          p_usuario: string
        }
        Returns: undefined
      }
      admin_update_admin_perms: {
        Args: { p_permissoes: Json; p_usuario: string }
        Returns: undefined
      }
      admin_update_user: {
        Args: {
          p_email: string
          p_nome: string
          p_telefone: string
          p_usuario: string
        }
        Returns: undefined
      }
      complete_profile: {
        Args: {
          p_categorias: string[]
          p_cep: string
          p_cidade: string
          p_estado: string
          p_idioma: string
          p_lgpd: boolean
          p_moeda: string
          p_nome_completo: string
          p_telefone: string
          p_temas: string[]
          p_termos_versao: string
          p_tipo_dolar: string
          p_tipo_perfil: string
        }
        Returns: Database["public"]["Enums"]["status_perfil"]
      }
      current_plan: { Args: never; Returns: Json }
      current_plan_limites: { Args: { uid: string }; Returns: Json }
      emitir_certificado_se_completo: {
        Args: { p_curso_id: string }
        Returns: Json
      }
      get_cron_secret: { Args: never; Returns: string }
      get_stripe_webhook_secret: { Args: never; Returns: string }
      gravar_cotacoes_ia: {
        Args: { p_items: Json }
        Returns: {
          out_motivo: string
          out_produto: string
          out_status: string
        }[]
      }
      has_admin_perm: {
        Args: { _perm: string; _uid: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      marcar_mensagens_lidas: {
        Args: { p_conversa_id: string }
        Returns: undefined
      }
      set_status_negociacao: {
        Args: {
          p_conversa_id: string
          p_status: Database["public"]["Enums"]["negociacao_status"]
        }
        Returns: undefined
      }
      set_stripe_webhook_secret: {
        Args: { p_secret: string }
        Returns: undefined
      }
    }
    Enums: {
      assinatura_status: "trial" | "ativa" | "cancelada" | "expirada"
      categoria_agro: "fruta" | "grao" | "legumes" | "vegetal"
      convite_status: "pendente" | "usado" | "cancelado" | "expirado"
      idioma_app: "pt-BR" | "en" | "es"
      modalidade_entrega: "retirada" | "entrega" | "ambos"
      moeda_app: "BRL" | "USD" | "EUR"
      negociacao_status: "iniciado" | "em_negociacao" | "fechado" | "descartado"
      origem_assinatura: "trial" | "stripe" | "admin_cortesia"
      pagamento_status: "aguardando" | "recebido"
      status_anuncio: "ativo" | "pausado" | "vendido"
      status_perfil: "ativo" | "aguardando_aprovacao" | "bloqueado"
      tema_app: "ecologico" | "terroso" | "chuva"
      tipo_dolar: "comercial" | "turismo" | "paralelo"
      tipo_evento:
        | "plantio"
        | "colheita"
        | "entrega"
        | "pagamento"
        | "reuniao"
        | "outro"
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
      assinatura_status: ["trial", "ativa", "cancelada", "expirada"],
      categoria_agro: ["fruta", "grao", "legumes", "vegetal"],
      convite_status: ["pendente", "usado", "cancelado", "expirado"],
      idioma_app: ["pt-BR", "en", "es"],
      modalidade_entrega: ["retirada", "entrega", "ambos"],
      moeda_app: ["BRL", "USD", "EUR"],
      negociacao_status: ["iniciado", "em_negociacao", "fechado", "descartado"],
      origem_assinatura: ["trial", "stripe", "admin_cortesia"],
      pagamento_status: ["aguardando", "recebido"],
      status_anuncio: ["ativo", "pausado", "vendido"],
      status_perfil: ["ativo", "aguardando_aprovacao", "bloqueado"],
      tema_app: ["ecologico", "terroso", "chuva"],
      tipo_dolar: ["comercial", "turismo", "paralelo"],
      tipo_evento: [
        "plantio",
        "colheita",
        "entrega",
        "pagamento",
        "reuniao",
        "outro",
      ],
      tipo_perfil: ["comprador", "vendedor", "lojista", "marca", "admin"],
    },
  },
} as const
