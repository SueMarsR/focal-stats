# Credits & third-party assets

## Brand icons — Simple Icons

The monochrome camera/phone brand glyphs in
`packages/web/src/brand-icons.ts` are vendored from
[Simple Icons](https://simpleicons.org), licensed **CC0 1.0 Universal**
(public-domain dedication). Vendored at a pinned version (**v16.23.0**); the
single-`<path>` data is inlined into the source so the share card stays fully
self-contained (no remote fetch at render time).

### Trademark notice

CC0 covers the icon *path data* only. The brand names, logos and marks remain
**trademarks of their respective owners**. Brand icons in this project are used
solely to identify the photographer's own equipment on a shareable card
(nominative/descriptive use), rendered in a single neutral colour, and do **not**
imply any affiliation with, sponsorship by, or endorsement from the trademark
owners. The share card carries the notice:
*"品牌名称与标识为各自所有者的商标"*.

If you are a brand owner and want a mark removed, open an issue — removing its
entry from `brand-icons.ts` makes the card fall back to a plain text wordmark
with no other code change.

## Self-authored glyphs

The generic body-type glyphs (camera / phone / action-cam / lens) in
`packages/web/src/body-glyphs.ts` are original, deliberately brand-neutral
vector art, licensed under this project's AGPL-3.0.
