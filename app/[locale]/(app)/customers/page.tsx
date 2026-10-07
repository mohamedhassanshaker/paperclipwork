import { customerRepository } from "@/lib/repository/customer";
import { CustomersScreen } from "./CustomersScreen";

const PAGE_SIZE = 25;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total, totalAll } = await customerRepository.list({
    q,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="flex max-w-content flex-col gap-5 p-page">
      <CustomersScreen
        initialItems={items}
        total={total}
        totalAll={totalAll}
        initialQuery={q ?? ""}
        page={page}
        totalPages={totalPages}
      />
    </section>
  );
}
