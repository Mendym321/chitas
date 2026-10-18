/**
 * Tests for api/_lib/tanya-split.js — splitting Tanya into sentences
 * without changing a single word.
 * Run:  cd tools && npm test
 */
import { applySplits } from '../api/_lib/tanya-split.js';
import { cleanTanyaHtml, isHagahahHtml, FN_OPEN, FN_CLOSE } from '../api/_lib/tanya-text.js';

let failed = 0;
function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) console.log('  ✓', name);
  else { failed++; console.log('  ✗', name, '\n      expected:', expected, '\n      got:     ', actual); }
}
const HE = 'והנה בכל נפש ישראל יש שתי נפשות. נפש אחת היא מצד הקליפה. ונפש השנית היא חלק אלוק ממעל ממש.';
const EN = 'Every Jew has two souls. One soul comes from the kelipah. The second soul is truly a part of G-d above.';
const joined = p => [p.map(x => x.he).join(' '), p.map(x => x.en).join(' ')];

console.log('Tanya split:');
const good = applySplits(HE, EN, [{ he: 'נפש אחת היא', en: 'One soul comes' }, { he: 'ונפש השנית', en: 'The second soul' }]);
check('splits into 3 sentence pairs', good.length, 3);
check('second pair lines up', good[1], { he: 'נפש אחת היא מצד הקליפה.', en: 'One soul comes from the kelipah.' });
check('nothing added, dropped or changed', joined(good), [HE, EN]);

const madeUp = applySplits(HE, EN, [{ he: 'נפש אחת היא', en: 'One soul comes' }, { he: 'מילים שלא קיימות', en: 'The second soul' }]);
check('a start the AI made up is ignored (no split there)', madeUp.length, 2);
check('…and the text is still exactly the original', joined(madeUp), [HE, EN]);

check('paraphrased English start → ignored', applySplits(HE, EN, [{ he: 'נפש אחת היא', en: 'The first soul' }]).length, 1);
check('out-of-order starts → ignored', applySplits(HE, EN, [{ he: 'ונפש השנית', en: 'The second soul' }, { he: 'נפש אחת היא', en: 'One soul comes' }]).length, 2);
check('must start at a word (not inside one)', applySplits('abcdef ghi', 'one two', [{ he: 'def', en: 'two' }]).length, 1);
check('no splits → one block, unchanged', applySplits(HE, EN, []), [{ he: HE, en: EN }]);
check('missing English → one block', applySplits(HE, '', [{ he: 'נפש אחת', en: 'x' }]), [{ he: HE, en: '' }]);

// Real text (chapter 41): vowels, maqaf, curly quotes, a footnote
const RHE = 'וְהִנֵּה ה׳ נִצָּב עָלָיו, וּ״מְלֹא כָל הָאָרֶץ כְּבוֹדוֹ״, וּמַבִּיט עָלָיו, וּבוֹחֵן כְּלָיוֹת וָלֵב אִם עוֹבְדוֹ כָּרָאוּי. וְעַל כֵּן צָרִיךְ לַעֲבוֹד לְפָנָיו בְּאֵימָה וּבְיִרְאָה, כְּעוֹמֵד לִפְנֵי הַמֶּלֶךְ.';
const notes = [];
const REN = cleanTanyaHtml('“And, behold, G–d stands over him,”<sup class="footnote-marker">4</sup><i class="footnote"> Allusion to Genesis 28:13.</i> and “The whole world is full of His glory,”<sup class="footnote-marker">5</sup><i class="footnote"> Isaiah 6:3.</i> [to see] if he is serving Him as is fitting. Therefore he must serve in His presence with awe and fear like one standing before the king.', notes);
check('footnotes kept as notes, markers left in place', [notes, REN.split(FN_OPEN).length - 1], [['Allusion to Genesis 28:13.', 'Isaiah 6:3.'], 2]);
const real = applySplits(RHE, REN, [
  { he: 'ומלא כל הארץ כבודו', en: 'and "The whole world' },          // no vowels, plain quotes
  { he: 'ועל כן צריך', en: 'therefore he must serve' },              // lower case
]);
check('real text: 3 pieces despite vowels, quotes and case', real.length, 3);
check('an opening quote stays with its words', real[1].he.startsWith('וּ״מְלֹא') && real[1].en.startsWith('and “The whole'), true);
check('real text: nothing added, dropped or changed', joined(real), [RHE, REN]);
check('a footnote marker between words does not block a match', applySplits('אחת שתים שלש', 'one' + FN_OPEN + '0' + FN_CLOSE + ' two three', [{ he: 'שתים', en: 'two three' }]).length, 2);
check('hagahah recognised by <small>', [isHagahahHtml('<small>הגהה<br>טקסט</small>', ''), isHagahahHtml('[טקסט בסוגריים]', '')], [true, false]);
check('hagahah label removed', [cleanTanyaHtml('<small>הגהה<br>וּמַה שֶּׁכָּתוּב</small>'), cleanTanyaHtml('<small>NOTE: As far</small>')], ['וּמַה שֶּׁכָּתוּב', 'As far']);

console.log(failed ? `\n${failed} FAILED` : '\nAll Tanya split tests passed');
process.exit(failed ? 1 : 0);
