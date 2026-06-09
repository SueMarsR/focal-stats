import type { PhotoExif } from '@focal-stats/core';

// A realistic "35mm shooter" library for the landing-page demo: one body, a 24-70
// zoom plus an 85mm prime, with 35mm clearly dominant. Lets a first-time visitor see
// a histogram, insights, and a share card instantly — no photos required.
const ZOOM = 'FE 24-70mm F2.8 GM';
const PRIME = 'FE 85mm F1.4 GM';
const BODY = 'ILCE-7M4';

const SHOTS: ReadonlyArray<readonly [focal: number, count: number, lens: string]> = [
  [24, 14, ZOOM],
  [35, 58, ZOOM],
  [50, 31, ZOOM],
  [70, 12, ZOOM],
  [85, 19, PRIME],
];

export const SAMPLE_PHOTOS: PhotoExif[] = SHOTS.flatMap(([focal, count, lensModel]) =>
  Array.from({ length: count }, (_, i) => ({
    name: `demo-${focal}mm-${i + 1}.jpg`,
    focalLength: focal,
    focalLength35mm: focal,
    lensModel,
    cameraMake: 'Sony',
    cameraModel: BODY,
    fNumber: null,
  })),
);
