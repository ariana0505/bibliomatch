from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from threading import Barrier

import pytest
from flask import g
from werkzeug.security import check_password_hash

import api.index as backend
from test_api import client, db, create_user, login, mutate


def test_library_assets_are_served_locally_with_script_mime_types(client):
    for path in ["library.html", "library.css", "library.js", "library-controls.mjs", "library-demo.mjs", "library-layout.mjs", "library-world.mjs", "vendor/three.module.mjs"]:
        response = client.get(f"/{path}")
        assert response.status_code == 200
        if path.endswith((".js", ".mjs")):
            assert "javascript" in response.content_type
    assert client.get("/vendor/../../.env").status_code == 404


def test_3d_catalog_metadata_keeps_all_areas_and_borrowed_titles(client, db):
    user = create_user(db, "reader3d")
    login(client, user["apodo"])
    for index in range(251):
        oid = db.libros.insert_one({"titulo": f"Book {index:03}", "area": "MAT" if index % 2 else "LIT", "ejemplares_total": 1, "sinopsis": "Full description", "foto": "large-cover-data"}).inserted_id
        if index == 250:
            db.prestamos.insert_one({"libro_id": oid, "estado": "activo"})
    first = client.get("/api/libros?formato=3d&por_pagina=250").get_json()
    last = client.get("/api/libros?formato=3d&por_pagina=250&pagina=2").get_json()
    assert first["total"] == 251 and first["paginas"] == 2
    assert len(first["libros"]) == 250
    assert {book["area"] for book in first["libros"]} == {"MAT", "LIT"}
    book = last["libros"][0]
    assert book["titulo"] == "Book 250" and book["disponibles"] == 0
    assert "foto" not in book and "sinopsis" not in book
    detail = client.get(f"/api/libros/{book['id']}").get_json()["libro"]
    assert detail["sinopsis"] == "Full description" and detail["foto"] == "large-cover-data"


@pytest.mark.parametrize("legacy", [False, True])
def test_bootstrap_never_promotes_an_existing_student(db, monkeypatch, legacy):
    user = create_user(db, "reserved")
    if legacy:
        db.usuarios.update_one({"_id": user["_id"]}, {"$unset": {"apodo_norm": ""}})
    monkeypatch.setenv("ADMIN_APODO", "RESERVED")
    monkeypatch.setenv("ADMIN_PASSWORD", "a-new-admin-password")
    before = db.usuarios.find_one({"_id": user["_id"]})
    backend.bootstrap_admin(db)
    assert db.usuarios.find_one({"_id": user["_id"]}) == before
    assert db.usuarios.count_documents({}) == 1


def test_bootstrap_creates_host_once_and_preserves_password(db, monkeypatch):
    monkeypatch.setenv("ADMIN_APODO", "newhost")
    monkeypatch.setenv("ADMIN_PASSWORD", "original-host-password")
    backend.bootstrap_admin(db)
    host = db.usuarios.find_one({"apodo_norm": "newhost"})
    assert host["rol"] == "admin" and host["es_anfitrion"]
    monkeypatch.setenv("ADMIN_PASSWORD", "replacement-password")
    backend.bootstrap_admin(db)
    assert db.usuarios.find_one({"_id": host["_id"]}) == host
    assert check_password_hash(host["contrasena_hash"], "original-host-password")


def test_catalog_filters_and_sorts_before_pagination(client, db):
    create_user(db, "reader")
    login(client, "reader")
    for index in range(251):
        book_id = db.libros.insert_one({"titulo": f"Book {index:03}", "ejemplares_total": 1}).inserted_id
        if index < 250:
            db.prestamos.insert_one({"libro_id": book_id, "estado": "activo"})
    available = client.get("/api/libros?disponible=1").get_json()
    assert available["total"] == 1
    assert available["libros"][0]["titulo"] == "Book 250"
    sorted_books = client.get("/api/libros?orden=disponibilidad&por_pagina=1").get_json()
    assert sorted_books["libros"][0]["titulo"] == "Book 250"
    first = client.get("/api/libros?por_pagina=250").get_json()
    second = client.get("/api/libros?por_pagina=250&pagina=2").get_json()
    assert first["total"] == second["total"] == 251
    assert first["paginas"] == 2 and len(first["libros"]) == 250
    assert [item["titulo"] for item in second["libros"]] == ["Book 250"]
    for query in ["pagina=0", "pagina=no", "por_pagina=0", "por_pagina=251"]:
        assert client.get(f"/api/libros?{query}").status_code == 422


def test_competing_loans_and_return(client, db):
    staff = create_user(db, "staff", "bibliotecario")
    users = [create_user(db, name) for name in ("one", "two")]
    book = {"titulo": "Only copy", "ejemplares_total": 1}
    book["_id"] = db.libros.insert_one(book).inserted_id
    start = Barrier(2)
    def borrow(user):
        with backend.app.test_request_context():
            g.current_user = staff
            start.wait(timeout=5)
            try:
                return backend.create_loan(db, book, user, "2099-01-01")
            except backend.ApiError as error:
                return error.code
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(borrow, users))
    assert results.count("book_unavailable") == 1
    loan = next(result for result in results if isinstance(result, dict))
    assert db.prestamos.count_documents({"estado": "activo"}) == 1
    csrf = login(client, "staff")
    assert mutate(client, "POST", f"/api/prestamos/{loan['_id']}/devolver", csrf, json={}).status_code == 200
    with backend.app.test_request_context():
        g.current_user = staff
        backend.create_loan(db, book, users[0], "2099-01-01")
    assert db.prestamos.count_documents({"estado": "activo"}) == 1


def test_failed_approval_keeps_request_pending(client, db):
    staff = create_user(db, "staff", "bibliotecario")
    reader = create_user(db, "reader")
    book_id = db.libros.insert_one({"titulo": "Busy", "ejemplares_total": 1}).inserted_id
    db.prestamos.insert_one({"libro_id": book_id, "estado": "activo"})
    request_id = db.solicitudes.insert_one({"libro_id": book_id, "usuario_id": reader["_id"], "estado": "pendiente"}).inserted_id
    csrf = login(client, staff["apodo"])
    response = mutate(client, "POST", f"/api/solicitudes/{request_id}/resolver", csrf,
                      json={"accion": "aprobar", "vence_en": (date.today() + timedelta(days=10)).isoformat()})
    assert response.status_code == 409
    assert db.solicitudes.find_one({"_id": request_id})["estado"] == "pendiente"
