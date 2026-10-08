import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "destructive"
  | "destructive-ghost";

export type ButtonSize = "default" | "sm";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-0 bg-primary-strong text-on-primary hover:bg-primary-strong-hover",
  secondary:
    "border border-border bg-surface text-fg hover:bg-border-subtle",
  destructive: "border-0 bg-danger text-on-primary hover:bg-danger-hover",
  "destructive-ghost":
    "border border-danger-border bg-surface text-danger hover:bg-danger-subtle",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-control px-4 text-14",
  sm: "h-control-sm px-3 text-13",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "default", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "focus-ring inline-flex items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
