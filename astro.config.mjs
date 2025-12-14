import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://astro.build/config
export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@styles': path.resolve(__dirname, './src/styles'),
      },
    },
  },
  // Site URL pour le sitemap et les URLs canoniques
  // En production, définir PUBLIC_SITE_URL dans les variables d'environnement
  site: process.env.PUBLIC_SITE_URL || 'https://qivana.app',
  output: 'server',
  adapter: vercel({
    // Configuration pour les fonctions serverless
    functionPerRoute: false, // Une seule fonction pour toutes les routes (plus rapide)
    isr: false, // Pas de ISR pour l'instant (peut être activé plus tard)
    // Timeout pour les appels IA (30 secondes)
    maxDuration: 30,
  }),
  integrations: [
    react({
      // Only load React for components that need it
      include: ['**/react/*'],
    }),
    sitemap({
      // Exclure les pages admin, API et privées du sitemap
      filter: (page) => 
        !page.includes('/admin/') &&
        !page.includes('/api/') &&
        !page.includes('/auth/callback') &&
        !page.includes('/payment/'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
});
