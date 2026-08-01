export const FROTAS_FIXAS = [
  { numero:"25073", prancha:"3412" },
  { numero:"25074", prancha:"3411" },
  { numero:"25075", prancha:"3459", tipo:"Bitola Aberta" as const },
  { numero:"25076", prancha:"3463", tipo:"Bitola Aberta" as const },
  { numero:"25077", prancha:"3460", tipo:"Bitola Aberta" as const },
  { numero:"25078", prancha:"3294" },
  { numero:"25079", prancha:"3180" },
] as const;
export const getFrotaConfig = (numero?:string) => FROTAS_FIXAS.find(f=>f.numero===numero);
