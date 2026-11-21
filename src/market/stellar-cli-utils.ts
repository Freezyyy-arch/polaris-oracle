import { StrKey } from '@stellar/stellar-sdk';

/** Matches a Stellar StrKey secret seed (`S` + 55 base32 chars). */
const STRKEY_SECRET = /S[A-Z2-7]{55}/g;

/** Replaces any StrKey secret seed in `text` with a placeholder, so CLI errors are safe to log or return over HTTP. */
export function redactSecrets(text: string): string {
  return text.replace(STRKEY_SECRET, '[REDACTED]');
}

/**
 * Builds the error `execStellarCli` rethrows. Node's execFile failure
 * message is `Command failed: stellar ... --source S...` (the full argv,
 * secret included), so it is never used verbatim: the message comes from
 * stderr's `❌` summary line when present, otherwise from the original
 * message, and either way is redacted. The (redacted) stderr is kept on the
 * error so callers that inspect `err.stderr` keep working.
 */
export function sanitizeCliError(err: unknown): Error {
  const e = err as { stderr?: unknown; message?: unknown };
  const stderr = typeof e?.stderr === 'string' && e.stderr.trim() ? redactSecrets(e.stderr) : undefined;
  let message: string;
  if (stderr) {
    const lines = stderr.trim().split('\n');
    message = lines.find((line) => line.includes('❌')) ?? lines[0];
  } else {
    message = redactSecrets(typeof e?.message === 'string' ? e.message : String(err));
  }
  const sanitized = new Error(message) as Error & { stderr?: string };
  if (stderr) sanitized.stderr = stderr;
  return sanitized;
}

/**
 * The contract id from `stellar contract deploy` stdout: the last line that
 * is a valid `C...` contract StrKey. Throws (including the full stdout) if
 * none is found, rather than passing a stray hint/URL line on as an id.
 */
export function extractContractId(stdout: string): string {
  const ids = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => StrKey.isValidContract(line));
  if (ids.length === 0) {
    throw new Error(`stellar contract deploy printed no valid contract id; stdout: ${JSON.stringify(redactSecrets(stdout))}`);
  }
  return ids[ids.length - 1];
}
