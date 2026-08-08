import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { decoVitePlugin } from "@decocms/tanstack/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import path from "path";
import agentsVitePlugin from "agents/vite";

const srcDir = path.resolve(__dirname, "src");

export default defineConfig({
  server: {
    allowedHosts: [".decocdn.com", ".trycloudflare.com", ".preview-studio.decocms.com"],
    // Shopify Storefront API is called server-side from loaders — no dev
    // proxy is needed. Checkout happens on Shopify's hosted checkout (or
    // the store's custom domain).
  },
  plugins: [
    // Handles TC39 decorator transforms for @callable() (Vite's default
    // Oxc transpiler doesn't support them yet — oxc#9170) — needed for
    // src/agents/discovery/agent.ts. Must run before other transforms see
    // that code.
    ...agentsVitePlugin(),
    cloudflare({
      viteEnvironment: { name: "ssr" },
      // Ticket 08's Tail Worker (sales-agent/.scratch/discovery-agent-architecture's
      // build-plan.md Phase 5/7) — runs alongside the main worker in local
      // dev via Miniflare's own tail-event simulation, so `discovery-tail:*`
      // console output shows up in this same `npm run dev` process.
      auxiliaryWorkers: [{ configPath: "./discovery-agent-tail/wrangler.jsonc" }],
    }),
    tanstackStart({ server: { entry: "server" } }),
    react({
      babel: {
        plugins: [
          ["babel-plugin-react-compiler", { target: "19" }],
        ],
      },
    }),
    tailwindcss(),
    decoVitePlugin(),
    {
      name: "site-manual-chunks",
      config(_cfg, { command }) {
        if (command !== "build") return;
        return {
          build: {
            rollupOptions: {
              output: {
                manualChunks(id: string) {
                  if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/"))
                    return "vendor-react";
                  if (id.includes("@tanstack/react-router") || id.includes("@tanstack/start"))
                    return "vendor-router";
                  if (id.includes("@tanstack/react-query")) return "vendor-query";
                },
              },
            },
          },
        };
      },
    },
    {
      name: "deco-stub-meta-gen",
      enforce: "pre" as const,
      resolveId(id, importer, options) {
        if (!options?.ssr && importer && id.includes("meta.gen")) {
          return "\0stub:meta-gen";
        }
      },
      load(id) {
        if (id === "\0stub:meta-gen") {
          return "export default {};";
        }
      },
    },
  ],
  build: {
    sourcemap: "hidden",
    rollupOptions: {
      onLog(level, log, handler) {
        if (
          log.code === "PLUGIN_WARNING" &&
          log.plugin === "vite:reporter" &&
          log.message?.includes("dynamic import will not move module")
        ) {
          return;
        }
        handler(level, log);
      },
    },
  },
  define: {
    "process.env.DECO_SITE_NAME": JSON.stringify(
      process.env.DECO_SITE_NAME || "sillage"
    ),
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    dedupe: [
      "@tanstack/react-start",
      "@tanstack/react-router",
      "@tanstack/react-start-server",
      "@tanstack/start-server-core",
      "@tanstack/start-client-core",
      "@tanstack/start-plugin-core",
      "@tanstack/start-storage-context",
      "react",
      "react-dom",
    ],
    alias: {
      "~": srcDir,
    },
  },
});
