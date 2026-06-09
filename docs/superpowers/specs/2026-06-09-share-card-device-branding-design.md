# Spec — Share card device branding ("C-standard") (2026-06-09)

Source: user request — make the share card show device info with brand icons,
inspired by MBTI/16personalities visual identity. Decided scope after research
(workflow `lens-persona-research`, 2026-06-09): **option C, standard depth**.
Persona/archetype hero (options A/B) is explicitly deferred.

## Context & invariants

`focal-stats/web` is a **100% client-side, static** GitHub Pages app. Core promise:
photos never leave the browser. The share card (`packages/web/src/share-card.ts`)
is built as a standalone SVG string, then rasterized to PNG **client-side** via
`new Image()` → `<canvas>` → `toBlob`.

Two hard constraints proven by research, both pointing to the same rule —
**the card must be 100% self-contained, no remote refs:**

1. **Privacy:** any render-time `fetch`/hotlink of a remote logo leaks the user's
   device to a third party — violates the core promise.
2. **Technical:** drawing *any* cross-origin image onto the canvas **taints** it,
   after which `toBlob()`/`toDataURL()` throw `SecurityError`. So a remote logo
   would literally break PNG export. (MDN: "Tainted canvases may not be exported".)
   This is the same class of failure as the earlier bug #2 (font-family quoting):
   the card SVG is rasterized strictly, so everything must be inline + well-formed.

⇒ All brand/body icons are **inline SVG `<path>` data bundled in the repo**. No
`<img>`, no `<use href>` to external files, no web fonts.

Coverage gate (`vitest.config.ts`): `include: packages/*/src/**/*.ts`,
`exclude: main.ts, worker.ts, *.test.ts`, thresholds 80%. ⇒ all new **logic** lives
in tested pure modules; icon/glyph **data** modules are exercised transitively by
card tests.

### Image-scraping is rejected (do NOT do it)

The original idea of scraping per-model device/lens product images is dropped:
manufacturer renders & review-site photos are copyrighted (US statutory damages up
to $150k/work), no open CC0/CC-BY product-image database exists at scale, and
redistributing scraped images in a public AGPL repo is the highest-risk scraping
activity. We use **our own vector glyphs + a permissively-licensed brand-icon set**
instead.

## Goal / non-goals

- **Goal:** the card's device block shows, for the user's main camera body:
  a **monochrome brand icon** + a **generic body-type glyph** (phone / camera /
  action-cam) + clean model text; the lens line keeps text (+ a lens glyph).
  Plus a small trademark disclaimer.
- **Non-goals (v1):** no lens-brand icons (third-party lens EXIF strings are too
  messy — kept as text); no per-model product images; no archetype/persona hero;
  no precise mirrorless-vs-DSLR distinction (that's the deferred "C-plus": a
  model→body-class+crop-factor table from openMVG/Wikidata). Coarse body-type only.

## Brand-icon source & licensing

- **Source: Simple Icons** — license **CC0 1.0** (public-domain dedication). Vendor
  the individual single-`<path>` SVGs into the repo at a **pinned version**
  (do NOT hotlink / `@latest`; Simple Icons removes brands on legal request and in
  twice-yearly cleanups). Each icon is one `<path>`, < ~1 KB.
- **CC0 ≠ trademark.** CC0 waives copyright on the path data but explicitly does NOT
  waive the owners' trademark rights. Mitigations, all applied:
  - Use the icon **only to identify the user's own gear** ("我的器材" framing) →
    nominative/descriptive use.
  - **Monochrome single-color** rendering (drop brand colors).
  - A persistent **disclaimer** on the card/app: "品牌名称与标识为各自所有者的商标,
    本工具与其无关联。"
  - **Removal path:** a single map (`brand-icons.ts`) — if a brand complains or is
    dropped upstream, delete its entry → automatic text-wordmark fallback, no other
    code change.
- **Coverage (verified against Simple Icons slugs + jsDelivr at v16.23.0; re-verify
  at vendoring time, coverage drifts):**
  - ✅ Present: `sony, nikon, fujifilm, panasonic, apple, samsung, google, leica,
    dji, xiaomi, huawei, oneplus, kodak`
  - ❌ Absent: `canon, olympus/om-system, ricoh, pentax, sigma, tamron, gopro,
    hasselblad`
