import { defineConfig } from 'tsup';

export default defineConfig({
   entry: ['src/index.ts', 'src/no-fs.ts'],
   outDir: 'dist',
   format: ['esm', 'cjs'],
   dts: true,
   clean: true,
   minify: true,
   bundle: true,
});
