export const AREAS = {LIT:'Literatura', MAT:'Matemática', CIE:'Ciencias', TEC:'Tecnología', HIS:'Historia', ART:'Arte', REF:'Referencia', PRE:'Prestados'};
export const BAY_LENGTH = 7.2;
export const BAY_CAPACITY = 48;
export const sectionFor = book => book.disponibles > 0 ? (Object.hasOwn(AREAS, book.area) && book.area !== 'PRE' ? book.area : 'REF') : 'PRE';
export const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function planLibrary(books) {
  const unique = [...new Map(books.map(book => [book.id, book])).values()];
  const bays = [], positions = new Map(), sections = [];
  for (const [code, name] of Object.entries(AREAS)) {
    const items = unique.filter(book => sectionFor(book) === code).sort((a,b) => a.titulo.localeCompare(b.titulo,'es') || a.id.localeCompare(b.id));
    const firstBay = bays.length;
    const count = Math.max(1, Math.ceil(items.length / BAY_CAPACITY));
    sections.push({code, name, count:items.length, firstBay, bays:count});
    for (let part = 0; part < count; part++) {
      const index = bays.length, offset = index * BAY_LENGTH;
      const bay = {index, code, name, offset, label:`${name}${count > 1 ? ` · ${part + 1}/${count}` : ''}`, books:items.slice(part * BAY_CAPACITY, (part + 1) * BAY_CAPACITY)};
      bay.books.forEach((book, slot) => {
        const side = slot % 2 === 0 ? -1 : 1;
        const local = Math.floor(slot / 2), row = local % 4, col = Math.floor(local / 4);
        const height = .39 + (slot % 3) * .045;
        positions.set(book.id, {book, bay:index, side, height, x:side * 2.07, y:.30 + row * .58 + height / 2, z:-2.9 + (col + .5) * 3.8 / 6 - offset});
      });
      bays.push(bay);
    }
  }
  return {bays, sections, positions, books:unique, minZ:-5.35 - (bays.length - 1) * BAY_LENGTH, maxZ:4.35};
}

export function bayAt(layout, z) {
  return Math.max(0, Math.min(layout.bays.length - 1, Math.round((-z - 1) / BAY_LENGTH)));
}

export function findBooks(layout, query = '', area = '') {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return layout.books.filter(book => (!area || sectionFor(book) === area) && words.every(word => normalize(`${book.titulo} ${book.autor} ${book.isbn || ''}`).includes(word)));
}

export async function loadAllBooks(api, onProgress = () => {}) {
  const books = new Map();
  let page = 1, pages = 1;
  do {
    const data = await api(`/api/libros?formato=3d&por_pagina=250&pagina=${page}`);
    if (!Array.isArray(data.libros) || !Number.isInteger(data.paginas) || data.paginas < 1) throw new Error('El catálogo no pudo cargarse completamente. Inténtalo de nuevo.');
    data.libros.forEach(book => books.set(book.id, book));
    pages = data.paginas;
    onProgress(books.size, data.total);
    page++;
  } while (page <= pages);
  return [...books.values()];
}
