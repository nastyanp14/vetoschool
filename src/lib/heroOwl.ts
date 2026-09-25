const REFERENCE_DURATION = 8;

type DirectionAnchor = {
  angle: number;
  time: number;
};

// The source video travels through these real poses in this order:
// down -> left -> up -> right -> back to centre.
const DIRECTION_ANCHORS: DirectionAnchor[] = [
  { angle: -Math.PI, time: 2.55 },
  { angle: -(3 * Math.PI) / 4, time: 3.65 },
  { angle: -Math.PI / 2, time: 4.5 },
  { angle: -Math.PI / 4, time: 5.35 },
  { angle: 0, time: 6.08 },
  { angle: Math.PI / 4, time: 7.8 },
  { angle: Math.PI / 2, time: 9.5 },
  { angle: (3 * Math.PI) / 4, time: 10.05 },
  { angle: Math.PI, time: 10.55 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function wrapTime(time: number, duration: number) {
  return ((time % duration) + duration) % duration;
}

export function shortestOwlTimeDelta(current: number, target: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return target - current;

  let delta = wrapTime(target - current, duration);
  if (delta > duration / 2) delta -= duration;
  return delta;
}

function directionTimeForAngle(angle: number) {
  const upperIndex = DIRECTION_ANCHORS.findIndex(anchor => angle <= anchor.angle);
  const right = DIRECTION_ANCHORS[upperIndex === -1 ? DIRECTION_ANCHORS.length - 1 : upperIndex];
  const left = DIRECTION_ANCHORS[Math.max(0, (upperIndex === -1 ? DIRECTION_ANCHORS.length - 1 : upperIndex) - 1)];

  if (left.angle === right.angle) return right.time;

  const progress = (angle - left.angle) / (right.angle - left.angle);
  return left.time + (right.time - left.time) * progress;
}

export function mapPointerToOwlTime(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  duration = REFERENCE_DURATION,
) {
  if (viewportWidth <= 0 || viewportHeight <= 0 || duration <= 0) return 0;

  const x = clamp((clientX / viewportWidth - 0.5) * 2, -1, 1);
  const y = clamp((clientY / viewportHeight - 0.5) * 2, -1, 1);
  const radius = clamp(Math.hypot(x, y), 0, 1);

  // A generous neutral zone keeps the owl looking straight ahead when the
  // pointer is around the central headline and buttons.
  const directionalStrength = clamp((radius - 0.08) / 0.32, 0, 1);
  if (directionalStrength === 0) return 0;

  const directionReferenceTime = directionTimeForAngle(Math.atan2(y, x));
  const scaledDirectionTime = wrapTime(directionReferenceTime, REFERENCE_DURATION)
    * (duration / REFERENCE_DURATION);
  const deltaFromCentre = shortestOwlTimeDelta(0, scaledDirectionTime, duration);

  return wrapTime(deltaFromCentre * directionalStrength, duration);
}
