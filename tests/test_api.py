from __future__ import annotations

import json
import sys
from threading import RLock
from datetime import date, timedelta
from types import SimpleNamespace

import mongomock
import pytest
from werkzeug.security import generate_password_hash

import api.index as backend


@pytest.fixture()
def db():
    return mongomock.MongoClient(tz_aware=True).bibliomatch_test


@pytest.fixture()
def client(db):
    transaction_lock = RLock()
    def mock_transaction(callback):
        # Mongomock has no sessions: emulate isolation/rollback for unit tests.
        # Real MongoDB concurrency is covered separately in test_mongo_transactions.py.
        with transaction_lock:
            snapshot = {name: list(db[name].find()) for name in db.list_collection_names()}
            try:
                return callback(None)
            except Exception:
                for name in db.list_collection_names():
                    db[name].delete_many({})
                    if snapshot.get(name):
                        db[name].insert_many(snapshot[name])
                raise
    backend.app.config.update(
        TESTING=True,
        TEST_DB=db,
        SECRET_KEY="test-secret-that-is-not-used-outside-tests",
        SECRET_KEY_CONFIGURED=True,
        SESSION_COOKIE_SECURE=False,
        TEST_TRANSACTION_RUNNER=mock_transaction,
    )
    backend._indexes_ready = False
    backend.ensure_indexes(db)
    with backend.app.test_client() as test_client:
        yield test_client
    backend.app.config.pop("TEST_DB", None)
    backend.app.config.pop("TEST_TRANSACTION_RUNNER", None)


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


def test_catalog_search_ignores_accents_and_uses_extended_metadata(client, db):
    user = create_user(db, "lectora")
    login(client, user["apodo"])
    now = backend.utcnow()
    books = [
        {
            "titulo": "Álgebra cósmica",
            "autor": "Zoé Salazar",
            "isbn": "978-1-4028-9462-6",
            "area": "MAT",
            "ubicacion": "Estante Ñandú",
            "donante": "Fundación Cálculo",
            "ejemplares_total": 1,
            "creado_en": now - timedelta(days=2),
        },
        {
            "titulo": "Crónicas del océano",
            "autor": "Ana Beltrán",
            "isbn": "9791399000993",
            "area": "LIT",
            "ubicacion": "Sala Norte",
            "donante": "Familia Prado",
            "ejemplares_total": 3,
            "creado_en": now,
        },
    ]
    inserted = db.libros.insert_many(books).inserted_ids
    db.prestamos.insert_one(
        {
            "libro_id": inserted[0],
            "usuario_id": user["_id"],
            "titulo": books[0]["titulo"],
            "apodo": user["apodo"],
            "estado": "activo",
            "prestado_en": now,
            "vence_en": (date.today() + timedelta(days=14)).isoformat(),
        }
    )

    assert client.get("/api/libros?q=algebra").get_json()["libros"][0]["titulo"] == "Álgebra cósmica"
    assert client.get("/api/libros?q=fundacion").get_json()["total"] == 1
    assert client.get("/api/libros?q=nandu").get_json()["total"] == 1
    assert client.get("/api/libros?q=9781402894626").get_json()["total"] == 1

    available = client.get("/api/libros?disponible=1&orden=disponibilidad").get_json()["libros"]
    assert [book["titulo"] for book in available] == ["Crónicas del océano"]
    recent = client.get("/api/libros?orden=recientes").get_json()["libros"]
    assert [book["titulo"] for book in recent] == ["Crónicas del océano", "Álgebra cósmica"]
    assert client.get("/api/libros?orden=desconocido").status_code == 422


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


