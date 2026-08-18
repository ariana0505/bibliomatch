from __future__ import annotations

from datetime import date, timedelta

import mongomock
import pytest
from werkzeug.security import generate_password_hash

import api.index as backend


@pytest.fixture()
def db():
    return mongomock.MongoClient(tz_aware=True).bibliomatch_test


@pytest.fixture()
def client(db):
    backend.app.config.update(
        TESTING=True,
        TEST_DB=db,
        SECRET_KEY="test-secret-that-is-not-used-outside-tests",
        SECRET_KEY_CONFIGURED=True,
        SESSION_COOKIE_SECURE=False,
    )
    backend._indexes_ready = False
    backend.ensure_indexes(db)
    with backend.app.test_client() as test_client:
        yield test_client
    backend.app.config.pop("TEST_DB", None)


def create_user(db, apodo: str, role: str = "estudiante", password: str = "segura123"):
    document = {
        "apodo": apodo,
        "apodo_norm": apodo.casefold(),
        "contrasena_hash": generate_password_hash(password),
        "rol": role,
        "activo": True,
        "grado": "3°" if role == "estudiante" else None,
        "seccion": "A" if role == "estudiante" else None,
        "auth_version": 1,
        "creado_en": backend.utcnow(),
    }
    document["_id"] = db.usuarios.insert_one(document).inserted_id
    return document


def create_host(db, apodo: str = "anfitriona", password: str = "anfitriona-segura"):
    user = create_user(db, apodo, "admin", password)
    db.usuarios.update_one({"_id": user["_id"]}, {"$set": {"es_anfitrion": True}})
    user["es_anfitrion"] = True
    return user


def login(client, apodo: str, password: str = "segura123") -> str:
    response = client.post("/api/login", json={"apodo": apodo, "contrasena": password})
    assert response.status_code == 200, response.get_json()
    return response.get_json()["csrf"]


def mutate(client, method: str, path: str, csrf: str, **kwargs):
    headers = kwargs.pop("headers", {})
    headers["X-CSRF-Token"] = csrf
    return client.open(path, method=method, headers=headers, **kwargs)


def book_payload(**overrides):
    data = {
        "titulo": "El principito",
        "autor": "Antoine de Saint-Exupéry",
        "isbn": "9780156013925",
        "area": "LIT",
        "sinopsis": "Una historia sobre la amistad.",
        "foto": "",
        "ubicacion": "Estante 1",
        "donante": "Colegio",
        "ejemplares_total": 2,
    }
    data.update(overrides)
    return data


def test_invalid_requests_return_json_errors(client):
    response = client.post("/api/login", json={})
    assert response.status_code == 422
    assert response.is_json

    response = client.post("/api/registro", data="not-json", content_type="text/plain")
    assert response.status_code == 415
    assert response.get_json()["code"] == "json_required"


def test_register_creates_student_session(client, db):
    response = client.post(
        "/api/registro",
        json={"apodo": "nueva_lectora", "contrasena": "una-clave-segura", "grado": "2°", "seccion": "B"},
    )
    assert response.status_code == 201
    assert response.get_json()["usuario"]["rol"] == "estudiante"
    assert db.usuarios.find_one({"apodo_norm": "nueva_lectora"})["contrasena_hash"] != "una-clave-segura"

    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.get_json()["usuario"]["apodo"] == "nueva_lectora"


def test_registration_validates_password_and_duplicate(client):
    payload = {"apodo": "lector_uno", "contrasena": "corta", "grado": "1°", "seccion": "A"}
    assert client.post("/api/registro", json=payload).status_code == 422
    payload["contrasena"] = "suficiente123"
    assert client.post("/api/registro", json=payload).status_code == 201
    client.post("/api/logout", json={})  # Deliberately missing CSRF does not end the session.
    with client.session_transaction() as current:
        current.clear()
    assert client.post("/api/registro", json=payload).status_code == 409


def test_csrf_and_server_side_roles_protect_book_creation(client, db):
    create_user(db, "estudiante")
    csrf = login(client, "estudiante")
    assert client.post("/api/libros", json=book_payload()).status_code == 403
    response = mutate(client, "POST", "/api/libros", csrf, json=book_payload())
    assert response.status_code == 403

    with client.session_transaction() as current:
        current.clear()
    create_user(db, "bibliotecaria", "bibliotecario")
    staff_csrf = login(client, "bibliotecaria")
    assert client.post("/api/libros", json=book_payload()).status_code == 403
    response = mutate(client, "POST", "/api/libros", staff_csrf, json=book_payload())
    assert response.status_code == 201


def test_complete_request_loan_and_return_flow(client, db):
    create_user(db, "ana")
    create_user(db, "bibliotecaria", "bibliotecario")
    staff_csrf = login(client, "bibliotecaria")
    book_response = mutate(client, "POST", "/api/libros", staff_csrf, json=book_payload(ejemplares_total=1))
    book_id = book_response.get_json()["libro"]["id"]

    with client.session_transaction() as current:
        current.clear()
    student_csrf = login(client, "ana")
    request_response = mutate(
        client, "POST", "/api/solicitudes", student_csrf, json={"libro_id": book_id}
    )
    assert request_response.status_code == 201
    request_id = request_response.get_json()["solicitud"]["id"]

    with client.session_transaction() as current:
        current.clear()
    staff_csrf = login(client, "bibliotecaria")
    due = (date.today() + timedelta(days=21)).isoformat()
    approved = mutate(
        client,
        "POST",
        f"/api/solicitudes/{request_id}/resolver",
        staff_csrf,
        json={"accion": "aprobar", "vence_en": due},
    )
    assert approved.status_code == 200
    loan_id = approved.get_json()["prestamo"]["id"]

    books = client.get("/api/libros").get_json()["libros"]
    assert books[0]["disponibles"] == 0
    assert books[0]["prestados"] == 1

    returned = mutate(client, "POST", f"/api/prestamos/{loan_id}/devolver", staff_csrf, json={})
    assert returned.status_code == 200
    assert client.get("/api/libros").get_json()["libros"][0]["disponibles"] == 1


