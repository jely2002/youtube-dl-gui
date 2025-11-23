import { defineConfig, UserConfig } from 'vite';

export default defineConfig((): UserConfig => ({
  root: 'src-isolation',
  build: {
    outDir: '../dist-isolation',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './src-isolation/index.html',
      },
    },
  },
}));
