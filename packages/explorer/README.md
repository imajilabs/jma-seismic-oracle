# Shindochain — on-chain seismic attestation explorer

A static landing page that visualises every `TriggerAttested` event emitted by
the [`jma-seismic-oracle`](https://github.com/imajilabs/jma-seismic-oracle)
package on Sui testnet. Each attestation renders as a pulsing hypocenter on a
3D globe; the full on-chain payload (magnitude, depth, shindo, source XML
hash, attestation object id, transaction digest) is one click away.

```
                    Sui testnet RPC
                          │
            suix_queryEvents (TriggerAttested)
                          │
                  sui_getObject (TriggerAttestation)
                          │
                          ▼
             globe.gl (three.js) + native DOM UI
```

## What's on screen

| Layer | Source | Notes |
|---|---|---|
| Pulse rings on epicenters | `Hypocenter.latitude_e7 / longitude_e7` | radius + propagation speed scale with magnitude × shindo |
| Epicenter dot | same | sized by magnitude, coloured by shindo |
| Magnitude / depth / shindo | `Hypocenter.magnitude_e2`, `Hypocenter.depth_m`, `Shindo.level`/`.band` | rendered in the detail panel |
| Source XML hash | `TriggerAttestation.source_xml_hash` | hex-encoded |
| Object + transaction links | `attestation_id`, `tx_digest` | open in SuiVision |
| Six hub geographic labels (Tokyo, Osaka, Sapporo, Fukuoka, Sendai, Naha) | hard-coded coords | map landmarks for orientation; not impact claims |
| Live seismograph trace at the bottom | regenerated on each focused attestation | spike sized + coloured by the focused event |

> **What's not on screen**: any inferred city-level impact, felt-radius
> envelopes, or epicenter-to-city arcs. Those layers belong in a downstream
> consumer per `jma-seismic-oracle/CONTRIBUTING.md`. The helper functions
> (`impactedCities`, `feltRadiusKm`, `buildArcs`, `cityTooltip`, `arcTooltip`)
> are still in source — they're cleanly disconnected from the render path and
> tagged `IMPACT LAYER (disabled)` so a fork can re-enable them with a single
> uncomment.

## Run locally

No build step. Any static file server works.

```bash
# from the monorepo root
bun run --cwd packages/explorer dev
# or:
cd packages/explorer && python3 -m http.server 7878
open http://localhost:7878
```

The page bootstraps with a bundled snapshot of the first attestation
(`tx AwnENjXH33DtkvmdiNk5PRPeAWAofA1H9ZvXcacji6Qt`) and then refreshes from
`fullnode.testnet.sui.io` on load. It polls for new attestations every 20s.

## Files

```
packages/explorer/
├── index.html       page chrome + decorative SVG elements
├── styles.css       dark-instrument aesthetic, responsive (mobile bottom-sheet)
├── app.js           globe.gl render loop, sheet drag, info modal
├── data.js          bundled snapshot + (unused) cities dataset + impact math
├── sui.js           Sui JSON-RPC client (suix_queryEvents + sui_getObject)
└── package.json     workspace metadata; no build step required
```

## Tech notes

- Globe rendering: [`globe.gl`](https://github.com/vasturiano/globe.gl) (wraps
  three.js). Loaded via ESM from esm.sh; no bundler.
- Country polygons: `world-atlas@2/countries-110m.json` (TopoJSON, decoded
  inline so we don't need a topojson-client dependency).
- Mobile: fullbleed globe + draggable 3-state bottom sheet (peek / half /
  full) with rAF-batched drag. Detail becomes a full-screen overlay; hero
  becomes a modal triggered by an info button. Safe-area-insets throughout.
- Accessibility: every interactive surface is a `<button>` with an
  `aria-label`, cases support keyboard activation, `prefers-reduced-motion`
  reduces ring animations. Touch devices skip auto-rotate.
- Security: chain data is HTML-escaped before any `innerHTML` interpolation
  (defence in depth against a future malicious package reusing the struct).
- Performance: `modulepreload` on globe.gl, `preload as=fetch` on the country
  data, `contain: layout style paint` on every panel, `content-visibility:
  auto` on event rows, lighter `backdrop-filter` on phones, single-ring pulse
  + slower dash on phones, parallel `sui_getObject` hydration.

## Typography

- **Fraunces** — variable serif, display only. Italic at high `opsz` for the
  hero word.
- **IBM Plex Sans JP** — body. Chosen for its Japanese coverage (the data is
  JMA) rather than the usual Inter/Roboto default.
- **JetBrains Mono** — every numeric / id / timestamp.

## License

Apache-2.0 — same as the parent repo.