def test_opinion_is_upserted_and_visible(client, db):
    create_user(db, "lectora")
    create_user(db, "bibliotecaria", "bibliotecario")
    staff_csrf = login(client, "bibliotecaria")
    book_id = mutate(client, "POST", "/api/libros", staff_csrf, json=book_payload()).get_json()["libro"]["id"]
    with client.session_transaction() as current:
        current.clear()

    csrf = login(client, "lectora")
    first = mutate(
        client,
        "PUT",
        f"/api/libros/{book_id}/opinion",
        csrf,
        json={"estrellas": 4, "comentario": "Muy bueno"},
    )
    assert first.status_code == 200
    mutate(
        client,
        "PUT",
        f"/api/libros/{book_id}/opinion",
        csrf,
        json={"estrellas": 5, "comentario": "Excelente"},
    )
    opinions = client.get(f"/api/libros/{book_id}/opiniones").get_json()["opiniones"]
    assert len(opinions) == 1
    assert opinions[0]["estrellas"] == 5
    assert opinions[0]["propia"] is True


def test_admin_can_manage_roles_but_not_lock_self_out(client, db):
    admin = create_user(db, "directora", "admin", "administrador-seguro")
    student = create_user(db, "lectora")
    csrf = login(client, "directora", "administrador-seguro")

    promoted = mutate(
        client,
        "PATCH",
        f"/api/usuarios/{student['_id']}",
        csrf,
        json={"rol": "bibliotecario"},
    )
    assert promoted.status_code == 200
    assert db.usuarios.find_one({"_id": student["_id"]})["rol"] == "bibliotecario"

    self_demote = mutate(
        client,
        "PATCH",
        f"/api/usuarios/{admin['_id']}",
        csrf,
        json={"rol": "estudiante"},
    )
    assert self_demote.status_code == 409

    reset = mutate(
        client,
        "POST",
        f"/api/usuarios/{student['_id']}/restablecer-contrasena",
        csrf,
        json={},
    )
    assert reset.status_code == 200
    temporary = reset.get_json()["contrasena_temporal"]
    assert len(temporary) >= 12
    with client.session_transaction() as current:
        current.clear()
    relogin = client.post("/api/login", json={"apodo": "lectora", "contrasena": temporary})
    assert relogin.status_code == 200
    assert relogin.get_json()["usuario"]["debe_cambiar_contrasena"] is True


def test_only_host_can_grant_and_revoke_admin_access(client, db):
    host = create_host(db)
    delegated = create_user(db, "delegada", "admin", "delegada-segura")
    student = create_user(db, "candidata")

    delegated_csrf = login(client, "delegada", "delegada-segura")
    denied = mutate(
        client,
        "PATCH",
        f"/api/usuarios/{student['_id']}",
        delegated_csrf,
        json={"rol": "admin"},
    )
    assert denied.status_code == 403

    cannot_disable_admin = mutate(
        client,
        "PATCH",
        f"/api/usuarios/{host['_id']}",
        delegated_csrf,
        json={"activo": False},
    )
    assert cannot_disable_admin.status_code == 409

    cannot_reset_host = mutate(
        client,
        "POST",
        f"/api/usuarios/{host['_id']}/restablecer-contrasena",
        delegated_csrf,
        json={},
    )
    assert cannot_reset_host.status_code == 403

    with client.session_transaction() as current:
        current.clear()
    host_csrf = login(client, "anfitriona", "anfitriona-segura")
    promoted = mutate(
        client,
        "PATCH",
        f"/api/usuarios/{student['_id']}",
        host_csrf,
        json={"rol": "admin"},
    )
    assert promoted.status_code == 200
    assert db.usuarios.find_one({"_id": student["_id"]})["rol"] == "admin"

    revoked = mutate(
        client,
        "PATCH",
        f"/api/usuarios/{delegated['_id']}",
        host_csrf,
        json={"rol": "estudiante"},
    )
    assert revoked.status_code == 200
    assert db.usuarios.find_one({"_id": delegated["_id"]})["rol"] == "estudiante"

    protected = mutate(
        client,
        "PATCH",
        f"/api/usuarios/{host['_id']}",
        host_csrf,
        json={"rol": "estudiante"},
    )
    assert protected.status_code == 409


def test_student_can_delete_account_without_active_loans(client, db):
    user = create_user(db, "temporal")
    csrf = login(client, "temporal")
    response = mutate(
        client,
        "DELETE",
        "/api/cuenta",
        csrf,
        json={"contrasena": "segura123"},
    )
    assert response.status_code == 200
    assert db.usuarios.find_one({"_id": user["_id"]}) is None
    assert client.get("/api/me").status_code == 401


def test_progress_persists_without_hardcoded_dates(client, db):
    create_user(db, "estudiante")
    csrf = login(client, "estudiante")
    saved = mutate(
        client,
        "PUT",
        "/api/progreso/F%C3%ADsica",
        csrf,
        json={"estilo": "VK", "puntaje": 4, "total": 5},
    )
    assert saved.status_code == 200
    progress = client.get("/api/progreso").get_json()["progreso"]
    assert progress[0]["curso"] == "Física"
    assert progress[0]["mejor_puntaje"] == 4
    assert progress[0]["intentos"] == 1


def test_security_headers_are_present(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'self'" in response.headers["Content-Security-Policy"]
