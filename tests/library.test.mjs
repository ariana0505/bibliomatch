import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movePlayer, targetBook } from '../public/library-controls.mjs';
import { demoBooks, DEMO_SHELF_COLUMNS } from '../public/library-demo.mjs';
import {AREAS, BAY_LENGTH, planLibrary, bayAt, findBooks, loadAllBooks, sectionFor} from '../public/library-layout.mjs';

test('WASD is relative to the view and never changes eye height', () => {
  const point = {x:0,y:1.65,z:0};
  movePlayer(point, 1, 0, Math.PI / 2, .05);
  assert.ok(point.x < 0);
  assert.ok(Math.abs(point.z) < .00001);
  assert.equal(point.y, 1.65);
});
test('diagonal speed is normalized', () => {
  const straight = movePlayer({x:0,z:0}, 1, 0, 0, .05);
  const diagonal = movePlayer({x:0,z:0}, 1, 1, 0, .05);
  assert.ok(Math.abs(Math.hypot(straight.x,straight.z) - Math.hypot(diagonal.x,diagonal.z)) < 1e-8);
});
test('shelves block movement and room bounds cannot be crossed', () => {
  const point = {x:0,z:0};
  for (let i=0;i<100;i++) movePlayer(point,0,1,0,.05);
  assert.ok(point.x <= 1.62);
  for (let i=0;i<200;i++) movePlayer(point,1,0,0,.05);
  assert.ok(point.z >= -5.35);
});
test('the nearest solid surface prevents selection through furniture', () => {
  const book = {userData:{book:{id:'1'}}};
  const board = {userData:{}};
  assert.equal(targetBook([{distance:1,object:board},{distance:2,object:book}]),null);
  assert.equal(targetBook([{distance:3.01,object:book}]),null);
  assert.equal(targetBook([{distance:1,object:{userData:{},parent:book}}]),book);
});
test('demonstration has unique titles and no real record identifiers', () => {
  assert.equal(new Set(demoBooks.map(book=>book.titulo)).size,demoBooks.length);
  assert.ok(demoBooks.every(book=>book.demo && book.id.startsWith('demo-')));
  assert.equal(new Set(demoBooks.map(sectionFor)).size,Object.keys(AREAS).length);
});

test('dense demonstration fills every shelf without overlapping books', () => {
  const layout = planLibrary(demoBooks, {columns:DEMO_SHELF_COLUMNS});
  assert.equal(demoBooks.length, 1024);
  assert.equal(layout.bays.length, 8);
  for (const bay of layout.bays) {
    assert.equal(bay.books.length, 128);
    const shelves = new Map();
    for (const book of bay.books) {
      const p = layout.positions.get(book.id);
      const row = Math.round((p.y - p.height / 2 - .30) / .58);
      const key = `${p.side}:${row}`;
      if (!shelves.has(key)) shelves.set(key, []);
      shelves.get(key).push(p.z + bay.offset);
      assert.ok(book.disponibles >= 0 && book.disponibles <= book.ejemplares_total);
    }
    assert.equal(shelves.size, 8);
    for (const positions of shelves.values()) {
      assert.equal(positions.length, 16);
      positions.sort((a,b) => a-b);
      assert.ok(positions[0] - .125 >= -3.4);
      assert.ok(positions.at(-1) + .125 <= 1.4);
      for (let i=1; i<positions.length; i++) assert.ok(positions[i]-positions[i-1] > .25);
    }
  }
  const fictional = demoBooks.filter(book => book.ficticio);
  assert.equal(fictional.length, 996);
  assert.ok(fictional.every(book => book.autor.includes('ficticio') && book.sinopsis.includes('Libro ficticio')));
});

test('large catalogs create additional shelves without omitting or duplicating books', () => {
  const books=Array.from({length:601},(_,i)=>({id:String(i),titulo:'Libro '+i,autor:'Autor',area:i%2?'MAT':'LIT',disponibles:i%9?2:0}));
  const layout=planLibrary([...books,books[0]]);
  const placed=layout.bays.flatMap(bay=>bay.books);
  assert.equal(placed.length,601);
  assert.equal(new Set(placed.map(book=>book.id)).size,601);
  assert.ok(layout.bays.every(bay=>bay.books.length<=48));
  assert.ok(layout.sections.find(section=>section.code==='LIT').bays>1);
  assert.ok(layout.bays.filter(bay=>bay.code==='PRE').every(bay=>bay.books.every(book=>book.disponibles===0)));
  assert.ok(layout.bays.filter(bay=>bay.code!=='PRE').every(bay=>bay.books.every(book=>book.area===bay.code&&book.disponibles>0)));
});

test('one available copy keeps a title in its area and a return moves it back', () => {
  const book={id:'book',titulo:'Ciencia',autor:'Autora',area:'CIE',disponibles:1,ejemplares_total:3};
  assert.equal(sectionFor(book),'CIE');
  assert.equal(sectionFor({...book,disponibles:0}),'PRE');
  const returned=planLibrary([{...book,disponibles:1}]);
  assert.equal(returned.bays[returned.positions.get('book').bay].code,'CIE');
});

test('search matches accented titles, authors and ISBN in every section', () => {
  const layout=planLibrary([{id:'1',titulo:'Álgebra cósmica',autor:'Zoé',isbn:'1234567890',area:'MAT',disponibles:0}]);
  assert.equal(findBooks(layout,'algebra zoe','PRE').length,1);
  assert.equal(findBooks(layout,'1234567890').length,1);
  assert.equal(findBooks(layout,'algebra','MAT').length,0);
});

test('all API pages are loaded, including the last title after page 250', async () => {
  const calls=[];
  const books=await loadAllBooks(async url=>{
    calls.push(url);const page=Number(new URL(url,'http://localhost').searchParams.get('pagina'));
    return {libros:[{id:String(page),titulo:'Libro '+page}],paginas:3,total:3};
  });
  assert.deepEqual(books.map(book=>book.id),['1','2','3']);
  assert.equal(calls.length,3);
  assert.ok(calls.every(url=>url.includes('formato=3d')&&!url.includes('disponible=1')&&!url.includes('area=LIT')));
  await assert.rejects(loadAllBooks(async()=>({libros:[]})),/completamente/);
});

test('walking reaches later sections and their shelves also block movement', () => {
  const layout=planLibrary([]),point={x:0,y:1.65,z:0};
  for(let i=0;i<200;i++)movePlayer(point,1,0,0,.05,layout);
  assert.ok(bayAt(layout,point.z)>1);
  point.z=-1-3*BAY_LENGTH;
  for(let i=0;i<100;i++)movePlayer(point,0,1,0,.05,layout);
  assert.ok(point.x<=1.62);
});
