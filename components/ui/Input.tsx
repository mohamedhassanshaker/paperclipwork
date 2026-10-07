import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "focus-ring h-control w-full rounded-control border border-border bg-surface px-3 text-14 font-normal text-fg placeholder:text-fg-muted",
        className,
      )}
      {...props}
    />
  );
});
