-- Tabla de logs de correos enviados
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  from_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  resend_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_logs_batch_id ON public.email_logs(batch_id);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario puede ver sus logs de correo"
  ON public.email_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = email_logs.batch_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Usuario puede insertar logs de correo"
  ON public.email_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = email_logs.batch_id AND b.user_id = auth.uid()
    )
  );
