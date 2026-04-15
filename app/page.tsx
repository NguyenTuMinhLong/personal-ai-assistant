// app/page.tsx
import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

export default async function HomePage() {
  const user = await currentUser();

  // Nếu đã login → chuyển thẳng sang Documents
  if (user) {
    redirect("/documents");
  }

  // Nếu chưa login → chuyển sang trang sign-in
  redirect("/sign-in");
}