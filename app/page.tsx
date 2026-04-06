import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { TabContainer } from "@/components/tabs/TabContainer";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col h-svh max-h-svh overflow-hidden">
      <Header user={session.user} />
      <main className="flex-1 overflow-hidden">
        <TabContainer />
      </main>
    </div>
  );
}
