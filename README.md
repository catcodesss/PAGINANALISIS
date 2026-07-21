# AFA — Análisis Funcional Asistido

Herramienta profesional para psicólogos clínicos de orientación conductual-contextual (análisis de conducta aplicado y ACT). El terapeuta pega notas clínicas desordenadas y la aplicación devuelve un análisis funcional estructurado —siempre presentado como hipótesis a verificar, nunca como conclusiones cerradas.

Prototipo para validación con clínicos reales. Next.js 14+ (App Router) + TypeScript + Tailwind CSS, sin base de datos, sin autenticación, sin librerías de componentes. Única dependencia adicional: `@anthropic-ai/sdk`.

## Privacidad por diseño

Las notas clínicas **no se guardan en ninguna parte**: no hay base de datos, `localStorage`, `sessionStorage`, cookies con contenido, ni registro (log) del texto de la nota en el servidor. Cada análisis se procesa en memoria durante la petición y se descarta al responder.

## Requisitos

- Node.js 18.18 o superior
- Una clave de API de Anthropic

## Obtener la clave de API

1. Crea una cuenta o inicia sesión en [console.anthropic.com](https://console.anthropic.com).
2. Ve a la sección **API Keys** y genera una nueva clave.
3. Cópiala; solo se muestra completa una vez.

## Configuración

1. Instala las dependencias:

   ```powershell
   npm install
   ```

2. Copia `.env.example` a `.env.local`:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Abre `.env.local` y pega tu clave:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

   Esta clave solo se usa del lado del servidor (en `app/api/analizar/route.ts`) y nunca se expone al navegador.

## Ejecutar en desarrollo

```powershell
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Si `ANTHROPIC_API_KEY` no está configurada, la interfaz lo indicará claramente al intentar generar un análisis.

## Producción

```powershell
npm run build
npm start
```

## Estructura

```
app/page.tsx                     Única página: formulario, estados y renderizado del informe
app/api/analizar/route.ts        Única API route: llamada a Claude, parseo robusto del JSON
components/ReportView.tsx        Presentación del informe clínico
components/EsqueletoInforme.tsx  Estado de carga
lib/types.ts                     Interfaz TypeScript AnalisisFuncional
lib/systemPrompt.ts              System prompt clínico (verbatim)
lib/parseAnalisis.ts             Extracción y normalización robusta del JSON de respuesta
lib/pii.ts                       Detección y enmascarado de datos identificables (cliente)
lib/formatearInforme.ts          Formateo de texto plano para "Copiar informe"
```
