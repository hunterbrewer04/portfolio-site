"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import {
  AppWindow,
  Bot,
  Box,
  Brain,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Database,
  Download,
  File,
  Film,
  Gauge,
  Globe,
  KeyRound,
  Laptop,
  Layers,
  List,
  Package,
  Pause,
  Play,
  Route,
  Scissors,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  type LucideProps,
} from "lucide-react";
import { getFlowDiagram } from "@/lib/flow-diagrams";
import { computeGeometry, resolveHops, type Hop, type Variant } from "@/lib/flow-diagrams/geometry";
import type { FlowDiagramDef, FlowIcon, FlowNode } from "@/lib/flow-diagrams/types";
import { useProjectAccent } from "@/components/work/project-accent";

const ICONS: Record<FlowIcon, ComponentType<LucideProps>> = {
  bot: Bot,
  terminal: Terminal,
  search: Search,
  globe: Globe,
  database: Database,
  server: Server,
  shield: ShieldCheck,
  file: File,
  film: Film,
  sparkles: Sparkles,
  box: Box,
  cloud: Cloud,
  route: Route,
  layers: Layers,
  package: Package,
  laptop: Laptop,
  brain: Brain,
  gauge: Gauge,
  scissors: Scissors,
  key: KeyRound,
  download: Download,
  upload: Upload,
  browser: AppWindow,
  list: List,
};

/** Container width below which the stacked phone layout is used. */
const NARROW_MAX = 560;
/** Seconds for a packet to cross a ~180-unit edge (scaled by edge length). */
const HOP_SECONDS = 0.9;
/** Pause on a completed step before advancing. */
const HOLD_MS = 1800;
/** Intro (nodes + edges drawing in) before the first packet launches. */
const INTRO_MS = 1100;
const EASE = [0.22, 1, 0.36, 1] as const;
const INSTANT = { duration: 0 } as const;

const noopSubscribe = () => () => {};

export function FlowDiagram({ id }: { id: string }) {
  const def = getFlowDiagram(id);
  // Throwing surfaces a typo'd id as a build failure instead of a silent gap.
  if (!def) throw new Error(`Unknown FlowDiagram id "${id}"`);
  return <FlowDiagramView def={def} />;
}

