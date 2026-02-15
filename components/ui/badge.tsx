import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-orange-500 text-white",
        secondary:
          "border-neutral-700 bg-neutral-800 text-neutral-300",
        destructive:
          "border-red-500/30 bg-red-500/20 text-red-400",
        success:
          "border-green-500/30 bg-green-500/20 text-green-400",
        warning:
          "border-yellow-500/30 bg-yellow-500/20 text-yellow-400",
        outline: 
          "border-neutral-700 text-neutral-300 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