def test_request_reaches_admin_and_second_student_waits_for_the_only_copy(client, db):
    create_user(db, "ana")
    create_user(db, "beatriz")
    create_user(db, "directora", "admin", "administrador-seguro")

    admin_csrf = login(client, "directora", "administrador-seguro")
    book = mutate(
        client,
        "POST",
        "/api/libros",
        admin_csrf,
        json=book_payload(titulo="Libro de ejemplar único", ejemplares_total=1),
    ).get_json()["libro"]

    with client.session_transaction() as current:
        current.clear()
    ana_csrf = login(client, "ana")
    requested = mutate(
        client,
        "POST",
        "/api/solicitudes",
        ana_csrf,
        json={"libro_id": book["id"]},
    )
    assert requested.status_code == 201
    request_id = requested.get_json()["solicitud"]["id"]

    duplicate = mutate(
        client,
        "POST",
        "/api/solicitudes",
        ana_csrf,
        json={"libro_id": book["id"]},
    )
    assert duplicate.status_code == 409
    assert duplicate.get_json()["code"] == "duplicate_request"

    with client.session_transaction() as current:
        current.clear()
    admin_csrf = login(client, "directora", "administrador-seguro")
    pending = client.get("/api/solicitudes?estado=pendiente").get_json()["solicitudes"]
    assert [(item["id"], item["apodo"], item["titulo"]) for item in pending] == [
        (request_id, "ana", "Libro de ejemplar único")
    ]

    due = (date.today() + timedelta(days=21)).isoformat()
    approved = mutate(
        client,
        "POST",
        f"/api/solicitudes/{request_id}/resolver",
        admin_csrf,
        json={"accion": "aprobar", "vence_en": due},
    )
    assert approved.status_code == 200
    loan_id = approved.get_json()["prestamo"]["id"]

    with client.session_transaction() as current:
        current.clear()
    beatriz_csrf = login(client, "beatriz")
    unavailable = mutate(
        client,
        "POST",
        "/api/solicitudes",
        beatriz_csrf,
        json={"libro_id": book["id"]},
    )
    assert unavailable.status_code == 409
    assert unavailable.get_json() == {
        "code": "book_unavailable",
        "error": "No quedan ejemplares disponibles.",
    }

    with client.session_transaction() as current:
        current.clear()
    admin_csrf = login(client, "directora", "administrador-seguro")
    assert client.get("/api/solicitudes?estado=pendiente").get_json()["solicitudes"] == []
    returned = mutate(client, "POST", f"/api/prestamos/{loan_id}/devolver", admin_csrf, json={})
    assert returned.status_code == 200

    with client.session_transaction() as current:
        current.clear()
    beatriz_csrf = login(client, "beatriz")
    available_again = mutate(
        client,
        "POST",
        "/api/solicitudes",
        beatriz_csrf,
        json={"libro_id": book["id"]},
    )
    assert available_again.status_code == 201

    with client.session_transaction() as current:
        current.clear()
    login(client, "directora", "administrador-seguro")
    new_pending = client.get("/api/solicitudes?estado=pendiente").get_json()["solicitudes"]
    assert len(new_pending) == 1
    assert new_pending[0]["apodo"] == "beatriz"


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
    db.ia_preguntas.insert_one(
        {"_id": backend.ai_question_usage_key(user["_id"]), "usuario_id": user["_id"], "cantidad": 2}
    )
    db.ia_uso.insert_one(
        {"_id": f"{user['_id']}:{backend.today_iso()}", "usuario_id": user["_id"], "cantidad": 2}
    )
    response = mutate(
        client,
        "DELETE",
        "/api/cuenta",
        csrf,
        json={"contrasena": "segura123"},
    )
    assert response.status_code == 200
    assert db.usuarios.find_one({"_id": user["_id"]}) is None
    assert db.ia_preguntas.count_documents({"usuario_id": user["_id"]}) == 0
    assert db.ia_uso.count_documents({"usuario_id": user["_id"]}) == 0
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


