// Demonstration data stays in the browser and is never inserted into MongoDB.
import {AREAS, sectionFor} from './library-layout.mjs';
export const DEMO_SHELF_COLUMNS = 16;
const titles = [
  ["El principito", "Antoine de Saint-Exupéry", "Un pequeño viajero recorre distintos planetas y descubre el valor de la amistad, el cuidado y las cosas que no se ven a simple vista."],
  ["Alicia en el país de las maravillas", "Lewis Carroll", "Alicia sigue a un conejo y entra en un mundo donde las reglas cambian, los animales conversan y la imaginación transforma cada encuentro."],
  ["La isla del tesoro", "Robert Louis Stevenson", "Un mapa lleva a Jim Hawkins a una expedición entre piratas, secretos y decisiones que pondrán a prueba su valentía."],
  ["Mujercitas", "Louisa May Alcott", "Las hermanas March crecen entre sueños, dificultades y vínculos familiares, buscando cada una su propio camino."],
  ["Don Quijote de la Mancha", "Miguel de Cervantes", "Un lector apasionado sale a vivir aventuras como caballero andante, acompañado de Sancho Panza. Su viaje enfrenta los sueños con la realidad."],
  ["El jardín secreto", "Frances Hodgson Burnett", "Una niña descubre un jardín abandonado y encuentra en su recuperación una nueva amistad y una forma distinta de mirar el mundo."],
  ["Las aventuras de Tom Sawyer", "Mark Twain", "Tom transforma la vida de su pueblo en una sucesión de travesuras y aventuras junto a sus amigos."],
  ["Viaje al centro de la Tierra", "Julio Verne", "Un manuscrito conduce a un profesor y sus compañeros a una expedición bajo la superficie terrestre."],
  ["La vuelta al mundo en ochenta días", "Julio Verne", "Phileas Fogg y Passepartout emprenden una carrera contra el reloj que los lleva por países, transportes e imprevistos."],
  ["Heidi", "Johanna Spyri", "La vida de una niña en los Alpes muestra la importancia del cariño, la naturaleza y los lugares que sentimos nuestros."],
  ["Pinocho", "Carlo Collodi", "Una marioneta de madera aprende, a través de sus aventuras y errores, a ser responsable y cuidar a quienes la quieren."],
  ["El maravilloso mago de Oz", "L. Frank Baum", "Dorothy busca el camino a casa con tres compañeros que esperan encontrar aquello que creen que les falta."],
  ["Platero y yo", "Juan Ramón Jiménez", "Breves escenas poéticas retratan la vida de un pueblo y la relación del narrador con su burro Platero."],
  ["Los viajes de Gulliver", "Jonathan Swift", "Viajes por sociedades imaginarias invitan a observar con otros ojos las costumbres y contradicciones humanas."],
  ["El libro de la selva", "Rudyard Kipling", "Relatos de animales y de Mowgli, un niño criado entre lobos, exploran la pertenencia y la convivencia."],
  ["Leyendas", "Gustavo Adolfo Bécquer", "Historias donde el misterio, los paisajes y lo sobrenatural se mezclan con los sentimientos de sus protagonistas."],
];
export const demoBooks = titles.map(([titulo, autor, sinopsis], index) => ({
  id: `demo-${index}`, titulo, autor, sinopsis, area: "LIT", foto: "", disponibles: index % 3 + 1,
  ejemplares_total: index % 3 + 1, ubicacion: "Sala de Literatura · Demostración", demo: true,
}));

const otherAreas = [
  ['MAT', 'Álgebra paso a paso', 'Problemas y ejemplos para explorar ecuaciones y funciones.'],
  ['MAT', 'Geometría a nuestro alrededor', 'Formas, medidas y construcciones que aparecen en la vida cotidiana.'],
  ['CIE', 'Explorando el universo', 'Una introducción a los planetas, las estrellas y la observación del cielo.'],
  ['CIE', 'La vida bajo el microscopio', 'Una mirada a las células y los pequeños organismos.'],
  ['TEC', 'Construye tu primer robot', 'Mecanismos y circuitos sencillos para empezar a crear.'],
  ['TEC', 'Programar para aprender', 'Actividades para practicar pensamiento lógico y programación.'],
  ['HIS', 'Caminos del Perú antiguo', 'Un recorrido introductorio por las culturas del antiguo Perú.'],
  ['HIS', 'Historias del mundo', 'Preguntas y lecturas sobre cambios en las sociedades humanas.'],
  ['ART', 'Un mundo de colores', 'Experiencias con dibujo, pintura y composición.'],
  ['ART', 'Escuchar la música', 'Una introducción al ritmo, la melodía y los instrumentos.'],
  ['REF', 'Atlas para curiosos', 'Mapas para explorar continentes, paisajes y regiones.'],
  ['REF', 'Diccionario del estudiante', 'Un ejemplo de obra de consulta para descubrir palabras.'],
];
otherAreas.forEach(([area, titulo, sinopsis], index) => demoBooks.push({
  id: 'demo-area-' + index, titulo, autor: 'Equipo BiblioMatch · Ejemplo ficticio', area, sinopsis,
  disponibles: 2, ejemplares_total: 3, foto: '', ubicacion: 'Demostración', demo: true,
}));
// Show fully borrowed and partially available titles without creating real loans.
for (const index of [2, 9, 17, 22]) demoBooks[index].disponibles = 0;

