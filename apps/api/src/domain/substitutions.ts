import { normalizePack } from './comparison';
import { normalizeText } from './matching';
interface ProductIdentity {
  name: string;
  brand: string;
  quantity: string;
  variantName: string;
  category: string;
}
export function compatibleSubstitution(a: ProductIdentity, b: ProductIdentity) {
  const core = (p: ProductIdentity) => {
    const brand = new Set(normalizeText(p.brand).split(' '));
    return normalizeText(p.name)
      .split(' ')
      .filter(token => !brand.has(token))
      .join(' ');
  };
  return (
    Boolean(core(a)) &&
    core(a) === core(b) &&
    normalizeText(a.category) === normalizeText(b.category) &&
    normalizeText(a.variantName) === normalizeText(b.variantName) &&
    Boolean(normalizePack(a.quantity)) &&
    normalizePack(a.quantity) === normalizePack(b.quantity)
  );
}