def test_progress_normalizes_vercel_encoded_course_names(client, db):
    user = create_user(db, "estudiante_curso_url")
    csrf = login(client, user["apodo"])
    response = mutate(
        client,
        "PUT",
        "/api/progreso/Matem%25C3%25A1tica",
        csrf,
        json={"estilo": "R"},
    )
    assert response.status_code == 200
    stored = db.progreso.find_one({"usuario_id": user["_id"]})
    assert stored["curso"] == "Matemática"
    assert client.get("/api/progreso").get_json()["progreso"][0]["curso"] == "Matemática"

    # Los resultados creados antes de la corrección también deben ser reconocidos.
    db.progreso.update_one({"_id": stored["_id"]}, {"$set": {"curso": "Matem%C3%A1tica"}})
    legacy = backend.find_learning_progress(db, user["_id"], "Matemática")
    assert legacy is not None
    assert legacy["estilo"] == "R"
    migrated = mutate(
        client,
        "PUT",
        "/api/progreso/Matem%25C3%25A1tica",
        csrf,
        json={"estilo": "VK"},
    )
    assert migrated.status_code == 200
    stored = db.progreso.find_one({"_id": stored["_id"]})
    assert stored["curso"] == "Matemática"
    assert stored["estilo"] == "VK"


def test_session_reports_if_ai_is_available(client, db, monkeypatch):
    create_user(db, "estudiante_ia_estado")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_MODEL", raising=False)
    response = client.post(
        "/api/login",
        json={"apodo": "estudiante_ia_estado", "contrasena": "segura123"},
    )
    assert response.status_code == 200
    assert response.get_json()["ia"] is False

    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")
    assert client.get("/api/me").get_json()["ia"] is True


def test_ai_material_uses_student_grade_and_learning_result(client, db, monkeypatch):
    student = create_user(db, "estudiante_ia")
    db.progreso.insert_one(
        {
            "usuario_id": student["_id"],
            "curso": "Física",
            "estilo": "VK",
            "actualizado_en": backend.utcnow(),
        }
    )
    csrf = login(client, "estudiante_ia")
    sent_messages = []

    class FakeCompletions:
        def create(self, **kwargs):
            sent_messages.append(kwargs["messages"])
            assert kwargs["response_format"] == {"type": "json_object"}
            payload = {
                "titulo": "Leyes de Newton",
                "resumen": "Explicación adaptada.",
                "ejemplo": "Un carrito acelera al empujarlo.",
                "actividad": "Prueba con un objeto liviano.",
                "puntos": ["Fuerza y aceleración"],
                "preguntas": ["¿Qué ocurre al aumentar la fuerza?"],
            }
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))]
            )

    class FakeGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")
    monkeypatch.setitem(sys.modules, "groq", SimpleNamespace(Groq=FakeGroq))

    response = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "material", "curso": "Física", "estilo": "A", "tema": "Leyes de Newton"},
    )
    assert response.status_code == 200
    assert sent_messages[0][0]["role"] == "system"
    assert "3°" in sent_messages[0][0]["content"]
    assert "visual" in sent_messages[0][0]["content"]
    assert "práctico" in sent_messages[0][0]["content"]
    assert "auditivo" not in sent_messages[0][0]["content"]
    assert sent_messages[0][1]["role"] == "user"
    assert "Física" in sent_messages[0][1]["content"]
    assert "Leyes de Newton" in sent_messages[0][1]["content"]
    assert response.get_json()["material"]["ejemplo"] == "Un carrito acelera al empujarlo."
    assert response.get_json()["preguntas_restantes"] == 7


