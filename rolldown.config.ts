import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/cli.ts',
  platform: 'node',
  output: {
    format: 'esm',
    dir: 'dist',
    entryFileNames: 'cli.js',
  },
  external: [/node_modules/],
  resolve: {
    conditionNames: ['import', 'require', 'node'],
  },
});
