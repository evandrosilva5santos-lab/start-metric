import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-button border border-transparent bg-clip-padding font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        roi: "bg-primary text-primary-foreground hover:bg-primary-hover",
        glow: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        secondary: "border-border-strong bg-secondary text-secondary-foreground hover:bg-muted",
        outline: "border-border-strong bg-background text-foreground hover:bg-muted",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        danger: "bg-danger-tint text-danger hover:bg-danger-tint/80",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "h-auto bg-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "min-h-11 px-2 text-xs lg:min-h-6",
        sm: "min-h-11 px-2.5 text-[13px] lg:min-h-7",
        default: "min-h-11 px-3 text-[13px] lg:min-h-8",
        lg: "min-h-11 px-4 text-sm lg:min-h-10",
        icon: "size-11 p-0 lg:size-8",
        "icon-sm": "size-11 p-0 lg:size-7",
        "icon-lg": "size-11 p-0 lg:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild && !loading ? Slot : "button";

    return (
      <Comp
        ref={ref}
        data-slot="button"
        data-variant={variant ?? "default"}
        data-size={size ?? "default"}
        disabled={Comp === "button" ? disabled || loading : undefined}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>Carregando…</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
