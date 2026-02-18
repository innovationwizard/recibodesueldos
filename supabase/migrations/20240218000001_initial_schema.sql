-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de lotes de boletas (single tenant, single user)
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  period_range TEXT NOT NULL,
  period_date TEXT,
  file_name TEXT,
  file_path TEXT,
  receipt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de boletas individuales
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  employee_name TEXT NOT NULL,
  position TEXT,
  salary NUMERIC(12,2) DEFAULT 0,
  bonus NUMERIC(12,2) DEFAULT 0,
  igss NUMERIC(12,2) DEFAULT 0,
  isr NUMERIC(12,2) DEFAULT 0,
  advance NUMERIC(12,2) DEFAULT 0,
  other NUMERIC(12,2) DEFAULT 0,
  total_income NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas
CREATE INDEX idx_batches_user_id ON public.batches(user_id);
CREATE INDEX idx_batches_created_at ON public.batches(created_at DESC);
CREATE INDEX idx_receipts_batch_id ON public.receipts(batch_id);

-- RLS (Row Level Security)
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Políticas: single user ve sus datos
CREATE POLICY "Usuario puede ver sus lotes"
  ON public.batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuario puede insertar lotes"
  ON public.batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario puede ver boletas"
  ON public.receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = receipts.batch_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuario puede insertar boletas"
  ON public.receipts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = receipts.batch_id AND b.user_id = auth.uid()
    )
  );

