// Demonstration data stays in the browser and is never inserted into MongoDB.
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
