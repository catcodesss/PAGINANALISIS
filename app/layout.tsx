import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ACIA — análisis conductual asistido por IA",
  description:
    "Análisis funcional y formulación de casos para la práctica clínica asistida por IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Corre antes de pintar. Si el tema se aplicara desde React, la página
          saldría en claro y saltaría a oscuro al hidratar: un fogonazo blanco
          en la cara de quien eligió modo noche. Va en línea y sin dependencias
          por eso mismo — cualquier import llegaría tarde.

          Duplica la lógica de lib/preferencias.ts#aplicarPreferencias, que es
          el precio de que no pueda importarla; si cambian los atributos, hay
          que tocar los dos sitios.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var p=JSON.parse(localStorage.getItem("acia-preferencias")||"{}")||{};
var t=p.tema==="oscuro"||(p.tema!=="claro"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;
r.dataset.tema=t?"oscuro":"claro";
r.dataset.acento=p.acento||"verde";
r.dataset.texto=p.tamanoTexto||"normal";
r.style.colorScheme=t?"dark":"light";
}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
