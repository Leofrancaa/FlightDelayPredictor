import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // URLs antigas, de quando o site tinha Brasil e EUA
  async redirects() {
    return [
      { source: "/eua", destination: "/", permanent: true },
      { source: "/eua/:pagina*", destination: "/:pagina*", permanent: true },
      { source: "/comparacao", destination: "/analista", permanent: true },
      // animação da apresentação (página estática em public/totem)
      { source: "/totem", destination: "/totem/index.html", permanent: false },
    ];
  },
};

export default nextConfig;
