import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/workday_allocation/",
  build: { outDir: "dist" },
});
