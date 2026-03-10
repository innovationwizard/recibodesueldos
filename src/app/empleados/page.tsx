import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmployeesClient } from "./EmployeesClient";

export default async function EmpleadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <EmployeesClient user={user} />
    </div>
  );
}
