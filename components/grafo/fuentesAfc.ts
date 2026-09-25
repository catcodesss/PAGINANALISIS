import { Inter, Poppins } from "next/font/google";

// Solo la vista AFC usa estas familias: se cargan aquí, con variable propia,
// para no tocar la tipografía del resto de ACIA.
export const poppinsAfc = Poppins({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--afc-fuente-titulo",
  display: "swap",
});

export const interAfc = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--afc-fuente-texto",
  display: "swap",
});
