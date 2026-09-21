import { createHash } from 'node:crypto';
import { normalizePack } from './comparison';
export interface MatchIdentity {
  brand: string;
  title: string;
  packSize: string;
  variant: string;
  category: string;
}
export const normalizeText = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
function identity(p: MatchIdentity) {
  return {
    brand: normalizeText(p.brand),
    title: normalizeText(p.title),
    packSize: normalizePack(p.packSize),
    variant: normalizeText(p.variant),
    category: normalizeText(p.category),
  };
}
export const fingerprint = (p: MatchIdentity) =>
  createHash('sha256')
    .update(JSON.stringify(identity(p)))
    .digest('hex');
export interface MatchResult {
  status: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED';
  productId: string | null;
  confidence: number;
  method: 'MANUAL' | 'EXACT' | 'FUZZY' | 'NONE';
  candidates: { productId: string; confidence: number }[];
}
export function matchProduct(
  raw: MatchIdentity,
  candidates: (MatchIdentity & { id: string })[],
  manual?: { productId: string; fingerprint: string },
): MatchResult {
  const p = identity(raw);
  const none: MatchResult = {
    status: 'UNMATCHED',
    productId: null,
    confidence: 0,
    method: 'NONE',
    candidates: [],
  };
  if (!p.brand || !p.title || !p.packSize || !p.category) return none;
  const compatible = candidates.filter(c => {
    const n = identity(c);
    return (
      n.brand === p.brand &&
      n.packSize === p.packSize &&
      n.variant === p.variant &&
      n.category === p.category
    );
  });
  if (
    manual &&
    manual.fingerprint === fingerprint(raw) &&
    compatible.some(c => c.id === manual.productId)
  )
    return {
      status: 'MATCHED',
      productId: manual.productId,
      confidence: 1,
      method: 'MANUAL',
      candidates: [],
    };
  const exact = compatible.filter(c => normalizeText(c.title) === p.title);
  if (exact.length)
    return {
      status: exact.length === 1 ? 'MATCHED' : 'AMBIGUOUS',
      productId: exact.length === 1 ? exact[0].id : null,
      confidence: 1,
      method: 'EXACT',
      candidates: exact.map(c => ({ productId: c.id, confidence: 1 })),
    };
  // Token Dice similarity only within brand/pack/variant/category boundaries.
  const tokens = new Set(p.title.split(' '));
  const ranked = compatible
    .map(c => {
      const other = new Set(normalizeText(c.title).split(' '));
      return {
        productId: c.id,
        confidence:
          (2 * [...tokens].filter(t => other.has(t)).length) /
          (tokens.size + other.size),
      };
    })
    .filter(c => c.confidence >= 0.7)
    .sort(
      (a, b) =>
        b.confidence - a.confidence || a.productId.localeCompare(b.productId),
    );
  if (!ranked.length) return none;
  const first = ranked[0];
  // Fuzzy results require review; scores are similarities, not calibrated probabilities.
  return {
    status: 'AMBIGUOUS',
    productId: null,
    confidence: first.confidence,
    method: 'FUZZY',
    candidates: ranked.slice(0, 5),
  };
}
