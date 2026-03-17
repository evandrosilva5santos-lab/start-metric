import { use } from "react";
import type { Metadata } from "next";
import AdminAuthClient from "./AdminAuthClient";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams: Promise<SearchParams>;
};

function getParam(searchParams: SearchParams, key: string): string | null {
  const value = searchParams[key];
  return typeof value === "string" ? value : null;
}

export const metadata: Metadata = {
  title: "Admin Auth | Start Metric",
  description: "Acesso restrito ao backoffice administrativo.",
};

export default function AdminAuthPage({ searchParams }: Props) {
  const resolvedParams = use(searchParams);

  return (
    <AdminAuthClient
      nextParam={getParam(resolvedParams, "next")}
      errorParam={getParam(resolvedParams, "error")}
    />
  );
}
