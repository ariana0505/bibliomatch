"""Create the configured administrator and optionally add a starter catalog."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from api.index import ensure_indexes, get_db  # noqa: E402


SAMPLE_BOOKS = [
    {
        "isbn": "9791399000016",
        "titulo": "La biblioteca de las nubes",
        "autor": "Elena Mar de Luna",
        "area": "LIT",
        "sinopsis": "Una aprendiz de bibliotecaria descubre que cada nube guarda una historia olvidada y deberá salvarlas antes de la gran tormenta.",
        "ubicacion": "Estante L-01",
        "donante": "Editorial Horizonte Imaginario",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000023",
        "titulo": "El teorema del colibrí",
        "autor": "Mateo Córdova Salas",
        "area": "MAT",
        "sinopsis": "Problemas matemáticos y acertijos acompañan a dos estudiantes que intentan descifrar el patrón oculto en el vuelo de un colibrí.",
        "ubicacion": "Estante M-01",
        "donante": "Club de Matemáticas",
        "ejemplares_total": 1,
    },
    {
        "isbn": "9791399000030",
        "titulo": "Atlas de estrellas diminutas",
        "autor": "Inés Valdivia Rojas",
        "area": "CIE",
        "sinopsis": "Una introducción ficticia y amena a la astronomía a través de veinte astros imaginarios y los fenómenos reales que los inspiran.",
        "ubicacion": "Estante C-01",
        "donante": "Familia Valdivia",
        "ejemplares_total": 3,
    },
    {
        "isbn": "9791399000047",
        "titulo": "Robots bajo la lluvia",
        "autor": "Nicolás Ferro Vega",
        "area": "TEC",
        "sinopsis": "Tres jóvenes construyen un robot de rescate con piezas recicladas para ayudar a su comunidad durante una temporada de lluvias.",
        "ubicacion": "Estante T-01",
        "donante": "Taller de Robótica",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000054",
        "titulo": "Cartas desde el reino de sal",
        "autor": "Amalia Bronce",
        "area": "LIT",
        "sinopsis": "Una colección de cartas revela la amistad entre una cartógrafa y el guardián de una ciudad construida a orillas de un mar blanco.",
        "ubicacion": "Estante L-02",
        "donante": "Asociación de Lectores",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000061",
        "titulo": "Los mapas secretos del virreinato",
        "autor": "Tomás Quispe Aranda",
        "area": "HIS",
        "sinopsis": "Novela histórica ficticia sobre un joven dibujante que recorre antiguos caminos andinos mientras protege un valioso cuaderno de mapas.",
        "ubicacion": "Estante H-01",
        "donante": "Centro Cultural Andino",
        "ejemplares_total": 1,
    },
    {
        "isbn": "9791399000078",
        "titulo": "Manual para pintar el viento",
        "autor": "Clara Montes Azules",
        "area": "ART",
        "sinopsis": "Guía creativa con ejercicios ficticios de color, textura y movimiento para explorar distintas técnicas de expresión visual.",
        "ubicacion": "Estante A-01",
        "donante": "Colectivo Pincel Joven",
        "ejemplares_total": 3,
    },
    {
        "isbn": "9791399000085",
        "titulo": "Diccionario de palabras imposibles",
        "autor": "Renata Solís Prado",
        "area": "REF",
        "sinopsis": "Repertorio ficticio de palabras inventadas, definiciones y juegos lingüísticos para estimular la escritura y la imaginación.",
        "ubicacion": "Estante R-01",
        "donante": "Biblioteca Escolar",
        "ejemplares_total": 1,
    },
    {
        "isbn": "9791399000092",
        "titulo": "La ecuación del faro",
        "autor": "Bruno Alcázar Peña",
        "area": "MAT",
        "sinopsis": "Una aventura de lógica en la que cada destello de un viejo faro esconde una secuencia que puede orientar a barcos perdidos.",
        "ubicacion": "Estante M-02",
        "donante": "Academia Faro Norte",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000108",
        "titulo": "El jardín que aprendió a contar",
        "autor": "Sara Lévano Cruz",
        "area": "CIE",
        "sinopsis": "Relato de divulgación ficticio que presenta patrones naturales, biodiversidad y observación científica en un jardín escolar.",
        "ubicacion": "Estante C-02",
        "donante": "Ecoescuela Semilla",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000115",
        "titulo": "Código para una ciudad invisible",
        "autor": "Julián Nexo Ramírez",
        "area": "TEC",
        "sinopsis": "Una estudiante aprende programación creando una ciudad virtual cuyos habitantes empiezan a enviarle misteriosos mensajes.",
        "ubicacion": "Estante T-02",
        "donante": "Laboratorio Digital",
        "ejemplares_total": 3,
    },
    {
        "isbn": "9791399000122",
        "titulo": "La casa de los relojes quietos",
        "autor": "Violeta Niebla",
        "area": "LIT",
        "sinopsis": "Dos hermanos entran en una casa donde el tiempo se detuvo y deben reconstruir los recuerdos de sus habitantes para volver a casa.",
        "ubicacion": "Estante L-03",
        "donante": "Editorial Brújula",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000139",
        "titulo": "Crónicas del puerto de cobre",
        "autor": "Damián Rivera Luz",
        "area": "HIS",
        "sinopsis": "Crónicas ficticias sobre comerciantes, artesanos y navegantes de un puerto sudamericano durante los primeros años republicanos.",
        "ubicacion": "Estante H-02",
        "donante": "Archivo Local Juvenil",
        "ejemplares_total": 1,
    },
    {
        "isbn": "9791399000146",
        "titulo": "Música para árboles dormidos",
        "autor": "Lucía Arpegio Campos",
        "area": "ART",
        "sinopsis": "Una joven compositora busca la melodía capaz de despertar un bosque y descubre cómo los sonidos cuentan historias sin palabras.",
        "ubicacion": "Estante A-02",
        "donante": "Conservatorio Escolar",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000153",
        "titulo": "Enciclopedia breve de islas errantes",
        "autor": "Ofelia Marín del Sur",
        "area": "REF",
        "sinopsis": "Compendio ficticio de geografía, costumbres y criaturas de islas que cambian de lugar con cada estación.",
        "ubicacion": "Estante R-02",
        "donante": "Círculo de Geografía",
        "ejemplares_total": 1,
    },
    {
        "isbn": "9791399000160",
        "titulo": "Geometría en la plaza",
        "autor": "Alonso Prado Mena",
        "area": "MAT",
        "sinopsis": "Actividades y retos que conectan ángulos, áreas, simetrías y proporciones con los espacios de una plaza imaginaria.",
        "ubicacion": "Estante M-03",
        "donante": "Docentes de Matemática",
        "ejemplares_total": 3,
    },
    {
        "isbn": "9791399000177",
        "titulo": "El laboratorio de las mareas",
        "autor": "Marina Celeste Pardo",
        "area": "CIE",
        "sinopsis": "Un equipo escolar investiga las mareas, la Luna y los ecosistemas costeros desde un laboratorio instalado frente al océano.",
        "ubicacion": "Estante C-03",
        "donante": "Fundación Océano Vivo",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000184",
        "titulo": "Inventores del barrio solar",
        "autor": "Pablo Circuito León",
        "area": "TEC",
        "sinopsis": "Cinco vecinos diseñan soluciones con energía solar para mejorar su barrio y aprenden a probar, fallar y volver a construir.",
        "ubicacion": "Estante T-03",
        "donante": "Comunidad Maker",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9791399000191",
        "titulo": "El último tren a Luciérnaga",
        "autor": "Camila Abril Soto",
        "area": "LIT",
        "sinopsis": "Una viajera sube a un tren nocturno cuyos pasajeros deben compartir una historia verdadera antes de llegar a su destino.",
        "ubicacion": "Estante L-04",
        "donante": "Feria del Libro Escolar",
        "ejemplares_total": 3,
    },
    {
        "isbn": "9791399000207",
        "titulo": "Pequeño atlas de futuros antiguos",
        "autor": "Esteban Tiempo Rosas",
        "area": "HIS",
        "sinopsis": "Ensayos ficticios que imaginan cómo distintas civilizaciones del pasado habrían descrito las ciudades y tecnologías del presente.",
        "ubicacion": "Estante H-03",
        "donante": "Museo de Historias Posibles",
        "ejemplares_total": 1,
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", action="store_true", help="agrega un catálogo inicial sin duplicar ISBN")
    args = parser.parse_args()

    if not os.getenv("MONGO_URL"):
        print("Falta MONGO_URL.", file=sys.stderr)
        return 2
    if not os.getenv("ADMIN_APODO") or len(os.getenv("ADMIN_PASSWORD", "")) < 12:
        print("Configura ADMIN_APODO y ADMIN_PASSWORD (mínimo 12 caracteres).", file=sys.stderr)
        return 2

    db = get_db()
    ensure_indexes(db)
    admin = db.usuarios.find_one({
        "apodo_norm": os.environ["ADMIN_APODO"].strip().casefold(),
        "rol": "admin", "es_anfitrion": True, "activo": {"$ne": False},
    })
    if not admin:
        print("No se pudo crear el administrador; revisa si el apodo ya pertenece a otra cuenta.", file=sys.stderr)
        return 1
    print(f"Administrador listo: {admin['apodo']}")

    if args.samples:
        created = 0
        for book in SAMPLE_BOOKS:
            document = {**book, "creado_en": datetime.now(timezone.utc), "creado_por": admin["_id"]}
            result = db.libros.update_one({"isbn": book["isbn"]}, {"$setOnInsert": document}, upsert=True)
            created += int(result.upserted_id is not None)
        print(f"Catálogo inicial: {created} libros agregados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
