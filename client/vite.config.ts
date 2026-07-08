import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const envValue = (env: Record<string, string | undefined>, key: string): string | undefined => {
  const value = env[key]?.trim();
  return value === "" ? undefined : value;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const serverUrl = new URL(
    envValue(env, "FM_SERVER_URL") ??
      `http://127.0.0.1:${envValue(env, "FM_SERVER_PORT") ?? envValue(env, "PORT") ?? "4870"}`,
  );
  const serverTarget = serverUrl.origin;
  const wsTarget = `${serverUrl.protocol === "https:" ? "wss:" : "ws:"}//${serverUrl.host}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "127.0.0.1",
      proxy: {
        "/api": serverTarget,
        "/ws": {
          target: wsTarget,
          ws: true,
        },
      },
    },
  };
});
