import { use } from "react";
import AuthPageClient from "./AuthPageClient";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams: Promise<SearchParams>;
};

function getParam(searchParams: SearchParams, key: string): string | null {
  const value = searchParams[key];
  return typeof value === "string" ? value : null;
}

export default function AuthPage({ searchParams }: Props) {
  const resolvedParams = use(searchParams);

  return (
    <AuthPageClient
      nextParam={getParam(resolvedParams, "next")}
      errorParam={getParam(resolvedParams, "error")}
      messageParam={getParam(resolvedParams, "message")}
    />
  );
}
