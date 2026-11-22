import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/server/auth";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/plan");
  return <AuthForm mode="register" />;
}
