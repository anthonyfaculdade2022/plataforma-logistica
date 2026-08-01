import {NextResponse} from "next/server";

export async function POST(request:Request){
 const {email,password}=await request.json() as {email?:string;password?:string};
 const expectedEmail=process.env.APP_LOGIN_EMAIL||"admin@logistica.com";
 const expectedPassword=process.env.APP_LOGIN_PASSWORD||"admin123";
 if(email?.trim().toLowerCase()!==expectedEmail.toLowerCase()||password!==expectedPassword)return NextResponse.json({message:"Email ou senha inválidos."},{status:401});
 const response=NextResponse.json({ok:true});
 response.cookies.set("plataforma_session","authenticated",{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});
 return response;
}
