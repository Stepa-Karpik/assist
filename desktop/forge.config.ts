import type { ForgeConfig } from "@electron-forge/shared-types";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: "Karpik"
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "karpik",
        authors: "Stepa Karpik",
        owners: "Stepa Karpik",
        setupExe: "KarpikSetup.exe"
      }
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["win32"],
      config: {}
    }
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "src/main/main.ts",
            config: "vite.main.config.ts"
          },
          {
            entry: "src/preload/index.ts",
            config: "vite.preload.config.ts"
          }
        ],
        renderer: [
          {
            name: "main_window",
            config: "vite.renderer.config.ts"
          }
        ]
      }
    }
  ]
};

export default config;
