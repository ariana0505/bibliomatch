# BiblioMatch

Aplicación web para administrar una biblioteca escolar: catálogo, ejemplares, préstamos, solicitudes, opiniones, usuarios y herramientas de aprendizaje.

## Funciones

- Registro e inicio de sesión con cookie HttpOnly y protección CSRF.
- Roles verificados en el servidor: estudiante, bibliotecario y administrador.
- Catálogo con búsqueda, áreas, disponibilidad y varios ejemplares por título.
- Flujo completo de solicitud, aprobación, préstamo y devolución.
- Opiniones persistentes y progreso de aprendizaje por curso.
- Gestión de usuarios y estadísticas.
- Generación opcional de fichas de libros y guías de estudio con Anthropic.
- Validación de entradas, límites de tamaño, límite de intentos de login y encabezados de seguridad.

## Desarrollo local

Requisitos: Python 3.12 o posterior y MongoDB.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
python scripts/seed.py --samples
python api/index.py
```

Abre `http://127.0.0.1:5000`.

Antes de ejecutar el servidor, cambia `SECRET_KEY`, `ADMIN_APODO` y `ADMIN_PASSWORD` en `.env`. El administrador se crea una sola vez si todavía no existe ninguno. La contraseña debe tener al menos 12 caracteres.

## Variables de entorno

| Variable | Obligatoria | Uso |
|---|---:|---|
| `MONGO_URL` | Sí | Conexión a MongoDB. |
| `MONGO_DB` | No | Base de datos; por defecto `bibliomatch`. |
| `SECRET_KEY` | Sí | Firma de las sesiones. Usa un valor aleatorio largo. |
| `ADMIN_APODO` | Para inicializar | Apodo del primer administrador. |
| `ADMIN_PASSWORD` | Para inicializar | Contraseña inicial, mínimo 12 caracteres. |
| `ANTHROPIC_API_KEY` | No | Activa las herramientas de IA. |
| `ANTHROPIC_MODEL` | No | Modelo válido habilitado en la cuenta de Anthropic. |

Genera una clave de sesión con:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## Pruebas

```bash
python -m pytest
```

Las pruebas usan una base MongoDB simulada y no modifican la base real.

## Despliegue en Vercel

1. Configura `MONGO_URL`, `SECRET_KEY`, `ADMIN_APODO` y `ADMIN_PASSWORD` en las variables del proyecto.
2. Configura opcionalmente `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL`.
3. Despliega.
4. Abre `/api/salud`: debe devolver `estado: "ok"`.
5. Inicia sesión con el administrador configurado y cambia la contraseña si fue compartida por un canal temporal.

No publiques `.env`, contraseñas ni claves de API. Antes de usar el sistema con estudiantes, completa el responsable y contacto institucional en `public/privacy.html`, define copias de seguridad y revisa la política de conservación de datos.
