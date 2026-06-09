/**
 * Heuristic: is this a mobile/tablet device where the file picker should open
 * the photo album (accept=image/*) rather than a folder (webkitdirectory)?
 * `maxTouchPoints` catches iPadOS, which reports a desktop "Macintosh" UA.
 */
export function isMobileUA(userAgent: string, maxTouchPoints = 0): boolean {
  if (/Android|iPhone|iPod|iPad/i.test(userAgent)) return true;
  // iPadOS 13+ masquerades as macOS Safari but is a touch device
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return true;
  return false;
}
