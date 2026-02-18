-- Bucket para archivos Excel subidos (crear en Dashboard si falla: Storage → New bucket "planillas", privado)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'planillas',
  'planillas',
  false,
  10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Usuarios pueden subir planillas" ON storage.objects;
CREATE POLICY "Usuarios pueden subir planillas"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'planillas' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Usuarios pueden leer sus planillas" ON storage.objects;
CREATE POLICY "Usuarios pueden leer sus planillas"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'planillas' AND (storage.foldername(name))[1] = auth.uid()::text);
