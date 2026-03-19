import { redirect } from "next/navigation";

export default function LegacyInboxRoute() {
  redirect("/communications");
}
