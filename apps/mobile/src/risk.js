import { calcRisk } from '@shared/risk/calcRisk';

const BANDS = [
  { max: 25, key: 'risk.low' },
  { max: 50, key: 'risk.moderate' },
  { max: 75, key: 'risk.high' },
  { max: 101, key: 'risk.severe' },
];

export function plainLanguageRisk(inputs, t) {
  // Map front-end UI selections (severity, type, etc.) to the 0..1 normalized inputs required by the shared calcRisk.
  // For the demo preview, we map the single UI 'severity' slider to all environmental factors
  // so the risk score can actually reach the 'High' and 'Severe' bands.
  const mappedInputs = {
    rainfallNorm: inputs.weatherImpact || inputs.severity || 0,
    slopeNorm: inputs.severity || 0,
    soilSaturationNorm: inputs.roadCondition || inputs.severity || 0,
    recentIncidentNorm: inputs.type === 'landslide' ? 1.0 : 0,
  };
  
  const result = calcRisk(mappedInputs);
  // result.category is 'Low', 'Medium', 'High', 'Severe'
  const key = `risk.${result.category}`;
  return { score: (result.score * 100).toFixed(0), message: t(key) || result.category };
}
