"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/client-actions";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <Button 
      variant="destructive" 
      onClick={handleLogout}
      className="w-full gap-2"
    >
      <LogOut className="h-4 w-4" />
      Выйти из аккаунта
    </Button>
  );
}
