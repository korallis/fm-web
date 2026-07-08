/** Default `FM_CAPTAIN_RE` from `fm-classify-lib.sh` / `docs/configuration.md`. Case-insensitive. */
export const FM_CAPTAIN_RE_DEFAULT =
  /done:|needs-decision:|blocked:|failed:|PR ready|checks green|ready in branch|merged/i;

export function isCaptainRelevant(text: string, re: RegExp = FM_CAPTAIN_RE_DEFAULT): boolean {
  return re.test(text);
}

/** Build a classifier regex from an `FM_CAPTAIN_RE` env override, if set. */
export function captainRegexFromEnv(env: Record<string, string | undefined>): RegExp {
  const override = env["FM_CAPTAIN_RE"];
  if (override === undefined || override === "") return FM_CAPTAIN_RE_DEFAULT;
  return new RegExp(override, "i");
}