def test_ai_material_enforces_eight_daily_questions_and_saved_profile(client, db, monkeypatch):
    student = create_user(db, "estudiante_limite_ia")
    csrf = login(client, student["apodo"])
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")

    without_profile = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "material", "curso": "Química", "tema": "La tabla periódica"},
    )
    assert without_profile.status_code == 409
    assert without_profile.get_json()["code"] == "learning_profile_required"

    db.progreso.insert_one(
        {"usuario_id": student["_id"], "curso": "Química", "estilo": "R", "actualizado_en": backend.utcnow()}
    )
    class FailingCompletions:
        def create(self, **_kwargs):
            raise RuntimeError("simulated provider error")

    class FailingGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=FailingCompletions())

    monkeypatch.setitem(sys.modules, "groq", SimpleNamespace(Groq=FailingGroq))
    failed = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "material", "curso": "Química", "tema": "La tabla periódica"},
    )
    assert failed.status_code == 502
    assert client.get("/api/progreso").get_json()["preguntas_ia_restantes"] == 8

    class EmptyCompletions:
        def create(self, **_kwargs):
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))]
            )

    class EmptyGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=EmptyCompletions())

    monkeypatch.setitem(sys.modules, "groq", SimpleNamespace(Groq=EmptyGroq))
    malformed = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "material", "curso": "Química", "tema": "La tabla periódica"},
    )
    assert malformed.status_code == 502
    assert client.get("/api/progreso").get_json()["preguntas_ia_restantes"] == 8

    db.ia_preguntas.update_one(
        {"_id": backend.ai_question_usage_key(student["_id"])},
        {"$set": {"cantidad": 8, "expira_en": backend.utcnow() + timedelta(days=2)}},
        upsert=True,
    )
    at_limit = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "material", "curso": "Química", "tema": "La tabla periódica"},
    )
    assert at_limit.status_code == 429
    assert at_limit.get_json()["code"] == "ai_question_limit"
    assert client.get("/api/progreso").get_json()["preguntas_ia_restantes"] == 0


def test_ai_question_limit_boundary_and_next_day_reset(client, db, monkeypatch):
    student = create_user(db, "estudiante_ocho")
    db.progreso.insert_one(
        {"usuario_id": student["_id"], "curso": "Biología", "estilo": "AK", "actualizado_en": backend.utcnow()}
    )
    csrf = login(client, student["apodo"])
    calls = []

    class FakeCompletions:
        def create(self, **kwargs):
            calls.append(kwargs)
            payload = {
                "titulo": "Respuesta adaptada",
                "resumen": "Una explicación clara para el estudiante.",
                "ejemplo": "Un ejemplo.",
                "actividad": "Una actividad.",
                "puntos": ["Idea clave"],
                "preguntas": ["Pregunta de práctica"],
            }
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))]
            )

    class FakeGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")
    monkeypatch.setitem(sys.modules, "groq", SimpleNamespace(Groq=FakeGroq))

    for number in range(1, 9):
        response = mutate(
            client,
            "POST",
            "/api/generar",
            csrf,
            json={"tipo": "material", "curso": "Biología", "tema": f"Pregunta {number}"},
        )
        assert response.status_code == 200
        assert response.get_json()["preguntas_restantes"] == 8 - number

    ninth = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "material", "curso": "Biología", "tema": "Pregunta 9"},
    )
    assert ninth.status_code == 429
    assert ninth.get_json()["code"] == "ai_question_limit"
    assert len(calls) == 8
    assert db.ia_uso.find_one({"_id": f"{student['_id']}:{backend.today_iso()}"})["cantidad"] == 8

    monkeypatch.setattr(backend, "today_iso", lambda: "2099-01-02")
    next_day = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "material", "curso": "Biología", "tema": "Nueva pregunta"},
    )
    assert next_day.status_code == 200
    assert next_day.get_json()["preguntas_restantes"] == 7
    assert len(calls) == 9


