/**
 * Adds to each day in data/hayom-yom.json the weekday and year it had in the
 * printed Hayom Yom, whose calendar runs from 19 Kislev 5703 to 18 Kislev 5704
 * (the book prints that day's weekday and year beside the date). day: [weekday
 * 0=Sunday…6=Shabbos, year]. Run again any time: it only sets that field.
 *
 * Run:  cd tools && node generate-hayom-yom-days.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { HDate, months } from '@hebcal/core';

const FILE = new URL('../data/hayom-yom.json', import.meta.url);
const raw = await readFile(FILE, 'utf8');
const data = JSON.parse(raw);
if (JSON.stringify(data) !== raw) throw new Error('the file is not in the expected one-line form; not touching it');

const MONTH = { Tishrei: months.TISHREI, Cheshvan: months.CHESHVAN, Kislev: months.KISLEV, Tevet: months.TEVET, Shvat: months.SHVAT,
  Adar_I: months.ADAR_I, Adar_II: months.ADAR_II, Nissan: months.NISAN, Iyyar: months.IYYAR, Sivan: months.SIVAN, Tamuz: months.TAMUZ, Av: months.AV, Elul: months.ELUL };
let n = 0;
for (const key of Object.keys(data)) {
  const [m, d] = key === 'Chai_18_Elul' ? ['Elul', 18] : [key.replace(/_\d+$/, ''), +key.split('_').pop()];
  if (!(m in MONTH)) throw new Error('unknown month in ' + key);
  // 5704 for Tishrei, Cheshvan and Kislev before the 19th; 5703 for the rest
  const year = m === 'Tishrei' || m === 'Cheshvan' || (m === 'Kislev' && d < 19) ? 5704 : 5703;
  const hd = new HDate(d, MONTH[m], year);
  if (hd.getDate() !== d || hd.getMonth() !== MONTH[m]) { delete data[key].day; continue; }   // no such day that year (e.g. 30 Cheshvan 5704)
  data[key].day = [hd.getDay(), year];
  n++;
}
await writeFile(FILE, JSON.stringify(data));
console.log('weekday and year for', n, 'of', Object.keys(data).length, 'days');
