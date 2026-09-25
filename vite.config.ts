import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // O maior pacote é o da página "Meu Lugar" (three.js, ~600 kB, carregado só nela).
    // O app principal fica bem abaixo disso; o aviso continua valendo para qualquer outro pacote.
    chunkSizeWarningLimit: 650,
  },
});