def test_ai_book_uses_isbn_and_requires_staff(client, db, monkeypatch):
    student = create_user(db, "lectora_ia")
    csrf = login(client, student["apodo"])
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")

    forbidden = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "libro", "titulo": "El principito", "isbn": "9780156013925"},
    )
    assert forbidden.status_code == 403

    with client.session_transaction() as current:
        current.clear()
    admin = create_user(db, "bibliotecaria_ia", "bibliotecario")
    csrf = login(client, admin["apodo"])
    prompts = []

    class FakeCompletions:
        def create(self, **kwargs):
            prompts.append(kwargs["messages"][0]["content"])
            payload = {"autor": "Antoine de Saint-Exupéry", "area": "LIT", "sinopsis": "Una historia escolar."}
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))]
            )

    class FakeGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "groq", SimpleNamespace(Groq=FakeGroq))
    response = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "libro", "titulo": "El principito", "isbn": "9780156013925"},
    )
    assert response.status_code == 200
    assert "9780156013925" in prompts[0]
    assert response.get_json()["autor"] == "Antoine de Saint-Exupéry"


def test_ai_recommendations_are_grounded_in_available_catalog(client, db, monkeypatch):
    student = create_user(db, "lectora_recomendaciones")
    csrf = login(client, student["apodo"])
    books = []
    for index, area in enumerate(["LIT", "CIE", "HIS", "ART", "TEC"]):
        document = book_payload(
            titulo=f"Libro {index}",
            isbn=f"97913990010{index}9",
            area=area,
            sinopsis=f"Sinopsis escolar {index}",
            ejemplares_total=1,
        )
        document["creado_en"] = backend.utcnow()
        document["_id"] = db.libros.insert_one(document).inserted_id
        books.append(document)

    # El primer libro pertenece al historial y el último no tiene ejemplares libres.
    db.prestamos.insert_many(
        [
            {
                "libro_id": books[0]["_id"],
                "usuario_id": student["_id"],
                "titulo": books[0]["titulo"],
                "estado": "devuelto",
                "prestado_en": backend.utcnow(),
            },
            {
                "libro_id": books[-1]["_id"],
                "usuario_id": create_user(db, "otra_lectora")["_id"],
                "titulo": books[-1]["titulo"],
                "estado": "activo",
                "prestado_en": backend.utcnow(),
            },
        ]
    )
    prompts = []

    class FakeCompletions:
        def create(self, **kwargs):
            prompt = kwargs["messages"][0]["content"]
            prompts.append(prompt)
            context = json.loads(prompt.split("Contexto:\n", 1)[1])
            valid_id = context["catalogo_disponible"][0]["id"]
            payload = {
                "introduccion": "Elegí opciones del catálogo.",
                "recomendaciones": [
                    {"id": "000000000000000000000000", "razon": "Inventada"},
                    {"id": valid_id, "razon": "Coincide con tus intereses."},
                    {"id": valid_id, "razon": "Duplicada"},
                ],
            }
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))]
            )

    class FakeGroq:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")
    monkeypatch.setitem(sys.modules, "groq", SimpleNamespace(Groq=FakeGroq))
    response = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "recomendaciones", "intereses": "aventuras y ciencia"},
    )

    assert response.status_code == 200
    recommendations = response.get_json()["recomendaciones"]
    assert len(recommendations) == 1
    assert recommendations[0]["libro"]["titulo"] not in {books[0]["titulo"], books[-1]["titulo"]}
    assert recommendations[0]["libro"]["disponibles"] == 1
    assert "lectora_recomendaciones" not in prompts[0]
    assert "3°" in prompts[0]


def test_ai_recommendations_require_catalog_and_interests(client, db, monkeypatch):
    create_user(db, "lectora_sin_catalogo")
    csrf = login(client, "lectora_sin_catalogo")
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")

    missing_interests = mutate(
        client, "POST", "/api/generar", csrf, json={"tipo": "recomendaciones", "intereses": ""}
    )
    assert missing_interests.status_code == 422

    empty_catalog = mutate(
        client,
        "POST",
        "/api/generar",
        csrf,
        json={"tipo": "recomendaciones", "intereses": "misterio"},
    )
    assert empty_catalog.status_code == 409
    assert empty_catalog.get_json()["code"] == "empty_catalog"


def test_security_headers_are_present(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'self'" in response.headers["Content-Security-Policy"]
