import { createBrowserClient } from "@supabase/ssr";
let client:ReturnType<typeof createBrowserClient>|undefined;
export function createClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error("Supabase não configurado");
 client??=createBrowserClient(url,key);
 return client;
}