// Original fictional titles supplement the existing examples. Every section
// contains exactly two full cabinets, without inventing real ISBNs or loans.
const subjects = {
  LIT: ['la biblioteca sumergida', 'el reloj de las mareas', 'la ciudad de cristal', 'el faro sin sombra', 'la estación de los sueños', 'el bosque de las cartas', 'la isla del último invierno', 'el teatro de las luciérnagas', 'la casa de los mapas', 'el jardín de los cometas', 'la montaña que cantaba', 'el tren de las nubes', 'la plaza de los recuerdos', 'el reino de papel', 'la puerta del amanecer', 'el taller de las estrellas'],
  MAT: ['los números primos', 'la geometría del mosaico', 'las ecuaciones cotidianas', 'la lógica de los acertijos', 'las fracciones en la cocina', 'la simetría de la naturaleza', 'el azar y los dados', 'los gráficos de la ciudad', 'las proporciones del arte', 'los patrones del tejido', 'las funciones en movimiento', 'la estadística del aula', 'los ángulos del paisaje', 'las coordenadas del tesoro', 'la medida del tiempo', 'los sólidos de papel'],
  CIE: ['los volcanes dormidos', 'la vida del arrecife', 'las semillas viajeras', 'el cielo nocturno', 'los sonidos del agua', 'la química de los colores', 'las huellas de los dinosaurios', 'el mundo de las células', 'los secretos de la luz', 'la energía del viento', 'los insectos del jardín', 'las rocas del desierto', 'el clima de los Andes', 'las corrientes del océano', 'la física de una bicicleta', 'las redes del bosque'],
  TEC: ['los robots exploradores', 'la programación creativa', 'los circuitos de cartón', 'los sensores del huerto', 'la seguridad digital', 'las máquinas de reciclaje', 'el diseño de videojuegos', 'la impresión en tres dimensiones', 'los algoritmos del laberinto', 'la electrónica musical', 'las redes de comunicación', 'las aplicaciones del barrio', 'la animación por computadora', 'los inventos con energía solar', 'el diseño de puentes', 'la inteligencia artificial del aula'],
  HIS: ['los caminos del Tahuantinsuyo', 'las ciudades del desierto', 'los navegantes del Pacífico', 'los mercados medievales', 'las rutas de la seda', 'los talleres del Renacimiento', 'las primeras imprentas', 'los ferrocarriles del siglo XIX', 'las plazas de la independencia', 'los oficios de Lima antigua', 'las culturas del Mediterráneo', 'los viajeros de los Andes', 'las aldeas del Neolítico', 'los archivos de la memoria', 'los intercambios entre continentes', 'las mujeres en la historia'],
  ART: ['la acuarela del paisaje', 'los ritmos del cajón', 'el teatro de sombras', 'la fotografía de la calle', 'las esculturas de arcilla', 'los colores del mural', 'el dibujo de personajes', 'las melodías del viento', 'la danza de las regiones', 'el cine de animación', 'los tejidos y sus diseños', 'el grabado en papel', 'las máscaras de carnaval', 'la arquitectura de los sueños', 'el collage de la ciudad', 'las historias del cómic'],
  REF: ['el vocabulario del estudiante', 'los mapas de los continentes', 'las especies de los humedales', 'las unidades de medida', 'los términos de la informática', 'las fechas de la historia', 'los instrumentos de música', 'los símbolos de los mapas', 'las palabras de la ciencia', 'las formas de la escritura', 'los países y sus paisajes', 'las técnicas de investigación', 'los conceptos de ciudadanía', 'los elementos de la tabla periódica', 'las herramientas de estudio', 'las lenguas del mundo'],
};
const collections = {
  LIT: ['El secreto de', 'Las cartas de', 'Una noche en', 'El guardián de', 'Regreso a', 'La leyenda de', 'Un verano en', 'Las voces de'],
  MAT: ['Desafíos sobre', 'Un viaje por', 'Explorando', 'El cuaderno de', 'Juegos con', 'Una mirada a', 'Preguntas sobre', 'Descubriendo'],
  CIE: ['Expedición a', 'La aventura de conocer', 'Preguntas sobre', 'Un laboratorio para explorar', 'Tras las pistas de', 'Observando', 'Descubriendo', 'Una mirada a'],
  TEC: ['El taller de', 'Proyectos sobre', 'Descubriendo', 'Una aventura con', 'El laboratorio de', 'Aprendiendo con', 'Preguntas sobre', 'Ideas para explorar'],
  HIS: ['Un recorrido por', 'El cuaderno de', 'Historias sobre', 'Tras las huellas de', 'Preguntas sobre', 'Una mirada a', 'Explorando', 'El atlas de'],
  ART: ['El taller de', 'Experimentos con', 'Descubriendo', 'El cuaderno de', 'Una aventura con', 'Explorando', 'Proyectos sobre', 'Una mirada a'],
  REF: ['Guía ilustrada de', 'Atlas de', 'Diccionario visual de', 'Manual de consulta sobre', 'Enciclopedia breve de', 'Cuaderno de referencia sobre', 'Compendio de', 'Preguntas y respuestas sobre'],
};
const names = ['Alma', 'Bruno', 'Celeste', 'Darío', 'Elena', 'Fabio', 'Gabriela', 'Hugo', 'Inés', 'Julián', 'Kiara', 'Leonardo', 'Marina', 'Nicolás', 'Olivia', 'Pablo'];
const surnames = ['Valdeluz', 'Montelago', 'Ríoclaro', 'Solmar', 'Peñaluna', 'Vientoalto', 'Robledía', 'Cieloverde', 'Lunacosta', 'Pradoazul', 'Nieblesur', 'Maravalle', 'Albaloma', 'Brisalba', 'Piedraclara', 'Mirasol'];
const plot = [
  'Una aprendiz de cartógrafa encuentra una señal que nadie más puede leer.',
  'Dos amigos reciben una carta que los invita a resolver un misterio.',
  'Un joven inventor descubre que su último experimento ha cambiado el pueblo.',
  'Una narradora reúne las historias que sus vecinos creían olvidadas.',
  'Una viajera debe decidir entre volver a casa y ayudar a un desconocido.',
  'Un grupo de estudiantes encuentra un objeto que parece recordar el pasado.',
  'Una familia llega a un lugar donde cada puerta conduce a una historia diferente.',
  'Un aprendiz recibe una misión inesperada justo antes de la fiesta del pueblo.',
];
const approach = ['observaciones y ejemplos ilustrados', 'retos breves para resolver en equipo', 'actividades con materiales cotidianos', 'preguntas para investigar paso a paso', 'comparaciones, esquemas y ejercicios', 'proyectos para conectar el tema con la vida diaria', 'lecturas y experimentos de exploración', 'mapas conceptuales y situaciones para debatir'];
const descriptions = {
  MAT: 'Invita a razonar, reconocer patrones y explicar distintas formas de llegar a una solución.',
  CIE: 'Propone observar, formular hipótesis y distinguir las evidencias de las primeras suposiciones.',
  TEC: 'Combina diseño, pruebas y mejoras para comprender cómo funcionan las herramientas que creamos.',
  HIS: 'Relaciona fuentes, lugares y testimonios para comparar perspectivas y comprender cambios históricos.',
  ART: 'Invita a experimentar con técnicas y a construir una interpretación personal de cada propuesta.',
  REF: 'Organiza conceptos y referencias con entradas breves para practicar la búsqueda de información.',
};
const areaCodes = Object.keys(subjects);
const sectionSize = DEMO_SHELF_COLUMNS * 8;
for (const section of Object.keys(AREAS)) {
  const existing = demoBooks.filter(book => sectionFor(book) === section).length;
  for (let index = 0; index < sectionSize - existing; index++) {
    const borrowed = section === 'PRE';
    const area = borrowed ? areaCodes[index % areaCodes.length] : section;
    const areaIndex = areaCodes.indexOf(area);
    const topic = subjects[area][index % subjects[area].length];
    const variant = Math.floor(index / subjects[area].length) % 8;
    const title = (collections[area][variant] + ' ' + topic).replace(/\bde el\b/g, 'del').replace(/\ba el\b/g, 'al');
    const ejemplares_total = 1 + (index + areaIndex) % 5;
    const disponibles = borrowed ? 0 : Math.max(1, ejemplares_total - (index % 3 === 0 ? 1 : 0));
    const synopsis = area === 'LIT'
      ? `${plot[index % plot.length]} La aventura transcurre alrededor de ${topic}, donde la amistad, el ingenio y una decisión valiente cambian el rumbo de la historia.`
      : `Una propuesta de lectura sobre ${topic}, con ${approach[variant]}. ${descriptions[area]}`;
    demoBooks.push({
      id: `demo-fiction-${section}-${index}`, titulo: title + (borrowed ? ' · Colección Horizonte' : ''),
      autor: `${names[(index + areaIndex * 3) % names.length]} ${surnames[(Math.floor(index / names.length) + areaIndex * 2) % surnames.length]} (autor ficticio)`,
      sinopsis: synopsis + ' Libro ficticio creado para explorar la biblioteca de demostración.',
      area, foto: '', disponibles, ejemplares_total, prestados: ejemplares_total - disponibles,
      ubicacion: `${AREAS[section]} · Catálogo de demostración`, demo: true, ficticio: true,
    });
  }
}
