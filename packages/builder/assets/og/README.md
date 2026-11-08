# OG image fonts

The optional `og-image-storage` builder plugin reads two font files from this directory:

- `Geist-Medium.ttf`
- `HarmonyOS_Sans_SC_Medium.ttf`

The plugin skips OG image rendering when either file is missing. The current web app generates its own OG image in `apps/web/plugins/vite/og-image-plugin.ts` and does not use this directory.
