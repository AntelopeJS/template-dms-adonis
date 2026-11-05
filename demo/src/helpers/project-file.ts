import { readFileSync } from "node:fs";
import path from "node:path";

/** The absolute path of a file at the project root, whether the caller runs from `src` or from `dist`. */
export function projectPath(relativePath: string): string {
  return path.join(__dirname, "..", "..", relativePath);
}

/** The text of a file at the project root, whether the caller runs from `src` or from `dist`. */
export function readProjectFile(relativePath: string): string {
  return readFileSync(projectPath(relativePath), "utf8");
}
