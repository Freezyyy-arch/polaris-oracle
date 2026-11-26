export interface AppConfig {
  port: number;
  oracleSecretKey: string;
  /** Optional separate identity for market deployment only — falls back to `oracleSecretKey` if unset. See `StellarService`'s `deployerKeypair` doc comment for why splitting this out is safe and worth it. */
  deployerSecretKey: string | undefined;
  adminApiKey: string;
  pythLazerToken: string | undefined;
  pythLazerWsUrl: string;
  pythHermesUrl: string;
  corsOrigins: string[];
  stellarRpcUrl: string;
  stellarNetworkPassphrase: string;
  stellarNetwork: string;
  marketWasmHash: string | undefined;
  /** `contracts/perpetual` — see `polaris-contracts/README.md`'s "The perpetual contract". */
  perpetualWasmHash: string | undefined;
  lazerContract: string | undefined;
  nativeXlmSac: string | undefined;
  smartWalletFactoryContract: string | undefined;
  smartWalletWasmHash: string | undefined;
  treasuryAddress: string | undefined;
  xlmUsdFeedId: number;
  marketsDbFile: string;
  friendbotUrl: string;
  faucetAmountStroops: string;
  faucetMaxPerHour: number;
  /** IP-keyed limit on POST /wallets/deploy — mitigates, doesn't close, the known unauthenticated-endpoint gap (see WalletDeployRateLimiter). */
  walletDeployMaxPerHour: number;
  emailWalletEncKeyHex: string;
  sessionJwtSecret: string;
  sessionTtlSecs: number;
  emailProvider: string;
  resendApiKey: string | undefined;
  emailFrom: string;
  emailCodeTtlSecs: number;
  emailCodeMaxAttempts: number;
  emailCodeResendCooldownSecs: number;
  /** Only used to fill in a WebAuthn-shaped `client_data_json`/`rpIdHash` for custodial signatures — never validated on-chain (see `email-wallet-signer.ts`), so these don't need to match the frontend exactly. */
  emailWalletRpId: string;
  emailWalletOrigin: string;
  vaultContract: string | undefined;
  /**
   * Feeds `MarketFactoryService` creates markets for. Not auto-discovered
   * from Pyth's catalog: `@pythnetwork/pyth-lazer-sdk` *does* ship a
   * `getSymbols()` metadata lookup (correcting an earlier, incomplete read
   * of this SDK — it exists, confirmed straight from
   * `dist/esm/client.mjs`), but it's an authenticated call gated on
   * `PYTH_LAZER_TOKEN`, the same optional/paid credential settlement itself
   * degrades gracefully without — not something worth hard-depending on for
   * "what feeds exist." So this stays "no human clicks a button," not
   * "automatically finds every tradeable asset": a maintained list, not a
   * live discovery feed. See `polaris-contracts/README.md`'s vault section
   * for how this fits into market creation.
   *
   * `feedId` is the small-integer Pyth Lazer id (`XLM_USD_FEED_ID`'s scheme
   * — what `settle()` subscribes to and what gets stored per market).
   * `hermesFeedId` is the *separate* 32-byte-hex id Pyth's Hermes HTTP API
   * uses (same distinction `PriceController` already documents) — read once
   * per catalog entry to pick a fresh strike price at creation time
   * (`MarketFactoryService`) and, independently, as a settlement-time
   * cross-check against the Lazer-signed price (`MarketService.trySettle`,
   * `settleOracleToleranceBps` below) — the *strike*-price lookup has no
   * on-chain equivalent to compare against; the *settlement* one does, via
   * `OracleService.waitForUpdate`'s `parsed: true` decode of the same
   * `leEcdsa` message.
   */
  feedCatalog: { feedId: number; hermesFeedId: string; symbol: string }[];
  /**
   * How far apart (in bps) the Lazer-signed settlement price and Hermes'
   * independently-fetched current price are allowed to be before
   * `trySettle` refuses to trust the payload and falls back to `cancel`
   * instead — defense in depth on top of the on-chain signature
   * verification, not a replacement for it. Deliberately loose (150 = 1.5%
   * default): both ultimately source from Pyth, so this is catching a gross
   * divergence (a stale/wrong feed, a parse bug), not adjudicating normal
   * cross-path noise between two aggregations of the same publisher
   * network — a tight tolerance would turn a safety net into a new way to
   * needlessly stall a healthy settlement.
   */
  settleOracleToleranceBps: number;
  /**
   * `Market.reflector` — the on-chain second-oracle enforcement `settle()`
   * itself now performs (see `polaris-contracts/README.md`'s "On-chain
   * second-oracle: Reflector Network"), distinct from
   * `settleOracleToleranceBps` above (that's the *earlier, off-chain*
   * Lazer-vs-Hermes advisory check, still separately in place). These four
   * become `initialize`'s 12th parameter for every newly-deployed market.
   */
  reflectorContract: string | undefined;
  reflectorAsset: string;
  reflectorMaxStalenessSecs: string;
  reflectorToleranceBps: number;
  marketFactoryIntervalSecs: number;
  marketFactoryExpirySecs: number;
  marketFactoryGracePeriodSecs: number;
  marketFactoryBaseFeeBps: number;
  /** How often `OddsSnapshotService` records each open market's odds — the resolution of the frontend's "Chg" column. */
  oddsSnapshotIntervalSecs: number;
  /** The lookback window `GET /markets/:id/price`'s `yesBpsChange` is computed against — see `OddsSnapshotRepository.closestBefore`. */
  oddsChangeWindowSecs: number;
  marketFactoryMinFeeBps: number;
  marketFactoryInitialLiquidityStroops: string;
  /**
   * `contracts/perpetual`'s `price_oracle` bundle requires *both* the
   * Reflector and RedStone legs whenever it's configured at all (see
   * `polaris-contracts/README.md`'s "A third oracle: RedStone") —
   * RedStone has no testnet deployment, so `mockRedstoneContract` points
   * at `polaris-mock-redstone` (also see that README) as its stand-in.
   * `perpetualPriceOracle` stays `undefined` (and every perpetual this
   * backend deploys keeps `price_oracle: None`, as before) unless *all*
   * of `lazerContract`/`reflectorContract`/`mockRedstoneContract` are
   * configured — no half-wired bundle gets passed to `initialize`.
   */
  mockRedstoneContract: string | undefined;
  redstoneMaxStalenessSecs: string;
  redstoneToleranceBps: number;
  /**
   * Ceiling (in stroops) on the inclusion fee `AuthRelayService` derives
   * from `getFeeStats()` for sponsored relay/settlement transactions —
   * caps sponsor cost under a fee spike instead of paying whatever the
   * network's p70 happens to be.
   */
  maxInclusionFeeStroops: number;
}

