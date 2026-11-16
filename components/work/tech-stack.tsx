import { cn } from "@/lib/utils";

interface TechStackProps {
  tags: string[];
  /** 6-digit hex accent */
  color: string;
  /** Show at most this many, then a "+N" chip. Omit to show all. */
  max?: number;
  size?: "sm" | "md";
  /** Seconds before the first chip settles in; omit for no entrance animation. */
  animateFrom?: number;
  className?: string;
}

/** The project's tech stack as a row of small mono chips tinted with its accent. */
export function TechStack({ tags, color, max, size = "md", animateFrom, className }: TechStackProps) {
  const shown = max != null ? tags.slice(0, max) : tags;
  const hidden = tags.length - shown.length;
  const chip = cn(
    "inline-flex items-center rounded-full border font-mono",
    size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
  );

  return (
    <ul aria-label="Tech stack" className={cn("flex flex-wrap gap-2", className)}>
      {shown.map((tag, i) => (
        <li
          key={tag}
          className={cn(chip, animateFrom != null && "chip-in")}
          style={{
            borderColor: `${color}33`,
            backgroundColor: `${color}0d`,
            color,
            animationDelay: animateFrom != null ? `${animateFrom + i * 0.04}s` : undefined,
          }}
        >
          {tag}
        </li>
      ))}
      {hidden > 0 && (
        <li className={cn(chip, "border-white/10 text-neutral-500")}>+{hidden}</li>
      )}
    </ul>
  );
}
