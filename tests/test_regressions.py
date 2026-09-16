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
    assert detail["sinopsis"] == "Full description" and detail["foto"].startswith(f"/portadas/{book['id']}?v=")


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


def test_stored_covers_are_served_by_reference_not_inline(client, db):
    user = create_user(db, "coverreader")
    login(client, user["apodo"])
    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    stored = db.libros.insert_one({"titulo": "Con portada", "area": "LIT", "ejemplares_total": 1, "foto": png, "creado_en": backend.utcnow()}).inserted_id
    linked = db.libros.insert_one({"titulo": "Enlace", "area": "LIT", "ejemplares_total": 1, "foto": "https://covers.openlibrary.org/b/id/1-M.jpg"}).inserted_id
    db.libros.insert_one({"titulo": "Sin portada", "area": "LIT", "ejemplares_total": 1})
    books = {book["titulo"]: book for book in client.get("/api/libros").get_json()["libros"]}
    assert books["Con portada"]["foto"] == f"/portadas/{stored}?v=" + books["Con portada"]["foto"].rsplit("=", 1)[1]
    assert "base64" not in books["Con portada"]["foto"]
    assert books["Enlace"]["foto"] == "https://covers.openlibrary.org/b/id/1-M.jpg"
    assert books["Sin portada"]["foto"] == ""
    response = client.get(f"/portadas/{stored}")
    assert response.status_code == 200 and response.content_type == "image/png"
    assert response.data.startswith(b"\x89PNG") and "max-age" in response.headers["Cache-Control"]
    assert client.get(f"/portadas/{linked}").status_code == 302
    assert client.get(f"/portadas/{backend.ObjectId()}").status_code == 404


def test_editing_without_a_new_cover_keeps_the_stored_one(client, db):
    staff = create_user(db, "keeper", role="bibliotecario")
    csrf = login(client, staff["apodo"])
    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    oid = db.libros.insert_one({"titulo": "Editable", "area": "LIT", "ejemplares_total": 1, "foto": png}).inserted_id
    response = mutate(client, "PUT", f"/api/libros/{oid}", csrf, json={"titulo": "Editado", "area": "LIT", "ejemplares_total": 2})
    assert response.status_code == 200, response.get_json()
    assert db.libros.find_one({"_id": oid})["foto"] == png


def test_students_cannot_exceed_request_and_loan_limits(client, db):
    student = create_user(db, "avid")
    staff = create_user(db, "desk", role="bibliotecario")
    books = [db.libros.insert_one({"titulo": f"Libro {i}", "area": "LIT", "ejemplares_total": 5}).inserted_id for i in range(6)]
    csrf = login(client, student["apodo"])
    for oid in books[:3]:
        assert mutate(client, "POST", "/api/solicitudes", csrf, json={"libro_id": str(oid)}).status_code == 201
    blocked = mutate(client, "POST", "/api/solicitudes", csrf, json={"libro_id": str(books[3])})
    assert blocked.status_code == 409 and blocked.get_json()["code"] == "request_limit"
    due = (date.today() + timedelta(days=14)).isoformat()
    staff_csrf = login(client, staff["apodo"])
    for oid in books[:3]:
        assert mutate(client, "POST", "/api/prestamos", staff_csrf, json={"libro_id": str(oid), "apodo": "avid", "vence_en": due}).status_code == 201
    fourth = mutate(client, "POST", "/api/prestamos", staff_csrf, json={"libro_id": str(books[4]), "apodo": "avid", "vence_en": due})
    assert fourth.status_code == 409 and fourth.get_json()["code"] == "loan_limit"
    csrf = login(client, student["apodo"])
    for oid in books[:3]:
        db.solicitudes.update_many({"libro_id": oid}, {"$set": {"estado": "aprobada"}})
    again = mutate(client, "POST", "/api/solicitudes", csrf, json={"libro_id": str(books[5])})
    assert again.status_code == 409 and again.get_json()["code"] == "loan_limit"
    own = client.get("/api/solicitudes?propios=1").get_json()["solicitudes"]
    assert {item["estado"] for item in own} == {"aprobada"}


def test_admin_user_directory_searches_filters_and_paginates(client, db):
    admin = create_user(db, "boss", role="admin")
    for index in range(7):
        create_user(db, f"alumno{index}")
    db.usuarios.update_many({"apodo": {"$in": ["alumno0", "alumno1"]}}, {"$set": {"grado": "5°"}})
    db.usuarios.update_one({"apodo": "alumno2"}, {"$set": {"activo": False}})
    create_user(db, "biblio", role="bibliotecario")
    login(client, admin["apodo"])
    everyone = client.get("/api/usuarios").get_json()
    assert everyone["total"] == 9 and everyone["paginas"] == 1
    page = client.get("/api/usuarios?por_pagina=4&pagina=3").get_json()
    assert page["paginas"] == 3 and [u["apodo"] for u in page["usuarios"]] == ["boss"]
    assert [u["apodo"] for u in client.get("/api/usuarios?q=ALUMNO&grado=5°").get_json()["usuarios"]] == ["alumno0", "alumno1"]
    assert [u["apodo"] for u in client.get("/api/usuarios?rol=bibliotecario").get_json()["usuarios"]] == ["biblio"]
    assert [u["apodo"] for u in client.get("/api/usuarios?activo=0").get_json()["usuarios"]] == ["alumno2"]
    assert client.get("/api/usuarios?rol=jefe").status_code == 422
    assert client.get("/api/usuarios?pagina=0").status_code == 422
