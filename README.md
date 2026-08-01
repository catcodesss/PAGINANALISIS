# ANCIA — Análisis de conducta asistido por IA

Herramienta profesional para psicólogos clínicos de orientación conductual. El terapeuta pega notas clínicas desordenadas, elige un modelo terapéutico (ACT, DBT o Conductual/MC) y la aplicación devuelve un análisis funcional estructurado por situaciones —siempre presentado como hipótesis a verificar, nunca como conclusiones cerradas.

Next.js (App Router) + TypeScript + Tailwind CSS, sin base de datos, sin autenticación, sin librerías de componentes. Única dependencia adicional: `openai`.

## Privacidad por diseño

Las notas clínicas **no se guardan en ninguna parte**: no hay base de datos, `localStorage`, `sessionStorage`, cookies con contenido, ni registro (log) del texto de la nota en el servidor. Cada análisis se procesa en memoria durante la petición y se descarta al responder.

## Requisitos

- Node.js 18.18 o superior
- Una clave de API de OpenAI

## Obtener la clave de API

1. Crea una cuenta o inicia sesión en [platform.openai.com](https://platform.openai.com).
2. Ve a **API keys** y genera una nueva clave.
3. Cópiala; solo se muestra completa una vez.
4. Asegúrate de tener crédito/método de pago activo en **Settings → Billing** — sin esto la API responde 429 (cuota excedida).

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
   OPENAI_API_KEY=sk-proj-...
   ```

   Esta clave solo se usa del lado del servidor (en `app/api/analizar/route.ts`) y nunca se expone al navegador.

## Ejecutar en desarrollo

```powershell
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Si `OPENAI_API_KEY` no está configurada, la interfaz lo indicará claramente al intentar generar un análisis.

## Producción (Vercel)

El proyecto está pensado para desplegarse en Vercel conectado al repositorio de GitHub. La variable de entorno `OPENAI_API_KEY` debe configurarse en **Settings → Environment Variables** del proyecto en Vercel (no en un archivo local) — y **hay que redesplegar** después de crearla o cambiarla para que tome efecto.

Para producción manual:

```powershell
npm run build
npm start
```

## Modelo terapéutico (ACT / DBT / MC)

El análisis funcional de base (situaciones, cadenas antecedente-respuesta-consecuencia, variables moduladoras, formulación del caso) es el mismo en las tres modalidades. Lo que cambia es la capa de intervención (`capa_modalidad` en la respuesta):

- **ACT**: reglas verbales (pliance/tracking/augmenting) y procesos de inflexibilidad del hexaflex.
- **DBT**: análisis en cadena (vulnerabilidades, precipitante, eslabones) y habilidades sugeridas por módulo.
- **Conductual (MC)**: procedimientos directos de manejo de contingencias, sin vocabulario de terapias de tercera ola.

## Estructura

```
app/page.tsx                     Única página: formulario, selector de modalidad, estados y renderizado del informe
app/api/analizar/route.ts        Única API route: llamada a OpenAI, parseo robusto del JSON
components/ReportView.tsx        Presentación del informe clínico (cadenas visuales, índice, hero)
components/EsqueletoInforme.tsx  Estado de carga
lib/types.ts                     Interfaz TypeScript AnalisisFuncional (esquema v2, por situaciones)
lib/systemPrompt.ts              System prompt clínico: núcleo común + bloque por modalidad (verbatim)
lib/parseAnalisis.ts             Extracción y normalización robusta del JSON de respuesta
lib/pii.ts                       Detección y enmascarado de datos identificables (cliente)
lib/formatearInforme.ts          Formateo de texto plano para "Copiar informe"
```

## Pendiente para el propietario (no es trabajo de código)

Antes de procesar notas de pacientes reales con esta herramienta:

- **Firmar el DPA con OpenAI.** El RGPD exige tener el acuerdo de encargado del
  tratamiento antes de enviar datos personales a un tercero.
  https://openai.com/policies/data-processing-addendum/
- **Solicitar Zero Data Retention.** Por defecto OpenAI puede retener entradas y
  salidas de la API hasta 30 días para detección de abusos. ZDR no viene activado:
  requiere solicitud y aprobación previa.
- **Valorar residencia de datos en Europa** si los usuarios son europeos.
- **Revisar que el texto de privacidad de la interfaz** siga coincidiendo con la
  configuración real de la cuenta (app/page.tsx).

El límite de peticiones de `lib/limitePeticiones.ts` guarda el contador en memoria
del proceso. En Vercel cada invocación puede caer en una instancia distinta, así
que frena el uso accidental pero no un abuso decidido. Para un límite fiable hace
falta un almacén compartido (Vercel KV o Upstash).

## Pruebas

Ninguna consume API:

```bash
node --experimental-strip-types evals/citas.test.mjs   # citas verificables
node --experimental-strip-types evals/pii.test.mjs     # enmascarado
node evals/validadores.test.mjs                        # validadores deterministas
```

Las evals completas (seis llamadas a OpenAI) están documentadas en `evals/README.md`.
