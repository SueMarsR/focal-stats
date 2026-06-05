// Regenerates the committed test fixture packages/core/test/fixtures/sample.jpg.
// Requires dev dependencies `sharp` and `piexifjs` (a full `npm install`, not --omit=dev).
// Run from repo root: node packages/core/test/make-fixture.mjs
// The generated sample.jpg is committed, so tests and CI never run this script.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';
import piexif from 'piexifjs';

const jpegBuf = await sharp({
  create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 30, b: 30 } },
})
  .jpeg()
  .toBuffer();

const exifObj = {
  '0th': { [piexif.ImageIFD.Make]: 'SONY', [piexif.ImageIFD.Model]: 'ILCE-7M3' },
  Exif: {
    [piexif.ExifIFD.FocalLength]: [35, 1],
    [piexif.ExifIFD.FocalLengthIn35mmFilm]: 52,
    [piexif.ExifIFD.FNumber]: [18, 10],
  },
};
const withExif = piexif.insert(piexif.dump(exifObj), jpegBuf.toString('binary'));
writeFileSync(new URL('./fixtures/sample.jpg', import.meta.url), Buffer.from(withExif, 'binary'));
console.log('wrote fixtures/sample.jpg');
