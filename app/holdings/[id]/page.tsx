import { CATALOG } from "@/lib/allocation/instruments";
import { HoldingView } from "@/components/holding-view";

export function generateStaticParams() {
  return CATALOG.map((item) => ({ id: item.id }));
}

export const dynamicParams = false;

export default async function HoldingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HoldingView id={id} />;
}
