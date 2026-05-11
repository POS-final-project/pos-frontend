import { ProdukDetail } from "@/components/features/produk/produk-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProdukDetail productId={id} backHref="/admin/produk" canEdit />;
}
