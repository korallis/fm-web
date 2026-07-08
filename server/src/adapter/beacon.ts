/** `state/.last-watcher-beat` carries no content — only its mtime matters. */
export function beaconAgeSeconds(beaconMtimeMs: number, nowMs: number): number {
  return Math.max(0, (nowMs - beaconMtimeMs) / 1000);
}

export function isBeaconFresh(ageSeconds: number, guardGraceSeconds: number): boolean {
  return ageSeconds < guardGraceSeconds;
}
