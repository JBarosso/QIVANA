import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import path from 'path';

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
  // ⚠️ IMPORTANT: Mettre à jour cette URL après le premier déploiement Vercel
  // Vercel définit automatiquement VERCEL_URL en production
  // Pour le développement local, utiliser localhost
  site: import.meta.env.VERCEL 
    ? `https://${import.meta.env.VERCEL_URL || 'votre-projet.vercel.app'}` 
    : 'http://localhost:4321',
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
