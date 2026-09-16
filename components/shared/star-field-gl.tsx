"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  BufferAttribute,
  BufferGeometry,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { STAR_FIELD, easeOutCubic, navOrder, routeDepth } from "@/lib/star-field";

// Half-height of the star box: frustum extent at zFar, padded by boxMargin.
const HALF_H =
  STAR_FIELD.zFar * Math.tan((STAR_FIELD.fov * Math.PI) / 360) * STAR_FIELD.boxMargin;

// position.z is stored as a positive depth; the shader negates it into view space.
const VERTEX_SHADER = `
attribute vec4 aParams; // sizePx, drift (world units/s), twinkle phase, alpha base
attribute float aRate;
uniform float uTime;
uniform vec3 uOffset;
uniform vec2 uHalf;
uniform float uZNear;
uniform float uZRange;
uniform float uZRef;
uniform float uDpr;
uniform float uSizeMin;
uniform float uSizeMax;
uniform float uAlphaMin;
uniform float uAlphaMax;
uniform float uTwinkleAmp;
uniform float uTwinkleRate;
varying float vAlpha;

void main() {
  // mod(x, y) is x - y * floor(x / y), so negative inputs wrap into range too.
  float x = mod(position.x - uOffset.x + uHalf.x, 2.0 * uHalf.x) - uHalf.x;
  float y = mod(position.y - uTime * aParams.y - uOffset.y + uHalf.y, 2.0 * uHalf.y) - uHalf.y;
  float d = uZNear + mod(position.z - uZNear - uOffset.z, uZRange);
  vec4 mv = modelViewMatrix * vec4(x, y, -d, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aParams.x * (uZRef / d), uSizeMin, uSizeMax) * uDpr;
  vAlpha = clamp(aParams.w + sin(uTime * uTwinkleRate * aRate + aParams.z) * uTwinkleAmp, uAlphaMin, uAlphaMax);
}
`;

const FRAGMENT_SHADER = `
varying float vAlpha;

void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.35, r) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
}
`;

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function starCount(w: number, h: number): number {
  const { densityDivisor, minStars, maxStars } = STAR_FIELD;
  return Math.min(maxStars, Math.max(minStars, Math.round((w * h) / densityDivisor)));
}

function buildGeometry(count: number, halfW: number, halfH: number): BufferGeometry {
  const { zNear, zFar, sizeMinPx, sizeMaxPx, driftMin, driftMax, alphaBaseMin, alphaBaseMax } =
    STAR_FIELD;
  const position = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const rate = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    position[i * 3] = rand(-halfW, halfW);
    position[i * 3 + 1] = rand(-halfH, halfH);
    position[i * 3 + 2] = rand(zNear, zFar);
    params[i * 4] = rand(sizeMinPx, sizeMaxPx);
    params[i * 4 + 1] = rand(driftMin, driftMax);
    params[i * 4 + 2] = Math.random() * Math.PI * 2;
    params[i * 4 + 3] = rand(alphaBaseMin, alphaBaseMax);
    rate[i] = rand(0.6, 1.4);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("aParams", new BufferAttribute(params, 4));
  geometry.setAttribute("aRate", new BufferAttribute(rate, 1));
  return geometry;
}

