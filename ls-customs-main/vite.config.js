import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The project uses .js files (not .jsx) for React components, per project
// requirements. esbuild needs to be told to parse JSX syntax out of .js
// files, both for dev (optimizeDeps) and for the main transform pipeline.
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
