import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
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
  // ⚠️ IMPORTANT: La propriété 'site' est optionnelle avec Vercel adapter
  // Vercel gère automatiquement les URLs. On la définit seulement pour le dev local.
  // En production, Vercel utilisera automatiquement la bonne URL.
  // Note: On peut omettre 'site' complètement, mais on la garde pour le dev local
  site: 'http://localhost:4321',
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
  ],
});
