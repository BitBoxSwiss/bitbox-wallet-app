// SPDX-License-Identifier: Apache-2.0

export type TChartPoint = {
  x: number;
  y: number;
};

export type TChartMarkerPoint = TChartPoint & {
  id: string;
};

type TSize = {
  height: number;
  width: number;
};

type TTooltipPlacement = {
  left: number;
  top: number;
};

type TTooltipPlacementParams = {
  anchor: TChartPoint;
  container: TSize;
  markerClearance: number;
  markerPoints: TChartMarkerPoint[];
  margin: number;
  tooltip: TSize;
  tooltipGap: number;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.max(min, Math.min(max, value))
);

const distanceToTooltip = (
  point: TChartPoint,
  position: TTooltipPlacement,
  tooltip: TSize,
): number => {
  const distanceX = Math.max(
    position.left - point.x,
    0,
    point.x - (position.left + tooltip.width),
  );
  const distanceY = Math.max(
    position.top - point.y,
    0,
    point.y - (position.top + tooltip.height),
  );
  return Math.hypot(distanceX, distanceY);
};

export const findMarkerAtPoint = (
  point: TChartPoint,
  markerPoints: TChartMarkerPoint[],
  hitRadius: number,
): string | null => {
  let nearestMarkerID: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const markerPoint of markerPoints) {
    const distance = Math.hypot(point.x - markerPoint.x, point.y - markerPoint.y);
    if (distance <= hitRadius && distance < nearestDistance) {
      nearestDistance = distance;
      nearestMarkerID = markerPoint.id;
    }
  }

  return nearestMarkerID;
};

export const findMarkerNearX = (
  pointX: number,
  markerPoints: TChartMarkerPoint[],
  proximity: number,
): string | null => {
  let nearestMarkerID: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const markerPoint of markerPoints) {
    const distance = Math.abs(pointX - markerPoint.x);
    if (distance <= proximity && distance < nearestDistance) {
      nearestDistance = distance;
      nearestMarkerID = markerPoint.id;
    }
  }

  return nearestMarkerID;
};

export const placeTooltip = ({
  anchor,
  container,
  markerClearance,
  markerPoints,
  margin,
  tooltip,
  tooltipGap,
}: TTooltipPlacementParams): TTooltipPlacement => {
  const maxLeft = Math.max(margin, container.width - tooltip.width - margin);
  const maxTop = Math.max(margin, container.height - tooltip.height - margin);
  const desiredPositions: TTooltipPlacement[] = [
    {
      left: anchor.x - tooltip.width / 2,
      top: anchor.y - tooltipGap - tooltip.height,
    },
    {
      left: anchor.x - tooltip.width / 2,
      top: anchor.y + tooltipGap,
    },
    {
      left: anchor.x + tooltipGap,
      top: anchor.y - tooltip.height / 2,
    },
    {
      left: anchor.x - tooltipGap - tooltip.width,
      top: anchor.y - tooltip.height / 2,
    },
  ];

  const candidates = desiredPositions.map((desired, order) => {
    const position = {
      left: clamp(desired.left, margin, maxLeft),
      top: clamp(desired.top, margin, maxTop),
    };
    const clampDistance = Math.hypot(position.left - desired.left, position.top - desired.top);
    const coveredMarkers = markerPoints.filter(
      markerPoint => distanceToTooltip(markerPoint, position, tooltip) < markerClearance,
    ).length;
    return {
      ...position,
      order,
      placementCost: clampDistance
        + coveredMarkers * markerClearance
        + order * tooltipGap,
      selectedMarkerCovered: distanceToTooltip(anchor, position, tooltip) < markerClearance,
    };
  });

  candidates.sort((candidateA, candidateB) => {
    if (candidateA.selectedMarkerCovered !== candidateB.selectedMarkerCovered) {
      return Number(candidateA.selectedMarkerCovered) - Number(candidateB.selectedMarkerCovered);
    }
    if (candidateA.placementCost !== candidateB.placementCost) {
      return candidateA.placementCost - candidateB.placementCost;
    }
    return candidateA.order - candidateB.order;
  });

  const bestCandidate = candidates[0];
  if (!bestCandidate) {
    return { left: margin, top: margin };
  }
  return {
    left: bestCandidate.left,
    top: bestCandidate.top,
  };
};
