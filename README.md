# Canasta de Tareas · Wild Lama

Tablero interno para el equipo de Customer Experience. Reemplaza el manejo manual de tareas
diarias/semanales/por fecha en Notion. Las tareas diarias y semanales se resetean solas
cada día a medianoche (hora de Chile).

**Autor:** Josefa Franzott — equipo SAC / Customer Experience
**Tier:** 1 — Interna simple (sin conexión a sistemas externos ni datos sensibles)

## Qué hace

- Tablero con 3 columnas: Pendiente / En curso / Completada
- Cualquier persona puede tomar una tarea "Pendiente" asignándose desde una lista de nombres
- Actualización en tiempo real: todos ven los cambios de los demás al instante
- Tres tipos de tarea:
  - **Diaria**: se resetea sola todos los días
  - **Semanal**: se resetea sola el día (o días) de la semana que le corresponda
  - **Fecha específica**: tarea única, no se resetea
- Sección "Equipo y tareas" para agregar/quitar personas y gestionar tareas, todo dentro de la app

## Stack

- Frontend: React + Vite, desplegado en Vercel
- Base de datos: Supabase (Postgres + tiempo real)
- Reseteo automático: GitHub Actions, corre cada hora y solo actúa a medianoche en Chile

## Configuración inicial

### 1. Crear el proyecto en Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** → **New query**, pega todo el contenido de `supabase/schema.sql` y ejecuta (**Run**)
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**
   - **service_role key** (¡mantenla secreta, nunca en el frontend!)

### 2. Configurar Vercel (para que la app funcione)

1. Importa este repositorio en [vercel.com](https://vercel.com)
2. En **Settings → Environment Variables**, agrega:
   - `VITE_SUPABASE_URL` → el Project URL de Supabase
   - `VITE_SUPABASE_ANON_KEY` → la anon public key
3. Despliega

### 3. Configurar el reseteo automático (GitHub Actions)

1. En este repositorio de GitHub, ve a **Settings → Secrets and variables → Actions**
2. Agrega dos **New repository secret**:
   - `SUPABASE_URL` → el Project URL de Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` → la service_role key (la secreta, no la anon)
3. Listo — el workflow en `.github/workflows/reset-tareas.yml` corre solo cada hora,
   y resetea las tareas correspondientes cuando es medianoche en Chile.

Para probarlo sin esperar: en GitHub, pestaña **Actions** → **Reset diario de tareas** →
**Run workflow** (esto lo ejecuta al tiro, aunque no sea medianoche, solo para revisar que
no tire errores; el reseteo real de datos solo ocurre a las 00:00 hora de Chile).

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # y completa las variables VITE_*
npm run dev
```
