import { Starfield } from "@/components/shared/starfield";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Starfield />
      {children}
    </>
  );
}
