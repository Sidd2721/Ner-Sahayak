import { calcRisk } from '@shared/risk/calcRisk';

const BANDS = [
  { max: 25, key: 'risk.low' },
  { max: 50, key: 'risk.moderate' },
  { max: 75, key: 'risk.high' },
  { max: 101, key: 'risk.severe' },
];

export function plainLanguageRisk(inputs, t) {
  const score = calcRisk(inputs);
  const band = BANDS.find((b) => score <= b.max);
  return { score, message: t(band.key) };
}
