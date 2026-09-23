import { CheckoutComparison, BasketPlan } from '../../../../packages/contracts/checkout';
const eta = (p: BasketPlan) => Math.max(...p.deliveries.map(d => d.store.etaMinutes));
const identity = (p: BasketPlan) => p.deliveries.map(d => d.store.id).sort().join('|');
export function explain(result: CheckoutComparison, mode: string) {
  const chosen = result.recommended;
  if (!chosen) return 'No complete basket meets your location, stock, freshness and preference requirements.';
  const other = result.singles.filter(p => identity(p) !== identity(chosen)).sort((a,b) => a.finalPayablePaise-b.finalPayablePaise)[0];
  const name = chosen.deliveries.map(d => d.store.retailer).join(' + ');
  if (!other) return `${name} is the best verified plan found for your ${mode.toLowerCase()} preference, with ${chosen.deliveryCount} delivery(s). No other complete single-store quote was available.`;
  const price = other.finalPayablePaise-chosen.finalPayablePaise, minutes = eta(other)-eta(chosen);
  return `${name} is ₹${(Math.abs(price)/100).toFixed(2)} ${price >= 0 ? 'cheaper' : 'more expensive'} after fees and ${Math.abs(minutes)} minutes ${minutes >= 0 ? 'faster' : 'slower'} than ${other.deliveries[0].store.retailer}. Ranked for ${mode.toLowerCase()}${result.search.complete ? '.' : '; search was bounded, so a better plan may exist.'}`;
}