function createGl(canvas: HTMLCanvasElement) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio, STAR_FIELD.dprCap);

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);

  const camera = new PerspectiveCamera(STAR_FIELD.fov, w / h, 1, STAR_FIELD.zFar + 10);
  const halfW = HALF_H * camera.aspect;

  const uniforms = {
    uTime: { value: 0 },
    uOffset: { value: new Vector3() },
    uHalf: { value: new Vector2(halfW, HALF_H) },
    uZNear: { value: STAR_FIELD.zNear },
    uZRange: { value: STAR_FIELD.zFar - STAR_FIELD.zNear },
    uZRef: { value: STAR_FIELD.zRef },
    uDpr: { value: dpr },
    uSizeMin: { value: STAR_FIELD.pointSizeMinPx },
    uSizeMax: { value: STAR_FIELD.pointSizeMaxPx },
    uAlphaMin: { value: STAR_FIELD.alphaMin },
    uAlphaMax: { value: STAR_FIELD.alphaMax },
    uTwinkleAmp: { value: STAR_FIELD.twinkleAmp },
    uTwinkleRate: { value: STAR_FIELD.twinkleRate },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const points = new Points(buildGeometry(starCount(w, h), halfW, HALF_H), material);
  points.frustumCulled = false;

  const scene = new Scene();
  scene.add(points);

  return {
    renderer,
    scene,
    camera,
    points,
    uniforms,
    dispose() {
      points.geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}

export function StarFieldGL({
  reducedMotion,
  onFail,
}: {
  reducedMotion: boolean;
  onFail: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read once by the setup effect, which must run on mount only.
  const mountProps = useRef({ reducedMotion, onFail });
  // Installed by the setup effect; stays null under reduced motion.
  const navigateRef = useRef<((pathname: string) => void) | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const props = mountProps.current;
    const {
      pushDistance,
      pushDuration,
      slideDistance,
      parallaxStrength,
      scrollFactor,
      lerpDamping,
      maxFrameDelta,
      dprCap,
    } = STAR_FIELD;

    let gl: ReturnType<typeof createGl> | undefined;
    try {
      gl = createGl(canvas);
      gl.renderer.render(gl.scene, gl.camera);
    } catch {
      gl?.dispose();
      props.onFail();
      return;
    }
    const { renderer, scene, camera, points, uniforms, dispose: disposeGl } = gl;

    const navOffset = new Vector3();
    const navTarget = new Vector3();
    const tweenStart = new Vector3();
    let tweenT0 = 0;
    const pointerTarget = new Vector3();
    const pointerOffset = new Vector3();
    const scrollTarget = new Vector3();
    const scrollOffset = new Vector3();
    let prevPathname: string | null = null;

    let rafId = 0;
    let last = 0;
    let running = false;
    let lostCount = 0;
    let disposed = false;
    let resizeTimer = 0;

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, maxFrameDelta);
      last = now;
      uniforms.uTime.value += dt;
      // now is ms, pushDuration is seconds
      navOffset
        .copy(tweenStart)
        .lerp(navTarget, easeOutCubic((now - tweenT0) / (pushDuration * 1000)));
      const k = 1 - Math.exp(-lerpDamping * dt);
      pointerOffset.lerp(pointerTarget, k);
      scrollOffset.lerp(scrollTarget, k);
      uniforms.uOffset.value.copy(navOffset).add(pointerOffset).add(scrollOffset);
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(rafId);
    }

    function applyResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, dprCap);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const halfW = HALF_H * camera.aspect;
      const old = points.geometry;
      points.geometry = buildGeometry(starCount(w, h), halfW, HALF_H);
      old.dispose();
      uniforms.uHalf.value.set(halfW, HALF_H);
      uniforms.uDpr.value = dpr;
      if (props.reducedMotion) renderer.render(scene, camera);
    }

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(applyResize, 150);
    };

    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      // clientY grows downward; flip so the camera follows the pointer
      pointerTarget.set(nx * parallaxStrength, -ny * parallaxStrength, 0);
    };

    const onScroll = () => {
      // negative y moves the camera down the page with the scroll
      scrollTarget.set(0, -window.scrollY * scrollFactor, 0);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      stop();
      lostCount++;
      if (lostCount >= 2) {
        teardown();
        props.onFail();
      }
    };

    const teardown = () => {
      if (disposed) return;
      disposed = true;
      stop();
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", start);
      navigateRef.current = null;
      disposeGl();
    };

    window.addEventListener("resize", onResize);

    if (!props.reducedMotion) {
      navigateRef.current = (next) => {
        const prev = prevPathname;
        prevPathname = next;
        if (prev === null || prev === next) return;
        const dd = routeDepth(next) - routeDepth(prev);
        const before = navTarget.clone();
        if (dd > 0) navTarget.z += pushDistance;
        else if (dd < 0) navTarget.z -= pushDistance;
        else navTarget.x += slideDistance * Math.sign(navOrder(next) - navOrder(prev));
        if (navTarget.equals(before)) return;
        tweenStart.copy(navOffset);
        tweenT0 = performance.now();
      };
      if (window.matchMedia("(pointer: fine)").matches) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      canvas.addEventListener("webglcontextlost", onContextLost);
      canvas.addEventListener("webglcontextrestored", start);
      start();
    }

    return teardown;
  }, []);

  useEffect(() => {
    navigateRef.current?.(pathname);
  }, [pathname]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
