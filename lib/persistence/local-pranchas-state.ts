import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PranchasState } from "@/features/pranchas/persistence";
import { isPranchasState } from "@/features/pranchas/persistence";

const dataDirectory = path.join(process.cwd(), "data");
const stateFile = path.join(dataDirectory, "plataforma-estado.json");

export async function readLocalPranchasState(fallback: () => PranchasState) {
  await mkdir(dataDirectory, { recursive: true });
  try {
    const parsed: unknown = JSON.parse(await readFile(stateFile, "utf8"));
    if (isPranchasState(parsed)) return parsed;
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    if (!missing) console.error("Invalid local state; creating a clean database", error);
  }
  const initial = fallback();
  await writeLocalPranchasState(initial);
  return initial;
}

export async function writeLocalPranchasState(state: PranchasState) {
  await mkdir(dataDirectory, { recursive: true });
  const temporary = `${stateFile}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2), "utf8");
  await rename(temporary, stateFile);
}
