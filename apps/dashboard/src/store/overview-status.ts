"use client";

import { create } from "zustand";

type OverviewStatusState = {
  generatedAt: number;
  setGeneratedAt: (generatedAt: number) => void;
};

export const useOverviewStatus = create<OverviewStatusState>()((set) => ({
  generatedAt: 0,
  setGeneratedAt: (generatedAt) => set({ generatedAt }),
}));
