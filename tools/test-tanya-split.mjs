/**
 * Tests for api/_lib/tanya-split.js — splitting Tanya into sentences
 * without changing a single word.
 * Run:  cd tools && npm test
 */
import { applySplits } from '../api/_lib/tanya-split.js';

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

console.log(failed ? `\n${failed} FAILED` : '\nAll Tanya split tests passed');
process.exit(failed ? 1 : 0);
