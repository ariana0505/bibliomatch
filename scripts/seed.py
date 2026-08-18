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
        "isbn": "9780156013925",
        "titulo": "El principito",
        "autor": "Antoine de Saint-Exupéry",
        "area": "LIT",
        "sinopsis": "Un aviador conoce a un pequeño príncipe que recorre planetas y descubre lo esencial de la amistad y la vida.",
        "ubicacion": "estante 1",
        "donante": "Colegio",
        "ejemplares_total": 2,
    },
    {
        "isbn": "9789708170000",
        "titulo": "Álgebra",
        "autor": "Aurelio Baldor",
        "area": "MAT",
        "sinopsis": "Teoría, ejemplos resueltos y ejercicios para el aprendizaje escolar del álgebra.",
        "ubicacion": "estante 2",
        "donante": "Colegio",
        "ejemplares_total": 1,
    },
    {
        "isbn": "9780345539434",
        "titulo": "Cosmos",
        "autor": "Carl Sagan",
        "area": "CIE",
        "sinopsis": "Un recorrido accesible por el universo, la ciencia y la historia de nuestro conocimiento.",
        "ubicacion": "estante 3",
        "donante": "Colegio",
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
    admin = db.usuarios.find_one({"rol": "admin", "activo": {"$ne": False}})
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
