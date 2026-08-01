import {NextResponse,type NextRequest} from "next/server";

export function middleware(request:NextRequest){
 const path=request.nextUrl.pathname,isLogin=path==="/login",authenticated=request.cookies.get("plataforma_session")?.value==="authenticated";
 if(!authenticated&&!isLogin)return NextResponse.redirect(new URL("/login",request.url));
 if(authenticated&&isLogin)return NextResponse.redirect(new URL("/",request.url));
 return NextResponse.next();
}

export const config={matcher:["/((?!api/auth|_next/static|_next/image|favicon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