import { randomBytes } from 'node:crypto';

/**
 * Dev-only fallback so the process can boot without every secret set —
 * generated fresh each boot, which means any data encrypted/signed with it
 * (custodial private keys, session tokens) becomes unrecoverable/invalid
 * across a restart. Loud on purpose: this must never be what production
 * actually runs on.
 */
function devFallbackSecret(envVar: string, byteLength: number): string {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  // eslint-disable-next-line no-console
  console.warn(
    `[config] ${envVar} not set — generating a random one for this process only. ` +
      `Custodial email wallets will be unrecoverable after a restart until this is set. Do not run production like this.`,
  );
  return randomBytes(byteLength).toString('hex');
}

// XLM/USD's real Hermes registry id — confirmed live against
// `hermes.pyth.network`'s own `/v2/price_feeds?query=XLM` lookup and a real
// `/v2/updates/price/latest` read (not copied from memory/docs and hoped
// correct), unlike XLM_USD_FEED_ID's Lazer id above, which really is an
// unverified testnet placeholder since Lazer has no equivalent public
// lookup. Still: this only decides the *strike price* of an auto-created
// market, not settlement — a wrong id here fails the Hermes lookup loudly
// per-feed (see MarketFactoryService.run), it doesn't misprice anything
// silently.
const DEFAULT_FEED_CATALOG: { feedId: number; hermesFeedId: string; symbol: string }[] = [
  { feedId: 100, hermesFeedId: '0xb7a8eba68a997cd0210c2e1e4ee811ad2d174b3611c22d9ebf16f4cb7e9ba850', symbol: 'XLM/USD' },
];

/** Parses `FEED_CATALOG` (a JSON array of `{feedId, hermesFeedId, symbol}`) — falls back to the single feed this build has always used rather than throwing, since a malformed env var shouldn't stop the whole process from booting. */
export function parseFeedCatalog(raw: string | undefined): { feedId: number; hermesFeedId: string; symbol: string }[] {
  if (!raw) return DEFAULT_FEED_CATALOG;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[config] FEED_CATALOG is not valid JSON — falling back to the default XLM/USD-only catalog.');
    return DEFAULT_FEED_CATALOG;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[config] FEED_CATALOG must be a non-empty JSON array — falling back to the default XLM/USD-only catalog.');
    return DEFAULT_FEED_CATALOG;
  }
  const catalog: { feedId: number; hermesFeedId: string; symbol: string }[] = [];
  for (const entry of parsed) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as Record<string, unknown>).feedId !== 'number' ||
      typeof (entry as Record<string, unknown>).hermesFeedId !== 'string' ||
      typeof (entry as Record<string, unknown>).symbol !== 'string'
    ) {
      // eslint-disable-next-line no-console
      console.warn('[config] FEED_CATALOG entry is missing a numeric `feedId` or string `hermesFeedId`/`symbol` — falling back to the default XLM/USD-only catalog.');
      return DEFAULT_FEED_CATALOG;
    }
    catalog.push({
      feedId: (entry as { feedId: number }).feedId,
      hermesFeedId: (entry as { hermesFeedId: string }).hermesFeedId,
      symbol: (entry as { symbol: string }).symbol,
    });
  }
  return catalog;
}
