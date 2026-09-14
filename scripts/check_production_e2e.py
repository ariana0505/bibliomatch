"""Run a disposable end-to-end student/tutor check against a deployment."""

from __future__ import annotations

import json
import secrets
import sys
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import HTTPCookieProcessor, Request, build_opener


BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "https://bibliomatch.vercel.app").rstrip("/")
opener = build_opener(HTTPCookieProcessor(CookieJar()))
csrf = ""


def call(method: str, path: str, body: dict | None = None, *, with_csrf: bool = True):
    headers = {"Accept": "application/json"}
    payload = None
    if body is not None:
        payload = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if with_csrf and method not in {"GET", "HEAD"} and csrf:
        headers["X-CSRF-Token"] = csrf
    request = Request(BASE_URL + path, data=payload, headers=headers, method=method)
    try:
        response = opener.open(request, timeout=45)
        status = response.status
        content = response.read()
    except HTTPError as error:
        status = error.code
        content = error.read()
    return status, json.loads(content or b"{}")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    global csrf
    suffix = secrets.token_hex(4)
    nickname = f"e2e_{suffix}"
    password = f"Temporal-{secrets.token_urlsafe(12)}"
    registered = False
    checks: list[str] = []
    try:
        status, health = call("GET", "/api/salud")
        require(status == 200 and health.get("ia") is True, f"salud inesperada: {status} {health}")
        checks.append("salud+ia")

        status, registration = call(
            "POST",
            "/api/registro",
            {"apodo": nickname, "contrasena": password, "grado": "3°", "seccion": "E"},
            with_csrf=False,
        )
        require(status == 201, f"registro inesperado: {status} {registration}")
        csrf = registration["csrf"]
        registered = True
        checks.append("registro+sesion")

        status, missing_profile = call(
            "POST",
            "/api/generar",
            {"tipo": "material", "curso": "Matemática", "tema": "¿Qué es una función lineal?"},
        )
        require(
            status == 409 and missing_profile.get("code") == "learning_profile_required",
            f"perfil ausente no bloqueado: {status} {missing_profile}",
        )
        checks.append("bloqueo-sin-test")

        encoded_course = quote("Matemática", safe="")
        status, saved = call(
            "PUT", f"/api/progreso/{encoded_course}", {"estilo": "VK"}
        )
        require(status == 200 and saved.get("ok") is True, f"guardado inesperado: {status} {saved}")

        status, progress = call("GET", "/api/progreso")
        matching = [item for item in progress.get("progreso", []) if item.get("curso") == "Matemática"]
        require(status == 200 and matching and matching[0].get("estilo") == "VK", f"perfil no normalizado: {progress}")
        require(progress.get("preguntas_ia_restantes") == 8, f"cupo inicial inesperado: {progress}")
        checks.append("test+normalizacion")

        status, forbidden = call(
            "POST",
            "/api/generar",
            {"tipo": "material", "curso": "Matemática", "tema": "Pregunta sin CSRF"},
            with_csrf=False,
        )
        require(status == 403 and forbidden.get("code") == "csrf_failed", f"CSRF no bloqueado: {status} {forbidden}")
        checks.append("csrf")

        status, answer = call(
            "POST",
            "/api/generar",
            {"tipo": "material", "curso": "Matemática", "tema": "Explícame qué es una función lineal."},
        )
        material = answer.get("material", {})
        require(status == 200, f"tutor inesperado: {status} {answer}")
        require(answer.get("preguntas_restantes") == 7, f"contador inesperado: {answer}")
        require(all(str(material.get(field, "")).strip() for field in ("titulo", "resumen", "ejemplo", "actividad")), f"material incompleto: {material}")
        require(isinstance(material.get("puntos"), list) and material["puntos"], f"puntos inválidos: {material}")
        require(isinstance(material.get("preguntas"), list) and material["preguntas"], f"preguntas inválidas: {material}")
        checks.append("tutor-groq+contador")
    finally:
        if registered:
            status, deletion = call("DELETE", "/api/cuenta", {"contrasena": password})
            require(status == 200 and deletion.get("ok") is True, f"no se eliminó la cuenta temporal: {status} {deletion}")
            status, _ = call("GET", "/api/me")
            require(status == 401, f"la sesión temporal sigue activa: {status}")
            checks.append("limpieza")

    print("production_e2e=ok")
    print("checks=" + ",".join(checks))


if __name__ == "__main__":
    main()
