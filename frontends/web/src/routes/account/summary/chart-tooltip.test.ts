// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { findMarkerAtPoint, findMarkerNearX, placeTooltip } from './chart-tooltip';

describe('findMarkerAtPoint', () => {
  const markerPoints = [
    { id: 'first', x: 80, y: 100 },
    { id: 'second', x: 140, y: 60 },
  ];

  it('allows a small amount of touch imprecision around a marker', () => {
    expect(findMarkerAtPoint({ x: 91, y: 109 }, markerPoints, 16)).toBe('first');
  });

  it('does not select a marker from empty space at the same horizontal position', () => {
    expect(findMarkerAtPoint({ x: 80, y: 60 }, markerPoints, 16)).toBeNull();
  });

  it('selects the closest marker when touch targets overlap', () => {
    expect(findMarkerAtPoint(
      { x: 90, y: 100 },
      [
        { id: 'first', x: 80, y: 100 },
        { id: 'second', x: 96, y: 100 },
      ],
      16,
    )).toBe('second');
  });
});

describe('findMarkerNearX', () => {
  const markerPoints = [
    { id: 'first', x: 80, y: 100 },
    { id: 'second', x: 140, y: 60 },
  ];

  it('finds markers near a scrubbed chart coordinate regardless of height', () => {
    expect(findMarkerNearX(86, markerPoints, 10)).toBe('first');
  });

  it('ignores markers outside the snap proximity', () => {
    expect(findMarkerNearX(91, markerPoints, 10)).toBeNull();
  });
});

describe('placeTooltip', () => {
  const container = { height: 150, width: 360 };
  const tooltip = { height: 96, width: 140 };
  const margin = 8;

  const positionTooltip = (anchor: { x: number; y: number }) => placeTooltip({
    anchor,
    container,
    markerClearance: 8,
    markerPoints: [{ id: 'selected', ...anchor }],
    margin,
    tooltip,
    tooltipGap: 12,
  });

  it('keeps the complete tooltip within every edge of the chart', () => {
    for (const x of [0, 8, 180, 352, 360]) {
      for (const y of [0, 8, 75, 142, 150]) {
        const position = positionTooltip({ x, y });
        expect(position.left).toBeGreaterThanOrEqual(margin);
        expect(position.top).toBeGreaterThanOrEqual(margin);
        expect(position.left + tooltip.width).toBeLessThanOrEqual(container.width - margin);
        expect(position.top + tooltip.height).toBeLessThanOrEqual(container.height - margin);
      }
    }
  });

  it('places the tooltip beside the selected dot when there is room', () => {
    const anchor = { x: 180, y: 75 };
    const position = positionTooltip(anchor);
    const isDotCovered = (
      anchor.x >= position.left
      && anchor.x <= position.left + tooltip.width
      && anchor.y >= position.top
      && anchor.y <= position.top + tooltip.height
    );

    expect(isDotCovered).toBe(false);
  });

  it('does not jump away from its preferred side for one nearby marker', () => {
    const position = placeTooltip({
      anchor: { x: 300, y: 150 },
      container: { height: 300, width: 600 },
      markerClearance: 8,
      markerPoints: [
        { id: 'selected', x: 300, y: 150 },
        { id: 'nearby', x: 310, y: 100 },
      ],
      margin,
      tooltip: { height: 70, width: 140 },
      tooltipGap: 12,
    });

    expect(position.top + 70).toBeLessThan(150);
  });

  it('chooses the side that covers fewer chart markers', () => {
    const anchor = { x: 180, y: 75 };
    const position = placeTooltip({
      anchor,
      container,
      markerClearance: 8,
      markerPoints: [
        { id: 'selected', ...anchor },
        { id: 'right-1', x: 220, y: 60 },
        { id: 'right-2', x: 250, y: 80 },
        { id: 'right-3', x: 280, y: 95 },
      ],
      margin,
      tooltip: { height: 80, width: 140 },
      tooltipGap: 12,
    });

    expect(position.left + 140).toBeLessThan(anchor.x);
  });
});
