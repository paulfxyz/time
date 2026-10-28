# Third-party assets

The MIT license covers this project's original source code, interface, documentation, and tooling. It does not relicense third-party fonts, imagery, or icon libraries.

## Satoshi

Satoshi comes from [Fontshare / Indian Type Foundry](https://www.fontshare.com/fonts/satoshi) and is governed by the [ITF Free Font License](https://www.fontshare.com/licenses/itf-ffl).

The current official license expressly permits own-site self-hosting through CSS `@font-face`. Font binaries are not included in the public Git repository or its source history. `npm run setup:assets` obtains unmodified files from the official Fontshare CDN for the builder's own permitted website use, with pinned SHA-256 checks.

Anyone building or reusing this project must obtain their own licensed copy and comply with the current font license. Do not redistribute these files as a font library, template-font service, or standalone download.

## Earth imagery

The setup script obtains the day, night, cloud, and specular maps from the [Three.js example texture collection hosted by Wellesley College](https://cs.wellesley.edu/~cs307/threejs/r124/three.js-master/examples/textures/planets/). It checks pinned source hashes and converts the maps to WebP.

These third-party texture files are not included in the public source repository, and no MIT claim is made over them. They are static composites, not live satellite or weather imagery. Reusers should check the rights and attribution requirements applicable to their own use, or substitute their own equirectangular maps.

## Lucide

The small, bundled interface icon set is from Lucide. Its ISC/MIT attribution is retained in [`public/assets/lucide-LICENSE.txt`](../public/assets/lucide-LICENSE.txt).

## Additional clock typography

JetBrains Mono and Instrument Serif are distributed under the SIL Open Font License 1.1. Unmodified font binaries and their copyright/license files are included in `public/assets/`, and embedded in the Mac application's clock display.

- JetBrains Mono: [Google Fonts distribution](https://github.com/google/fonts/tree/9862abc066c9b83bf84c3e8ed1fc2d8d48f9bbf0/ofl/jetbrainsmono), with `JetBrainsMono-OFL.txt`.
- Instrument Serif: [Google Fonts distribution](https://github.com/google/fonts/tree/9862abc066c9b83bf84c3e8ed1fc2d8d48f9bbf0/ofl/instrumentserif), with `InstrumentSerif-OFL.txt`.

The Mac bundle embeds Satoshi solely to render this app's fixed interface, as permitted by the [ITF Free Font License desktop-application embedding clause](https://www.fontshare.com/licenses/itf-ffl). It is not exposed as a font-selection service or font download.

## Scene names and effects

Procedural ambient effects and scene compositions are original project code. Cupertino and Spectrum are independent design tributes; no Apple or Google logos, proprietary typefaces, or affiliation claims are included.

## Solar calculations

The solar model implements the compact equations in [NOAA General Solar Position Calculations](https://www.gml.noaa.gov/grad/solcalc/solareqns.PDF). Computed illumination and sunrise/sunset are estimates, not navigation, weather, or legal-event predictions.