- **Missing-brand fallback:** detect the brand anyway (so we know it's "Canon"), but
  with no icon in the map → render the **plain text wordmark** ("Canon") next to the
  body glyph. Strongest nominative-use posture, zero asset-license issue, minimal
  visual inconsistency (model text is shown either way).
- **Provenance:** add `CREDITS.md` (or NOTICE section) recording Simple Icons CC0 +
  pinned version + the trademark disclaimer.

## Design — core (pure, tested, reusable by CLI)

### 1. Thread `cameraMake` into `byCamera` groups
`PhotoExif.cameraMake` is parsed (`exif.ts`, e.g. `"SONY"`) but **dropped** in
`aggregate()` today. Sony/Fuji/Apple model strings don't contain the brand name
(`ILCE-7M4`, `X-T4`, `iPhone 15`), so `Make` is the **only reliable brand signal**.

- `types.ts`: add `make: string | null` to `GroupStat` (manufacturer; `null` for
  lens groups and for unknown).
- `aggregate.ts`: carry `cameraMake` into the camera grouping; `groupBy` records, per
  group, the most-common non-null make (`null` if none). Lens groups → `make: null`.
- Existing `aggregate.test.ts` assertions updated to include `make`.

### 2. `packages/core/src/brand.ts` — `detectBrand(make, model)`
```ts
export type BrandId =
  | 'sony' | 'canon' | 'nikon' | 'fujifilm' | 'panasonic' | 'olympus'
  | 'leica' | 'ricoh' | 'pentax' | 'hasselblad' | 'sigma' | 'tamron'
  | 'apple' | 'samsung' | 'google' | 'xiaomi' | 'huawei' | 'oneplus'
  | 'dji' | 'gopro' | 'kodak';
export interface Brand { id: BrandId; name: string; } // name = display wordmark
export function detectBrand(make: string | null, model: string | null): Brand | null;
```
- Primary: keyword-match the lowercased `make` (e.g. `fuji`→fujifilm, `lumix`/
  `panasonic`→panasonic, `om digital`/`om system`/`olympus`→olympus, `redmi`→xiaomi).
- Fallback when `make` is null/unrecognized: a small set of unambiguous **model**
  patterns (`eos|powershot`→canon, `iphone`→apple, `pixel`→google, `ilce|dsc|slt-`→
  sony, `gfx`→fujifilm). Conservative — return `null` rather than guess.
- `name` is the clean wordmark: `Sony, Canon, Nikon, Fujifilm, Panasonic, OM System,
  Leica, Ricoh, Pentax, Hasselblad, Sigma, Tamron, Apple, Samsung, Google, Xiaomi,
  Huawei, OnePlus, DJI, GoPro, Kodak`.

### 3. `packages/core/src/body-type.ts` — `detectBodyType(make, model)`
```ts
export type BodyType = 'phone' | 'camera' | 'action-cam' | 'unknown';
export function detectBodyType(make: string | null, model: string | null): BodyType;
```
- `phone`: model matches `/iphone/i`, `/pixel/i`, `/^sm-/i` (Samsung Galaxy),
  `/redmi|poco|^mi |xiaomi/i`, `/oneplus|^cph|^kb|^le2/i`, `/huawei|honor|nexus/i`,
  or Sony Xperia model patterns (`/^xq-|^so-|^xperia|^[fghij]\d{4}$/i`).
- `action-cam`: brand `dji` or `gopro` (or model `/hero\d|osmo|action/i`).
- `camera`: a recognized camera brand (sony/canon/nikon/fujifilm/panasonic/olympus/
  leica/ricoh/pentax/hasselblad) not matched as phone above.
- else `unknown`.
- Note (documented limitation): Sony/Samsung/Panasonic make both phones and cameras;
  ambiguous cases default to `camera`. Native-focal-length disambiguation is C-plus.

### 4. `packages/core/src/index.ts`
Re-export `detectBrand`, `detectBodyType`, and the `BrandId`/`Brand`/`BodyType` types.

## Design — web (rendering)

### 5. `packages/web/src/brand-icons.ts` (vendored Simple Icons data)
`export const BRAND_ICONS: Partial<Record<BrandId, { path: string; viewBox: string }>>`
— only the ✅-covered brands; viewBox `"0 0 24 24"`. Path strings copied verbatim
from Simple Icons @ pinned version (vendored, never fetched at runtime). Brands not
in the map → text fallback.

### 6. `packages/web/src/body-glyphs.ts` (our own generic glyphs)
`export const BODY_GLYPHS: Record<Exclude<BodyType,'unknown'> | 'lens', {path; viewBox}>`
— small hand-authored monochrome paths for `camera`, `phone`, `action-cam`, `lens`.
Brand-neutral by design (research: self-drawn glyphs must not resemble a protected
brand mark). `unknown` body-type → fall back to the `camera` glyph or none.

### 7. `share-card.ts`
- `topReal()` returns the full top `GroupStat` (so the camera line has `make`).
- New helper `iconMarkup(glyph, x, y, size, fill)` → nested
  `<svg x y width height viewBox><path d=.. fill=..></svg>` (inline, well-formed).
- Camera line: `[brand icon | wordmark text] [body glyph]  <model text>`.
  - brand = `detectBrand(cam.make, cam.key)`; body = `detectBodyType(cam.make, cam.key)`.
  - brand icon if `BRAND_ICONS[brand.id]` exists, else render `brand.name` as text.
- Lens line: lens glyph + existing text (no brand icon in v1).
- Add disclaimer text (small, muted) near the footer:
  `品牌名称与标识为各自所有者的商标`.
- All icons monochrome (`fill = TEXT`/`MUTED`). Card stays valid XML — the existing
  well-formedness regression test must still pass; add an assertion that embedded
  `<path>` data introduces no stray quotes.

### 8. `main.ts` (in-page device list) — optional, same helpers
If cheap, mirror the brand icon + body glyph in the in-page device list for
consistency (reuses `BRAND_ICONS`/`BODY_GLYPHS` as inline `<svg>` in HTML). Not
required for v1; card is the priority.

## Edge cases
- `make` null & model unrecognized → no brand icon, body `unknown` → body glyph
  fallback + raw model text. Never blocks render.
- `'未知'` camera (no model) → device line omitted (current behavior).
- Brand detected but absent from icon map (Canon etc.) → text wordmark + body glyph.
- Multi-token make (`["FUJI","FILM"]`) already joined to `"FUJI FILM"` by `exif.str`.
- Phone-dominant library: body glyph = phone; persona softening is out of scope (no
  persona in v1).

## Testing (TDD, write test first)
- `core/brand.test.ts`: SONY→sony; make "Canon"→canon(name "Canon"); FUJIFILM→
  fujifilm; "OM Digital Solutions"→olympus; LUMIX→panasonic; null make + model
  "iPhone 15 Pro"→apple; "NIKON CORPORATION"→nikon; unknown→null.
- `core/body-type.test.ts`: Apple/"iPhone…"→phone; SONY/"ILCE-7M4"→camera; SONY/
  "XQ-DQ72"→phone; samsung/"SM-S911B"→phone; DJI→action-cam; GoPro/"HERO11"→
  action-cam; Canon/"EOS R6"→camera; null/null→unknown.
- `core/aggregate.test.ts`: byCamera groups carry the right `make`; byLens `make`=null.
- `web/share-card.test.ts`: Sony stat → card contains the sony `<path>`; Canon stat →
  card contains text "Canon" and NO icon path; body glyph present; disclaimer present;
  existing XML well-formedness regression still green.
- `web` data modules covered transitively; verify every ✅ BrandId has a non-empty
  path and every BodyType glyph exists.

## Licensing hygiene
- `CREDITS.md`: Simple Icons (CC0 1.0, vendored @ pinned version) + trademark
  disclaimer. Brand path data kept under CC0; our glyphs under the repo's AGPL-3.0.

## Out of scope / follow-ups
- C-plus: model→body-class + crop-factor normalization table (openMVG MIT /
  Wikidata CC0) for exact body class + equiv-35 accuracy.
- Options A/B: focal-length archetype/persona hero + generative "focal fingerprint".
- Lens-maker icons (needs lens-string normalization; exiftool/lensfun data).
