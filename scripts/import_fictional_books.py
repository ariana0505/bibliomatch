"""Import the fictional 3D collection without changing existing books or loans."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from bson import ObjectId

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.index import get_db, parse_book  # noqa: E402

BATCH = "fictional-library-v1"


def documents():
    result = subprocess.run(
        ["node", "--input-type=module", "-e",
         "import {demoBooks} from './public/library-demo.mjs';"
         "console.log(JSON.stringify(demoBooks.filter(book => book.ficticio)));"],
        cwd=ROOT, check=True, capture_output=True, text=True,
    )
    books = json.loads(result.stdout)
    records = []
    for book in books:
        document = parse_book({
            **book,
            "ubicacion": f"Colección ficticia · {book['area']}",
            "donante": "Colección ficticia BiblioMatch",
        })
        document.pop("isbn", None)
        document.update(
            _id=ObjectId(hashlib.sha256(f"{BATCH}:{book['id']}".encode()).digest()[:12]),
            ficticio=True, importacion=BATCH, origen_demo=book["id"],
            creado_en=datetime.now(timezone.utc),
        )
        records.append(document)
    if len(records) != 996 or len({str(book["_id"]) for book in records}) != 996:
        raise ValueError("La colección ficticia no coincide con los 996 títulos esperados.")
    return records


def import_books(db, records, apply=False):
    existing = list(db.libros.find({}, {"_id": 1, "titulo": 1, "autor": 1}))
    ids = {book["_id"] for book in existing}
    titles = {(book.get("titulo"), book.get("autor")) for book in existing}
    pending = []
    for document in records:
        if document["_id"] in ids or (document["titulo"], document["autor"]) in titles:
            continue
        pending.append(document)
        ids.add(document["_id"])
        titles.add((document["titulo"], document["autor"]))
    if apply and pending:
        db.libros.insert_many(pending, ordered=False)
    return {"agregados" if apply else "por_agregar": len(pending), "existentes": len(records) - len(pending)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="confirma la inserción; sin esto solo consulta")
    args = parser.parse_args()
    records = documents()
    db = get_db()
    print(json.dumps({"base": db.name, "modo": "insertar" if args.apply else "consulta",
                      "libros_antes": db.libros.count_documents({})}, ensure_ascii=False), flush=True)
    print(json.dumps(import_books(db, records, args.apply), ensure_ascii=False), flush=True)
    print(json.dumps({"coleccion_ficticia": db.libros.count_documents({"importacion": BATCH}),
                      "libros_despues": db.libros.count_documents({})}), flush=True)


if __name__ == "__main__":
    main()
