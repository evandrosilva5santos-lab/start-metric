"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const Tabs = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Root>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>>(
  ({ className, orientation = "horizontal", ...props }, ref) => (
    <TabsPrimitive.Root ref={ref} data-slot="tabs" orientation={orientation} className={cn("flex w-full gap-2 data-[orientation=horizontal]:flex-col", className)} {...props} />
  ),
);
Tabs.displayName = TabsPrimitive.Root.displayName;

const tabsListVariants = cva("inline-flex w-fit items-center justify-center rounded-lg p-1 text-muted-foreground", {
  variants: {
    variant: {
      default: "bg-muted",
      line: "gap-1 rounded-none bg-transparent",
    },
  },
  defaultVariants: { variant: "default" },
});

interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>, VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant, ...props }, ref) => <TabsPrimitive.List ref={ref} data-slot="tabs-list" data-variant={variant ?? "default"} className={cn(tabsListVariants({ variant }), className)} {...props} />,
);
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm lg:min-h-8",
        className,
      )}
      {...props}
    />
  ),
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} data-slot="tabs-content" className={cn("mt-3 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...props} />,
);
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
