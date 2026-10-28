/**
 * Writes js/sefer-hamitzvos-data.js: the 339 days of the Sefer HaMitzvos
 * cycle, as Hebcal has them (@hebcal/learning). js/sefer-hamitzvos.js works
 * out the day; tools/test-sefer-hamitzvos.mjs checks it against Hebcal.
 *
 * Run:  cd tools && node generate-sefer-hamitzvos.mjs
 */
import { writeFileSync } from 'node:fs';
const { default: cycle } = await import(new URL('./node_modules/@hebcal/learning/dist/esm/seferHaMitzvot.json.js', import.meta.url));
writeFileSync(new URL('../js/sefer-hamitzvos-data.js', import.meta.url),
  '// The Sefer HaMitzvos cycle, day 1 to 339 (made by tools/generate-sefer-hamitzvos.mjs from Hebcal).\n'
  + '// "P3" is positive mitzvah 3, "N251" negative mitzvah 251; anything else is named.\n'
  + 'const SHM_CYCLE = ' + JSON.stringify(cycle) + ';\n');
console.log(cycle.length, 'days');
