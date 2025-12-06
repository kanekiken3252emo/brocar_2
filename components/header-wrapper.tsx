import { Header } from "./header";
import { getUser } from "@/lib/auth";

export async function HeaderWrapper() {
  const user = await getUser();

  return <Header user={user} />;
}

