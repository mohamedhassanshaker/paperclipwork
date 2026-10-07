import { type SelectHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "focus-ring h-control w-full rounded-control border border-border bg-surface px-2.5 text-14 font-normal text-fg",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
