const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function frontend(fetch = async () => { throw new Error('Unexpected request'); }) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {}, addEventListener() {}, innerHTML: '',
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {} },
    URLSearchParams, Intl, Date, setTimeout, clearTimeout, fetch,
  });
  const source = fs.readFileSync(require('node:path').join(__dirname, '../public/app.js'), 'utf8');
  vm.runInContext(source.replace(/boot\(\);\s*$/, ''), context);
  return { context, element, run: code => vm.runInContext(code, context) };
}

test('switching accounts removes previous learning data and shows the quiz', () => {
  const ui = frontend();
  ui.run(`state.course='Matemática'; state.style='V'; state.material={resumen:'private answer'};
    state.users=[{apodo:'private user'}]; state.catalogFilters.q='old search';
    showAuth(); state.user={apodo:'new user'}; renderLearning();`);
  assert.equal(ui.run('state.material'), null);
  assert.equal(ui.run('state.users.length'), 0);
  assert.equal(ui.run('state.catalogFilters.q'), '');
  assert.equal(ui.element('learning-view').innerHTML.includes('private answer'), false);
  ui.run(`state.course='Matemática'; renderLearning();`);
  assert.match(ui.element('learning-view').innerHTML, /id="learning-quiz"/);
});

test('responses from an ended session cannot restore its data', async () => {
  let finish;
  const ui = frontend(() => new Promise(resolve => { finish = resolve; }));
  const pending = ui.run('api("/api/progreso")');
  ui.run('showAuth()');
  finish({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({progreso: ['private']}) });
  await assert.rejects(pending, /La sesión cambió/);
});

test('catalog pagination requests and renders subsequent pages', async () => {
  const urls = [];
  const ui = frontend(async url => {
    urls.push(url);
    return { ok: true, headers: {get: () => 'application/json'}, json: async () => ({libros: [], total: 101, paginas: 3}) };
  });
  await ui.run('loadBooks(null, 2)');
  assert.match(urls[0], /pagina=2/);
  assert.match(ui.element('catalog-view').innerHTML, /Página 2 de 3/);
  await ui.run('loadBooks({q:"new"})');
  assert.match(urls[1], /pagina=1/);
});

test('management includes available books beyond the first page', async () => {
  const ui = frontend(async url => ({
    ok: true, headers: { get: () => 'application/json' },
    json: async () => ({libros: [{id: new URL(url, 'http://localhost').searchParams.get('pagina') === '2' ? 'last' : 'first'}], paginas: 2}),
  }));
  const result = await ui.run('loadLoanBooks()');
  assert.deepEqual(Array.from(result.libros, book => book.id), ['first', 'last']);
});
