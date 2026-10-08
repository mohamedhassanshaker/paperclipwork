import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "active" | "inactive";

const toneClasses: Record<BadgeTone, string> = {
  active: "border-0 bg-primary-strong text-on-primary",
  inactive: "border border-border text-fg-secondary",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone;
}

export function Badge({ tone, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-pill items-center whitespace-nowrap rounded-pill px-2 text-12 font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
