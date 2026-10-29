import { FadeRise } from "@/components/motion/fade-rise";

/** Remounts on every navigation, so each page arrives with the same short fade and rise. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <FadeRise>{children}</FadeRise>;
}
