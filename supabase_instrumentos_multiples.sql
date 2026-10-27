-- Alabanza IPUC Líbano Central
-- Permite registrar varios instrumentos/funciones por integrante.
-- Ejecutar una sola vez en Supabase > SQL Editor.

ALTER TABLE public.integrantes
ADD COLUMN IF NOT EXISTS instrumentos text[];

-- Conserva compatibilidad: cada integrante existente hereda su instrumento actual.
UPDATE public.integrantes
SET instrumentos = ARRAY[instrumento]::text[]
WHERE (instrumentos IS NULL OR cardinality(instrumentos) = 0)
  AND instrumento IS NOT NULL;
