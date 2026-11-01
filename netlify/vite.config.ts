import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({root:path.resolve('netlify/client'),publicDir:path.resolve('public'),plugins:[react()],build:{outDir:path.resolve('netlify-dist'),emptyOutDir:true},server:{fs:{allow:[path.resolve('.')]}}});
