"use client";

import { useEffect } from "react";
import { useOverviewStatus } from "@/store/overview-status";

export function OverviewStamp({ generatedAt }: { generatedAt: string }) {
  const setGeneratedAt = useOverviewStatus((s) => s.setGeneratedAt);

  useEffect(() => {
    const time = Date.parse(generatedAt);
    if (Number.isFinite(time)) setGeneratedAt(time);
  }, [generatedAt, setGeneratedAt]);

  return null;
}
