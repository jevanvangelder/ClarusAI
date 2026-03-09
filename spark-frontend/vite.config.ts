import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";
import type { Plugin } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from "path"

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// Replace hardcoded localhost API URLs with the VITE_API_URL environment variable.
// This allows the same source code to connect to the correct backend in every
// environment without manually editing App.tsx.
function apiUrlPlugin(): Plugin {
  return {
    name: 'api-url-plugin',
    transform(code: string): string | null {
      if (!code.includes('http://localhost:8000')) return null
      return code
        .replace(
          /'http:\/\/localhost:8000\/api\/chat\/send-with-files'/g,
          "`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/chat/send-with-files`"
        )
        .replace(
          /'http:\/\/localhost:8000\/api\/chat\/send'/g,
          "`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/chat/send`"
        )
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiUrlPlugin(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin() as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
