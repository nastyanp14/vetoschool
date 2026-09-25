import { describe, expect, it } from 'vitest';
import { mapPointerToOwlTime, shortestOwlTimeDelta } from './heroOwl';

describe('hero owl pointer mapping', () => {
  it('maps the viewport centre to the straight-ahead frame', () => {
    expect(mapPointerToOwlTime(500, 400, 1000, 800)).toBe(0);
  });

  it('maps each cardinal edge to the measured pose in the video', () => {
    expect(mapPointerToOwlTime(0, 400, 1000, 800)).toBeCloseTo(2.55, 2);
    expect(mapPointerToOwlTime(1000, 400, 1000, 800)).toBeCloseTo(6.08, 2);
    expect(mapPointerToOwlTime(500, 0, 1000, 800)).toBeCloseTo(4.5, 2);
    expect(mapPointerToOwlTime(500, 800, 1000, 800)).toBeCloseTo(1.5, 2);
  });

  it('uses intermediate video poses for diagonal pointer positions', () => {
    expect(mapPointerToOwlTime(0, 0, 1000, 800)).toBeCloseTo(3.65, 2);
    expect(mapPointerToOwlTime(1000, 0, 1000, 800)).toBeCloseTo(5.35, 2);
    expect(mapPointerToOwlTime(0, 800, 1000, 800)).toBeCloseTo(2.05, 2);
    expect(mapPointerToOwlTime(1000, 800, 1000, 800)).toBeCloseTo(7.8, 2);
  });

  it('takes the short route across the end of the clip', () => {
    expect(shortestOwlTimeDelta(0.1, 7.8, 8)).toBeCloseTo(-0.3, 4);
    expect(shortestOwlTimeDelta(7.8, 0.1, 8)).toBeCloseTo(0.3, 4);
  });
});
