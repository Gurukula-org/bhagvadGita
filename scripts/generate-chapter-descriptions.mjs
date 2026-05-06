import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chapterDevanagari, chapterIAST } from "./lib/chapterMetadataMaps.mjs";
import { generateChapterDescription } from "./lib/chapterDescriptionGenerator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const gitaDataPath = path.join(repoRoot, "client", "src", "data", "gitaData.json");

function parseChapterArg(argv) {
  const chapterArg = argv.find((arg) => arg.startsWith("--chapter="));
  if (!chapterArg) return null;
  const chapterNum = Number(chapterArg.split("=")[1]);
  return Number.isInteger(chapterNum) && chapterNum > 0 ? chapterNum : null;
}

async function main() {
  const chapterFilter = parseChapterArg(process.argv.slice(2));
  const raw = await fs.readFile(gitaDataPath, "utf8");
  const data = JSON.parse(raw);
  const warnings = [];
  let touched = 0;

  for (const chapter of data.chapters) {
    if (chapterFilter && chapter.chapter !== chapterFilter) continue;

    const chapterNum = chapter.chapter;
    chapter.iast_name = chapterIAST[chapterNum] || chapter.iast_name || chapter.name;
    chapter.devanagari_name = chapterDevanagari[chapterNum] || chapter.devanagari_name || chapter.name_hindi;

    const verses = chapterNum === 6 ? data.chapter6_full : chapter.key_verses;
    const generated = generateChapterDescription(verses);
    if (!generated) {
      warnings.push(`Chapter ${chapterNum}: could not generate description (missing one_line_meaning values).`);
      continue;
    }
    chapter.generated_description = generated;
    touched += 1;
  }

  await fs.writeFile(gitaDataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

  console.log(`Updated chapter metadata for ${touched} chapter(s).`);
  if (warnings.length > 0) {
    console.warn("Warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
