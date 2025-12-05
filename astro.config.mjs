import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'http://localhost:4321',
  output: 'server',
  adapter: vercel(),
  integrations: [
    react({
      // Only load React for components that need it
      include: ['**/react/*'],
    }),
  ],
});
