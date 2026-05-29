/**
 * Builds logarithmic strength trend overlays for single-lift E1RM charts.
 * The fitted model uses the user's capability envelope rather than every
 * session point, so deloads and ordinary training variance don't dominate the
 * long-term projection.
 */

const MIN_TREND_POINTS = 8;
const MIN_CAPABILITY_POINTS = 4;
const MIN_TREND_SPAN_DAYS = 90;
const MIN_CAPABILITY_STEP_RATIO = 0.01;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

const FORECAST_MONTHS = [3, 6, 12];

/**
 * @param {Array<Object>} chartData - Recharts data from processVisualizerData.
 * @param {string} liftType - Lift data key to fit, e.g. "Bench Press".
 * @returns {Object|null}
 */
export function buildStrengthTrendProjection(chartData, liftType) {
  const points = Array.isArray(chartData)
    ? chartData
        .filter((point) => Number.isFinite(point?.[liftType]) && point?.rechartsDate)
        .map((point) => ({
          ...point,
          value: point[liftType],
          timestamp: point.rechartsDate,
        }))
        .sort((a, b) => a.timestamp - b.timestamp)
    : [];

  if (points.length < MIN_TREND_POINTS) return null;

  const firstTimestamp = points[0].timestamp;
  const lastTimestamp = points[points.length - 1].timestamp;
  const spanDays = (lastTimestamp - firstTimestamp) / DAY_MS;
  if (spanDays < MIN_TREND_SPAN_DAYS) return null;

  const capabilityPoints = buildCapabilityEnvelopePoints(points);
  if (capabilityPoints.length < MIN_CAPABILITY_POINTS) return null;

  const samples = capabilityPoints.map((point) => ({
    x: getLogTrainingAge(point.timestamp, firstTimestamp),
    y: point.capabilityValue,
  }));
  const regression = fitLinearRegression(samples);
  if (!regression) return null;
  regression.slope = Math.max(0, regression.slope);

  const trendByDate = new Map(
    points.map((point) => [
      point.date,
      Math.max(0, Math.round(predict(point.timestamp, firstTimestamp, regression))),
    ]),
  );

  const futurePoints = FORECAST_MONTHS.map((months) => {
    const timestamp = addUtcMonths(lastTimestamp, months);
    const value = Math.max(0, Math.round(predict(timestamp, firstTimestamp, regression)));
    return {
      date: formatUtcDate(timestamp),
      rechartsDate: timestamp,
      displayUnit: points[points.length - 1].displayUnit,
      trendValue: value,
      isForecast: true,
      forecastLabel: `${months}M`,
    };
  });

  const currentTrend = trendByDate.get(points[points.length - 1].date) ?? null;
  const oneYearForecast = futurePoints[futurePoints.length - 1]?.trendValue ?? null;

  return {
    trendByDate,
    futurePoints,
    currentTrend,
    oneYearForecast,
    pointCount: points.length,
    capabilityPointCount: capabilityPoints.length,
    spanDays,
    slope: regression.slope,
  };
}

function buildCapabilityEnvelopePoints(points) {
  let bestValue = 0;
  const capabilityPoints = [];

  points.forEach((point, index) => {
    if (point.value <= 0) return;

    const isFirstPoint = capabilityPoints.length === 0;
    const improvementRatio = bestValue > 0 ? (point.value - bestValue) / bestValue : 1;
    const isMeaningfulNewBest = improvementRatio >= MIN_CAPABILITY_STEP_RATIO;
    const isLastPoint = index === points.length - 1;

    if (point.value > bestValue) {
      bestValue = point.value;
    }

    if (isFirstPoint || isMeaningfulNewBest || isLastPoint) {
      capabilityPoints.push({
        ...point,
        capabilityValue: bestValue,
      });
    }
  });

  return capabilityPoints;
}

function fitLinearRegression(samples) {
  const n = samples.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  samples.forEach(({ x, y }) => {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < Number.EPSILON) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function predict(timestamp, firstTimestamp, regression) {
  const x = getLogTrainingAge(timestamp, firstTimestamp);
  return regression.intercept + regression.slope * x;
}

function getLogTrainingAge(timestamp, firstTimestamp) {
  const elapsedWeeks = Math.max(0, (timestamp - firstTimestamp) / WEEK_MS);
  return Math.log(elapsedWeeks + 1);
}

function addUtcMonths(timestamp, months) {
  const date = new Date(timestamp);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    date.getUTCDate(),
  );
}

function formatUtcDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
