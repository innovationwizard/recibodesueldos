-- Directorio de empleados (datos de referencia, separados de la planilla)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un empleado por nombre+empresa por usuario
CREATE UNIQUE INDEX idx_employees_unique
  ON public.employees(user_id, company_name, full_name)
  WHERE is_active = true;

CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_company ON public.employees(user_id, company_name);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario puede ver sus empleados"
  ON public.employees FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuario puede insertar empleados"
  ON public.employees FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario puede actualizar sus empleados"
  ON public.employees FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario puede eliminar sus empleados"
  ON public.employees FOR DELETE
  USING (auth.uid() = user_id);
