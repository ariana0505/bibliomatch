import mongomock

from api.index import book_json
from scripts.import_fictional_books import documents, import_books


def test_fictional_import_is_available_valid_and_idempotent():
    db = mongomock.MongoClient().test
    db.libros.create_index("isbn", unique=True, sparse=True)
    records = documents()
    original = {**records[0], "sinopsis": "Edición del usuario", "ejemplares_total": 7}
    db.libros.insert_one(original)
    saved_original = db.libros.find_one({"_id": original["_id"]})
    assert import_books(db, records) == {"por_agregar": 995, "existentes": 1}
    assert db.libros.count_documents({}) == 1
    assert import_books(db, records, apply=True) == {"agregados": 995, "existentes": 1}
    assert import_books(db, records, apply=True) == {"agregados": 0, "existentes": 996}
    assert db.libros.find_one({"_id": original["_id"]}) == saved_original
    assert db.prestamos.count_documents({}) == 0
    assert db.usuarios.count_documents({}) == 0
    assert {book["area"] for book in records} == {"LIT", "MAT", "CIE", "TEC", "HIS", "ART", "REF"}
    assert all(book_json(book)["disponibles"] == book["ejemplares_total"] for book in records)
    assert all("isbn" not in book and "demo" not in book for book in records)
