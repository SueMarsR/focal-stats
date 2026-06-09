import type { BodyType } from '@focal-stats/core';
import type { IconGlyph } from './brand-icons';

// Self-authored, deliberately brand-neutral device glyphs (research: self-drawn
// glyphs must not resemble a protected brand mark). Each is a single path in a
// 24x24 box using fill-rule "evenodd" so an inner shape reads as a cut-out
// (lens opening / phone screen). Used for the body-type indicator on the share
// card; carry zero copyright/trademark exposure.

const VB = '0 0 24 24';

/** Keys: the three concrete body classes (BodyType minus 'unknown') plus 'lens'. */
export type GlyphKey = Exclude<BodyType, 'unknown'> | 'lens';

export const BODY_GLYPHS: Record<GlyphKey, IconGlyph> = {
  // Camera body with a pentaprism bump and a round lens cut-out.
  camera: {
    viewBox: VB,
    fillRule: 'evenodd',
    path:
      'M8.5 4 l1-1.6 h5 l1 1.6 H20 a2 2 0 0 1 2 2 v12 a2 2 0 0 1-2 2 H4 a2 2 0 0 1-2-2 V6 a2 2 0 0 1 2-2 z ' +
      'M12 8.3 a4.4 4.4 0 1 0 0 8.8 a4.4 4.4 0 0 0 0-8.8 z',
  },
  // Phone outline with a screen cut-out.
  phone: {
    viewBox: VB,
    fillRule: 'evenodd',
    path: 'M7 2 h10 a2 2 0 0 1 2 2 v16 a2 2 0 0 1-2 2 H7 a2 2 0 0 1-2-2 V4 a2 2 0 0 1 2-2 z M7.8 5.6 h8.4 v12.8 H7.8 z',
  },
  // Compact, near-square action cam with an off-centre lens cut-out.
  'action-cam': {
    viewBox: VB,
    fillRule: 'evenodd',
    path:
      'M4 6 h16 a2 2 0 0 1 2 2 v8 a2 2 0 0 1-2 2 H4 a2 2 0 0 1-2-2 V8 a2 2 0 0 1 2-2 z ' +
      'M13 8.6 a3.4 3.4 0 1 0 0 6.8 a3.4 3.4 0 0 0 0-6.8 z',
  },
  // Lens: outer ring (cut-out) with a centre element.
  lens: {
    viewBox: VB,
    fillRule: 'evenodd',
    path:
      'M12 3 a9 9 0 1 0 0 18 a9 9 0 0 0 0-18 z ' +
      'M12 6.6 a5.4 5.4 0 1 0 0 10.8 a5.4 5.4 0 0 0 0-10.8 z ' +
      'M12 9.8 a2.2 2.2 0 1 0 0 4.4 a2.2 2.2 0 0 0 0-4.4 z',
  },
};
