/**
 * Tuning constants for the WebGL star field. Every value is a starting point;
 * final numbers are locked during verification (spec D12).
 *
 * Units: world units unless the name says px; angles in degrees; rates per second.
 */
export const STAR_FIELD = {
  // ~1/3 of a uniform far-plane box is on screen at once, so this is the old
  // canvas's 8000 divided by 3.
  densityDivisor: 2700, // stars = clamp(round(w*h/densityDivisor), minStars, maxStars)
  minStars: 300,
  maxStars: 5000,
  fov: 60, // degrees, vertical
  zNear: 20, // world units; depth range stars occupy
  zFar: 200,
  zRef: 60, // depth at which sizePx renders 1:1
  boxMargin: 1.2, // x/y box = frustum extent at zFar * boxMargin
  sizeMinPx: 0.5, // old canvas: 0.5..2px
  sizeMaxPx: 2.0,
  pointSizeMinPx: 0.6, // clamp after perspective scaling, before DPR
  pointSizeMaxPx: 6,
  driftMin: 0.25, // world units/s downward; old 3..21 px/s at zRef on a 900px viewport
  driftMax: 1.6,
  alphaBaseMin: 0.35,
  alphaBaseMax: 0.75,
  twinkleAmp: 0.25,
  twinkleRate: 0.8, // rad/s, times per-star aRate in [0.6, 1.4]
  alphaMin: 0.2, // old canvas clamp
  alphaMax: 0.9,
  dprCap: 1.5,
  pushDistance: 40, // world units per route-depth step
  pushDuration: 0.8, // seconds
  slideDistance: 12, // world units per same-depth hop, sign from navOrder
  parallaxStrength: 1.5, // world units at full pointer deflection; camera follows pointer
  scrollFactor: 0.01, // world units per CSS px scrolled; camera moves down with scroll
  lerpDamping: 6, // k = 1 - exp(-lerpDamping * dt)
  maxFrameDelta: 0.05, // seconds; clamp dt after a hidden tab
} as const;

/** 1 - (1 - t)^3, with t clamped to [0, 1]. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/** Non-empty path segment count: "/" → 0, "/work" → 1, "/work/x" → 2. */
export function routeDepth(pathname: string): number {
  return pathname.split("/").filter(Boolean).length;
}

/** Left-to-right nav position: "/" → 0, "/work*" → 1, "/blog*" → 2, else 3. */
export function navOrder(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname.startsWith("/work")) return 1;
  if (pathname.startsWith("/blog")) return 2;
  return 3;
}
