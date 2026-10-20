import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BOOK, UNITS, SEMESTERS, ACTIVITIES, BOOK_PAGES, COVERAGE } from './public/game/book-course.js';
const catalog=JSON.parse(readFileSync(new URL('./public/game/book-coverage.json',import.meta.url),'utf8'));
assert.equal(BOOK_PAGES.length,248);
assert.equal(UNITS.length,10);assert.equal(SEMESTERS.length,8);
assert.equal(new Set(ACTIVITIES.map(a=>a.id)).size,ACTIVITIES.length);
const questions=ACTIVITIES.flatMap(a=>a.questions);
assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
for(const a of ACTIVITIES){
 assert.ok(a.required);assert.equal(a.year,Math.ceil(a.semester/2));assert.ok(a.questions.length);
 for(const p of [...a.sourcePages,...a.studyPages])assert.ok(BOOK_PAGES[p-1],`Missing source ${p}`);
 for(const q of a.questions){
  assert.ok(q.prompt.trim(),a.id);
  if(q.answers)assert.ok(q.answers.length&&q.answers.every(x=>typeof x==='string'&&x.trim()),q.id);
  else assert.ok(q.criteria?.length>=3,`No explicit self-review criteria: ${q.id}`);
 }
}
for(const p of BOOK_PAGES){
 assert.ok(existsSync(new URL('./public'+p.asset,import.meta.url)),`Missing page image ${p.page}`);
 if(p.page>=9&&p.page<=241&&![212,213].includes(p.page))assert.ok(p.activityIds.length,`Unassigned instructional page ${p.page}`);
}
const finalItems=ACTIVITIES.flatMap(a=>a.assessmentItemIds||[]).sort((a,b)=>a-b);
assert.deepEqual(finalItems,Array.from({length:154},(_,i)=>i+1));
const listening=ACTIVITIES.filter(a=>a.id.startsWith('ufinal-p21')&&a.type==='listen');
assert.equal(listening.length,5);
for(const a of listening){assert.ok(/adapted/i.test(a.adaptation));assert.ok(a.script);assert.equal(a.questions.length,6);}
const locations=['entrance','imd','cruise','pacific','workshop','dome','academic','garden','cafe','atlantic'];
for(const sem of SEMESTERS){
 const assigned=ACTIVITIES.filter(a=>a.semester===sem.id);
 assert.deepEqual(sem.activityIds,assigned.map(a=>a.id));
 for(const id of locations)assert.ok(assigned.some(a=>a.location===id),`Semester${sem.id} missing ${id}`);
}
for(const unit of UNITS){
 const bySection=section=>ACTIVITIES.filter(a=>a.unit===unit.id&&a.section===section).flatMap(a=>a.questions);
 assert.equal(bySection('grammar-a').length,6,`Unit${unit.id} Activity A`);
 assert.equal(bySection('grammar-bc').length,10,`Unit${unit.id} Activities B/C`);
 assert.equal(bySection('grammar-de').length,6,`Unit${unit.id} Activities D/E`);
 assert.equal(bySection('article-comprehension').length,10,`Unit${unit.id} article questions`);
 assert.equal(bySection('dialogue-comprehension').length,9,`Unit${unit.id} dialogue questions`);
 assert.equal(bySection('unit-test-ab').length,28,`Unit${unit.id} test A/B`);
 assert.equal(bySection('unit-test-reading').length,7,`Unit${unit.id} test reading`);
 assert.equal(bySection('unit-test-performance').length,2,`Unit${unit.id} test performance`);
 assert.equal(bySection('speaking').length,4,`Unit${unit.id} speaking product and allthree reflections`);
 assert.equal(bySection('practical').length,unit.id<=5?4:2,`Unit${unit.id} practical product and allreflections`);
}
assert.equal(ACTIVITIES.flatMap(a=>a.pairs||[]).length,162);
assert.ok(catalog.promptCoverage.every(p=>p.activityIds.length));
const pdf=readFileSync(new URL('./public'+BOOK.pdfUrl,import.meta.url));
assert.equal(createHash('sha256').update(pdf).digest('hex'),BOOK.sourceSha256);
assert.equal(COVERAGE.counts.questions,questions.length);
console.log('Book coverage checks passed:',COVERAGE.counts);