function FlowDiagramView({ def }: { def: FlowDiagramDef }) {
  const color = useProjectAccent();
  // useReducedMotion() is null on the server but real on the first client
  // render, so gate it on mount: hydration then matches the server HTML and
  // reduced motion takes effect one render later.
  const prefersReduced = useReducedMotion() ?? false;
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const reduce = hydrated && prefersReduced;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { amount: 0.35 });
  const seen = useInView(rootRef, { amount: 0.35, once: true });

  // Pick the layout from the container's own width (not the viewport), so the
  // diagram adapts wherever it's embedded.
  const [variant, setVariant] = useState<Variant>("wide");
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setVariant(entry.contentRect.width < NARROW_MAX ? "narrow" : "wide");
      setMeasured(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Both layouts are computed up front so bad narrow data fails the build
  // instead of crashing only on phones.
  const geos = useMemo(
    () => ({ wide: computeGeometry(def, "wide"), narrow: computeGeometry(def, "narrow") }),
    [def],
  );
  const geo = geos[variant];
  const hops = useMemo(() => resolveHops(def), [def]);

  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    if (!seen) return;
    const t = setTimeout(() => setIntroDone(true), reduce ? 0 : INTRO_MS);
    return () => clearTimeout(t);
  }, [seen, reduce]);

  const [step, setStep] = useState(0);
  // Index of the hop currently in flight; === hops[step].length while holding.
  const [hop, setHop] = useState(0);
  const [playing, setPlaying] = useState(true);
  const autoplay = playing && !reduce && inView && measured && introDone;

  const stepHops = hops[step];
  const stepPath = def.steps[step].path;
  // Paused / reduced motion: show the whole step at once. While playback is
  // merely waiting (intro, off-screen) keep the hop position so nothing flashes.
  const progress = playing && !reduce ? hop : stepHops.length;
  const litNodes = new Set(stepPath.slice(0, progress + 1));
  const litEdges = new Set(stepHops.slice(0, progress).map((h) => h.edgeId));
  const flying: Hop | undefined = autoplay ? stepHops[hop] : undefined;

  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const headRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const trailRef = useRef<SVGPathElement>(null);

  // Layout effect so the packet is placed before paint and never flashes at
  // its previous position.
  useLayoutEffect(() => {
    if (!autoplay) return;
    if (hop >= stepHops.length) {
      const t = setTimeout(() => {
        setStep((s) => (s + 1) % def.steps.length);
        setHop(0);
      }, HOLD_MS);
      return () => clearTimeout(t);
    }

    const { edgeId, reverse } = stepHops[hop];
    const pathEl = pathRefs.current[edgeId];
    const head = headRef.current;
    const halo = haloRef.current;
    const trail = trailRef.current;
    if (!pathEl || !head || !halo || !trail) return;

    const len = pathEl.getTotalLength();
    const seg = Math.min(60, len * 0.45);
    trail.setAttribute("d", pathEl.getAttribute("d") ?? "");

    const place = (t: number) => {
      const at = (reverse ? 1 - t : t) * len;
      const p = pathEl.getPointAtLength(at);
      for (const c of [head, halo]) {
        c.setAttribute("cx", String(p.x));
        c.setAttribute("cy", String(p.y));
      }
      // Comet tail: a dash covering the segment just behind the head.
      const start = reverse ? at : Math.max(0, at - seg);
      const span = reverse ? Math.min(seg, len - at) : at - start;
      trail.style.strokeDasharray = `${span} ${len + seg}`;
      trail.style.strokeDashoffset = String(-start);
    };
    place(0);

    const controls = animate(0, 1, {
      duration: HOP_SECONDS * Math.min(1.5, Math.max(0.7, len / 180)),
      ease: "easeInOut",
      onUpdate: place,
      onComplete: () => setHop((h) => h + 1),
    });
    return () => controls.stop();
  }, [autoplay, step, hop, stepHops, def.steps.length]);

  const goTo = (i: number) => {
    setStep((i + def.steps.length) % def.steps.length);
    setHop(0);
  };

  const nodeKinds = new Map(def.nodes.map((n) => [n.id, n]));
  const current = def.steps[step];
  const btn =
    "inline-flex h-11 w-11 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 sm:h-8 sm:w-8";

  return (
    <figure
      ref={rootRef}
      aria-label={`${def.title} diagram`}
      className="not-prose my-8 overflow-hidden rounded-lg border border-white/[0.06] bg-black/20"
    >
      {/* Header: title + transport controls */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] py-1.5 pr-1.5 pl-4 sm:py-2 sm:pr-2">
        <div className="min-w-0 flex-1">
          {def.kicker && (
            <p className="font-mono text-[10px] tracking-wider uppercase" style={{ color }}>
              {def.kicker}
            </p>
          )}
          <p className="text-sm leading-snug font-medium text-neutral-200">{def.title}</p>
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={() => goTo(step - 1)} aria-label="Previous step" className={btn}>
            <ChevronLeft size={16} />
          </button>
          {!reduce && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause animation" : "Play animation"}
              className={btn}
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
          )}
          <button type="button" onClick={() => goTo(step + 1)} aria-label="Next step" className={btn}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Step progress segments */}
      <div className="flex gap-1 px-4 pt-3">
        {def.steps.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Step ${i + 1}: ${s.title}`}
            aria-current={i === step ? "step" : undefined}
            className="group flex h-6 flex-1 items-center focus-visible:outline-none"
          >
            <span className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.08] group-focus-visible:ring-2 group-focus-visible:ring-indigo-500/60">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: color }}
                initial={false}
                animate={{
                  width:
                    i < step
                      ? "100%"
                      : i === step
                        ? `${stepHops.length === 0 ? 100 : Math.round((progress / stepHops.length) * 100)}%`
                        : "0%",
                  opacity: i <= step ? (i === step ? 1 : 0.45) : 0,
                }}
                transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
              />
            </span>
          </button>
        ))}
      </div>

      {/* Diagram canvas */}
      <div className="px-2 pt-2 pb-1 sm:px-4">
        <motion.svg
          viewBox={`0 0 ${geo.width} ${geo.height}`}
          className="block h-auto w-full"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: measured ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          overflow="visible"
        >
          <defs>
            <pattern id={`dots-${uid}`} width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.07)" />
            </pattern>
            <marker
              id={`arrow-${uid}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M1 1.5 L9 5 L1 8.5" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker
              id={`arrow-lit-${uid}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M1 1.5 L9 5 L1 8.5" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          <rect width={geo.width} height={geo.height} fill={`url(#dots-${uid})`} />

          {/* Zones */}
          {geo.zones.map((z) => (
            <motion.g
              key={z.label}
              initial={{ opacity: 0 }}
              animate={seen ? { opacity: 1 } : undefined}
              transition={reduce ? INSTANT : { duration: 0.6 }}
            >
              <rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                rx="10"
                fill="rgba(255,255,255,0.015)"
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4 4"
              />
              <text
                x={z.x + 10}
                y={z.y + 12}
                fontSize="9"
                letterSpacing="0.08em"
                className="fill-neutral-500 font-mono uppercase"
              >
                {z.label}
              </text>
            </motion.g>
          ))}

          {/* Edges */}
          {def.edges.map((edge, i) => {
            const g = geo.edges[edge.id];
            const lit = litEdges.has(edge.id);
            // Arrowheads show the edge's request direction; a step may send the
            // packet back along it (a response), which is intentional.
            const markerEnd = `url(#${lit ? "arrow-lit" : "arrow"}-${uid})`;
            return (
              <g key={edge.id}>
                <motion.path
                  ref={(el: SVGPathElement | null) => {
                    pathRefs.current[edge.id] = el;
                  }}
                  d={g.d}
                  fill="none"
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth="1.25"
                  markerEnd={markerEnd}
                  markerStart={edge.bidirectional ? markerEnd : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={seen ? { pathLength: 1, opacity: 1 } : undefined}
                  transition={reduce ? INSTANT : { duration: 0.7, delay: 0.25 + i * 0.05, ease: EASE }}
                />
                <motion.path
                  d={g.d}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  initial={false}
                  animate={{ opacity: lit ? 0.75 : 0 }}
                  transition={{ duration: reduce ? 0 : 0.3 }}
                />
                {geo.edgeLabels && edge.label && g.labelW > 0 && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={seen ? { opacity: 1 } : undefined}
                    transition={reduce ? INSTANT : { duration: 0.5, delay: 0.6 + i * 0.05 }}
                  >
                    <rect
                      x={g.mid.x - g.labelW / 2}
                      y={g.mid.y - 8}
                      width={g.labelW}
                      height="16"
                      rx="4"
                      fill="#0b0b0c"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <text
                      x={g.mid.x}
                      y={g.mid.y + 3}
                      fontSize="9.5"
                      textAnchor="middle"
                      className={lit ? "font-mono" : "fill-neutral-500 font-mono"}
                      style={lit ? { fill: color } : undefined}
                    >
                      {edge.label}
                    </text>
                  </motion.g>
                )}
              </g>
            );
          })}

          {/* Packet (comet trail + glowing head); always mounted so refs exist. */}
          <g style={{ opacity: flying ? 1 : 0, transition: "opacity 150ms" }}>
            <path ref={trailRef} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
            <circle ref={haloRef} r="7" fill={color} opacity="0.55" filter={`url(#glow-${uid})`} />
            <circle ref={headRef} r="3.5" fill="#fff" />
          </g>

          {/* Nodes */}
          {def.nodes.map((node, i) => (
            <DiagramNode
              key={node.id}
              node={node}
              box={geo.boxes[node.id]}
              lit={litNodes.has(node.id)}
              color={color}
              seen={seen}
              reduce={reduce}
              uid={uid}
              delay={i * 0.06}
              narrow={variant === "narrow"}
            />
          ))}
        </motion.svg>
      </div>

      {/* Caption for the current step */}
      <div className="min-h-[6.5rem] border-t border-white/[0.06] px-4 py-3 sm:min-h-[5.25rem] sm:px-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={reduce ? INSTANT : { duration: 0.25, ease: EASE }}
          >
            <p className="flex items-baseline gap-2 text-sm font-medium text-neutral-200">
              <span className="font-mono text-[11px]" style={{ color }}>
                {String(step + 1).padStart(2, "0")}/{String(def.steps.length).padStart(2, "0")}
              </span>
              {current.title}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{current.caption}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Full walkthrough for assistive tech — the SVG itself is decorative. */}
      <ol className="sr-only">
        {def.steps.map((s) => (
          <li key={s.title}>
            {s.title}: {s.caption} (
            {s.path.map((id) => nodeKinds.get(id)?.label ?? id).join(" → ")})
          </li>
        ))}
      </ol>
    </figure>
  );
}

