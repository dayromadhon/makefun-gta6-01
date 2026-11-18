// main.ts — hands SOLMAR HEAT in: copies game/ + screenshots/ to /output and
// writes /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22 standard library only; run twice, both runs write identical bytes.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
// Start clean so a re-run writes exactly the same tree.
for (const name of ['game', 'screenshots', 'dossier.json']) {
  const p = join(outDir, name);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`SOLMAR HEAT handed in: ${outDir} (dossier ${dossier.length} bytes)`);
