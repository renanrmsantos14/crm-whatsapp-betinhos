import type { MetadataRoute } from "next";

import { marcaDaSaidaPublica } from "@/lib/branding/saida";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const marca = marcaDaSaidaPublica();
  return {
    name: marca.nome,
    short_name: marca.nome,
    display: "standalone",
    start_url: "/app",
    scope: "/",
    icons: [{ src: "/icon", sizes: "64x64", type: "image/png" }],
  };
}
