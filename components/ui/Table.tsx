import {
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement> & { children: React.ReactNode }) {
  return (
    <div className={cn("overflow-x-auto rounded-card border border-border", className)}>
      <table className="w-full min-w-[680px] border-collapse text-14" {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...props} />;
}

export function TableRow({
  className,
  header = false,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { header?: boolean }) {
  return (
    <tr
      className={cn(
        header
          ? "border-b border-border"
          : "border-b border-border-subtle last:border-0 hover:bg-bg",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  justify = "start",
  ...props
}: Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> & {
  justify?: "start" | "end";
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-13 font-medium text-fg-muted",
        justify === "start" ? "text-start" : "text-end",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3", className)} {...props} />;
}
