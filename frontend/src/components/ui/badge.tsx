import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-cat-yellow text-cat-black shadow',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-red-500 text-white shadow',
        outline: 'text-foreground',
        available: 'border-transparent bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
        rented: 'border-transparent bg-blue-500/15 text-blue-500 border-blue-500/30',
        active: 'border-transparent bg-purple-500/15 text-purple-500 border-purple-500/30',
        idle: 'border-transparent bg-amber-500/15 text-amber-500 border-amber-500/30',
        overdue: 'border-transparent bg-red-500/15 text-red-500 border-red-500/30',
        maintenance: 'border-transparent bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
