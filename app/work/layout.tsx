import { Starfield } from "@/components/shared/starfield";

export default function WorkLayout({
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
