
-- ENUMS
CREATE TYPE public.modalidade_entrega AS ENUM ('retirada','entrega','ambos');
CREATE TYPE public.status_anuncio AS ENUM ('ativo','pausado','vendido');

-- TABLE
CREATE TABLE public.anuncios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria public.categoria_agro NOT NULL,
  produto TEXT NOT NULL,
  qualidade TEXT,
  data_colheita DATE,
  preco NUMERIC NOT NULL CHECK (preco >= 0),
  moeda public.moeda_app NOT NULL DEFAULT 'BRL',
  preco_unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  quantidade_disponivel NUMERIC NOT NULL CHECK (quantidade_disponivel >= 0),
  quantidade_unidade_id UUID NOT NULL REFERENCES public.unidades(id),
  aceita_permuta BOOLEAN NOT NULL DEFAULT FALSE,
  permuta_descricao TEXT,
  modalidade_entrega public.modalidade_entrega NOT NULL DEFAULT 'retirada',
  raio_entrega_km INT,
  certificacoes TEXT[] NOT NULL DEFAULT '{}',
  estado TEXT,
  cidade TEXT,
  cep TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  fotos TEXT[] NOT NULL DEFAULT '{}',
  status public.status_anuncio NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anuncios TO authenticated;
GRANT ALL ON public.anuncios TO service_role;

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anuncios_select_authenticated"
ON public.anuncios FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (status = 'ativo' OR vendedor_id = auth.uid() OR public.is_admin(auth.uid()))
);

CREATE POLICY "anuncios_insert_owner"
ON public.anuncios FOR INSERT TO authenticated
WITH CHECK (vendedor_id = auth.uid());

CREATE POLICY "anuncios_update_owner_or_admin"
ON public.anuncios FOR UPDATE TO authenticated
USING (vendedor_id = auth.uid() OR public.is_admin(auth.uid()))
WITH CHECK (vendedor_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "anuncios_delete_owner_or_admin"
ON public.anuncios FOR DELETE TO authenticated
USING (vendedor_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER anuncios_set_updated_at
BEFORE UPDATE ON public.anuncios
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_anuncios_status_created ON public.anuncios(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_anuncios_vendedor ON public.anuncios(vendedor_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_anuncios_categoria ON public.anuncios(categoria) WHERE deleted_at IS NULL;
CREATE INDEX idx_anuncios_estado ON public.anuncios(estado) WHERE deleted_at IS NULL;

-- STORAGE POLICIES for the 'anuncios' bucket (bucket itself is created via tool)
CREATE POLICY "anuncios_storage_read_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'anuncios');

CREATE POLICY "anuncios_storage_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'anuncios'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "anuncios_storage_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'anuncios'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "anuncios_storage_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'anuncios'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
