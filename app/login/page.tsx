import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/server/auth";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
