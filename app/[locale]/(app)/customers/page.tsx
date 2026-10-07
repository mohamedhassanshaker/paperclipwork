import { customerRepository } from "@/lib/repository/customer";
import { CustomersScreen } from "./CustomersScreen";

const PAGE_SIZE = 100;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { items, total, totalAll } = await customerRepository.list({
    q,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  return (
    <section className="flex max-w-content flex-col gap-5 p-page">
      <CustomersScreen
        initialItems={items}
        total={total}
        totalAll={totalAll}
        initialQuery={q ?? ""}
      />
    </section>
  );
}
