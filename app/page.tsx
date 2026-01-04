import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to videos gallery as default page
  redirect("/videos");
}
