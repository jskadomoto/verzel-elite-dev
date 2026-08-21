import { AreaShell } from "@/components/area-shell";
import { MyOrders } from "@/components/my-orders";
import { MyTickets } from "@/components/my-tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function Page() {
  return (
    <AreaShell>
      <MyTickets />
      <MyOrders />
    </AreaShell>
  );
}
