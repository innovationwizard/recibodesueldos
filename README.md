# Recibos de Sueldos

Generador de boletas de pago (constancias de pago) desde planillas Excel. Aplicación single tenant, single user, en español. Formato Guatemala (IGSS, ISR, Bonificación Decreto 78-89).

## Características

- **Single tenant, single user**: Una empresa, un usuario
- **Autenticación**: Supabase Auth (invite + contraseña). Los usuarios invitados reciben correo y al hacer clic van a establecer contraseña, no a login.
- **Carga de Excel**: Sube archivos .xlsx o .xls
- **Búsqueda inteligente**: Encuentra la hoja correcta con coincidencia difusa
- **Generación de boletas**: Constancias de pago listas para imprimir o guardar como PDF
- **Historial**: Los lotes y archivos Excel se guardan en Supabase (base de datos + storage)

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Vercel](https://vercel.com) (para despliegue)

## Instalación local

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/tu-usuario/recibos-de-sueldos.git
   cd recibos-de-sueldos
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar Supabase**
   - Crea un proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
   - En SQL Editor, ejecuta en orden:
     1. `supabase/migrations/20240218000001_initial_schema.sql`
     2. `supabase/migrations/20240218000002_storage.sql`
   - Si el bucket no existe, créalo manualmente en Storage → New bucket: `planillas` (privado, 10 MB)
   - En Authentication → URL Configuration, agrega:
     - Site URL: `http://localhost:3000` (desarrollo) o tu URL de producción
     - Redirect URLs: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/confirm`, `http://localhost:3000/set-password`, `http://localhost:3000/login` (y las equivalentes HTTPS en producción)

4. **Variables de entorno**
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con tus credenciales de Supabase:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```

5. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000)

## Invitar usuario

En Supabase Dashboard → Authentication → Users → Invite user. El usuario recibe un correo; al hacer clic en el enlace va a `/set-password` para crear su contraseña (no al login).

## Restablecer contraseña

El usuario puede solicitar restablecer contraseña desde la pantalla de login (si implementas el enlace). Supabase envía un correo; al hacer clic va a `/set-password` para crear la nueva contraseña.

## Despliegue en Vercel

1. **Subir a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/tu-usuario/recibos-de-sueldos.git
   git push -u origin main
   ```

2. **Conectar con Vercel**
   - Ve a [vercel.com](https://vercel.com) e inicia sesión
   - Importa el repositorio desde GitHub
   - Agrega las variables de entorno:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Despliega

3. **Configurar Supabase**
   - En Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://tu-app.vercel.app`
   - Redirect URLs: `https://tu-app.vercel.app/auth/callback`

## Formato de planilla Excel

La aplicación espera planillas con la siguiente estructura:

- **B2**: Nombre de la empresa
- **B4**: Rango de fechas del período (ej: "AL 15 DE FEBRERO 2025")
- **Encabezados**: No., NOMBRE, PUESTO, ORDINARIO MENSUAL, Bonificación Decreto, IGSS, ISR, Anticipo, Otros

La búsqueda de columnas es flexible y acepta variaciones en los nombres de encabezados.

## Tecnologías

- [Next.js 14](https://nextjs.org/) (App Router)
- [Supabase](https://supabase.com/) (Auth, Database, Storage)
- [Tailwind CSS](https://tailwindcss.com/)
- [SheetJS (xlsx)](https://sheetjs.com/) para parsing de Excel

## Licencia

MIT
