import { useEffect, useState } from 'react';
import { testToken } from '../lib/lichess';
import { TokenCheck, tokenCheck } from '../lib/tokenCheck';

// The organizer's Lichess token, asked to Lichess once per token (lib/tokenCheck.ts). null while
// asking, without a token, or when Lichess could not be asked: no warning on a guess.
export function useTokenCheck(token: string | undefined, enabled: boolean): TokenCheck | null {
  const [result, setResult] = useState<{ token: string; check: TokenCheck } | null>(null);
  useEffect(() => {
    if (!enabled || !token) return;
    let live = true;
    testToken(token)
      .then((info) => live && setResult({ token, check: tokenCheck(info, Date.now()) }))
      .catch((e) => console.warn('Verifica del token Lichess non riuscita:', e));
    return () => {
      live = false;
    };
  }, [token, enabled]);
  return token && result?.token === token ? result.check : null;
}
