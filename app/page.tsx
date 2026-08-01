import { PranchasDashboard } from "@/components/pranchas/pranchas-dashboard";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";

export const dynamic="force-dynamic";

export default async function Home() {
  const session=(await cookies()).get("plataforma_session")?.value;
  if(session!=="authenticated")redirect("/login");
  const email=process.env.APP_LOGIN_EMAIL||"admin@logistica.com";
  return <PranchasDashboard user={{email,name:"Administrador"}} />;
}
