import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandProps = { className?: string; alt?: string };

export function BrandWordmark({ className, alt = "" }: BrandProps) {
  return (
    <>
      <Image
        src="/brand/logo-light.png"
        alt={alt}
        width={900}
        height={206}
        priority
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/brand/logo-dark.png"
        alt={alt}
        width={900}
        height={211}
        priority
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}

export function BrandSymbol({ className, alt = "" }: BrandProps) {
  return <Image src="/brand/mark.png" alt={alt} width={292} height={256} priority className={cn("w-auto", className)} />;
}