interface DiagramNodeProps {
  node: FlowNode;
  box: { x: number; y: number; w: number; h: number; cx: number; cy: number };
  lit: boolean;
  color: string;
  seen: boolean;
  reduce: boolean;
  uid: string;
  delay: number;
  narrow: boolean;
}

function DiagramNode({ node, box, lit, color, seen, reduce, uid, delay, narrow }: DiagramNodeProps) {
  const Icon = node.icon ? ICONS[node.icon] : undefined;
  const kind = node.kind ?? "service";
  const rx = kind === "client" ? box.h / 2 : kind === "store" ? 6 : 9;
  const iconSize = narrow ? 13 : 14;
  const textX = Icon ? box.x + 12 + iconSize + 8 : box.cx;
  const anchor = Icon ? "start" : "middle";
  const labelY = node.sub ? box.cy - 2 : box.cy + 4;

  return (
    <motion.g
      initial={{ opacity: 0, y: 8 }}
      animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={reduce ? INSTANT : { duration: 0.5, delay, ease: EASE }}
    >
      {/* Glow behind lit nodes */}
      <motion.rect
        x={box.x - 2}
        y={box.y - 2}
        width={box.w + 4}
        height={box.h + 4}
        rx={rx + 2}
        fill={color}
        initial={false}
        animate={{ opacity: lit ? 0.16 : 0 }}
        transition={{ duration: reduce ? 0 : 0.35 }}
        filter={`url(#glow-${uid})`}
      />
      <motion.rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={rx}
        strokeWidth="1"
        strokeDasharray={kind === "external" ? "3 3" : undefined}
        initial={false}
        animate={{
          fill: lit ? `${color}1F` : "#111113",
          stroke: lit ? `${color}B3` : "rgba(255,255,255,0.12)",
        }}
        transition={{ duration: reduce ? 0 : 0.35 }}
      />
      {Icon && (
        <Icon
          x={box.x + 12}
          y={box.cy - iconSize / 2}
          width={iconSize}
          height={iconSize}
          strokeWidth={1.75}
          color={lit ? color : "#737373"}
        />
      )}
      <text
        x={textX}
        y={labelY}
        textAnchor={anchor}
        fontSize={narrow ? 11.5 : 12.5}
        fontWeight={500}
        className="fill-neutral-200"
      >
        {node.label}
      </text>
      {node.sub && (
        <text
          x={textX}
          y={box.cy + 12}
          textAnchor={anchor}
          fontSize={narrow ? 9 : 9.5}
          className="fill-neutral-500 font-mono"
        >
          {node.sub}
        </text>
      )}
    </motion.g>
  );
}
