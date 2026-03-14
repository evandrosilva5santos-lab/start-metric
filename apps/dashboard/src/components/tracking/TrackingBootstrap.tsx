"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/tracking/client";

export function TrackingBootstrap() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/auth")) return;

    const search = searchParams.toString();
    const fullPath = search ? `${pathname}?${search}` : pathname;
    if (lastPathRef.current === fullPath) return;
    lastPathRef.current = fullPath;

    void trackEvent({
      eventName: "page_view",
      payload: {
        path: pathname,
      },
    });
  }, [pathname, searchParams]);

  return null;
}
