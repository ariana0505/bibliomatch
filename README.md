# BiblioMatch

Aplicación web para administrar una biblioteca escolar: catálogo, ejemplares, préstamos, solicitudes, opiniones, usuarios y herramientas de aprendizaje.

## Funciones

- Registro e inicio de sesión con cookie HttpOnly y protección CSRF.
- Roles verificados en el servidor: estudiante, bibliotecario y administrador.
- Catálogo con búsqueda, áreas, disponibilidad y varios ejemplares por título.
- Flujo completo de solicitud, aprobación (con fecha de devolución elegida por el bibliotecario), préstamo y devolución. Cada estudiante puede tener hasta 3 préstamos activos y 3 solicitudes pendientes; el perfil muestra el historial de solicitudes con su estado.
- Las portadas se guardan en MongoDB pero se sirven por `/portadas/<id>` con caché privada; los listados solo envían la referencia.
- Opiniones persistentes y progreso de aprendizaje por curso.
- Gestión de usuarios y estadísticas.
- Recomendaciones de lectura con IA, limitadas a libros disponibles del catálogo y adaptadas al grado, intereses e historial.
- Generación opcional de fichas de libros y guías de estudio con Groq.
- Tutor de IA con un máximo de 8 preguntas diarias por estudiante; cada respuesta usa el grado de la cuenta y el resultado guardado del test del curso.
- Validación de entradas, límites de tamaño, límite de intentos de login y encabezados de seguridad.

## Desarrollo local

Requisitos: Python 3.12 o posterior y MongoDB con transacciones (MongoDB Atlas o un replica set). Un servidor standalone no admite las operaciones de préstamo e inventario.

Para un MongoDB local nuevo con Docker:

```bash
docker run -d --name bibliomatch-mongo -p 127.0.0.1:27017:27017 mongo:8 --replSet rs0 --bind_ip_all
docker exec bibliomatch-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
python scripts/seed.py --samples
python api/index.py
```

Abre `http://127.0.0.1:5000`.

Antes de ejecutar el servidor, cambia `SECRET_KEY`, `ADMIN_APODO` y `ADMIN_PASSWORD` en `.env`. La cuenta anfitriona se crea si el apodo no existe. Si ya pertenece a otra cuenta, no se modifican sus permisos ni su contraseña; elige un apodo libre. Las cuentas anfitrionas existentes conservan su configuración. La contraseña debe tener al menos 12 caracteres.

## Variables de entorno

| Variable | Obligatoria | Uso |
|---|---:|---|
| `MONGO_URL` | Sí | Conexión a MongoDB. |
| `MONGO_DB` | No | Base de datos; por defecto `bibliomatch`. |
| `SECRET_KEY` | Sí | Firma de las sesiones. Usa un valor aleatorio largo. |
| `ADMIN_APODO` | Para inicializar | Apodo del primer administrador. |
| `ADMIN_PASSWORD` | Para inicializar | Contraseña inicial, mínimo 12 caracteres. |
| `GROQ_API_KEY` | No | Activa las herramientas de IA mediante Groq. |
| `GROQ_MODEL` | No | Modelo de Groq; recomendado: `openai/gpt-oss-20b`. |

Genera una clave de sesión con:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## Pruebas

### Biblioteca 3D (computadora)

Debajo del catálogo están «Entrar a la biblioteca 3D» y «Ver demostración». La galería conecta Literatura, Matemática, Ciencias, Tecnología, Historia, Arte, Referencia y Prestados. WASD mueve al lector, el ratón dirige la mirada, E abre la ficha y Esc pausa/libera el cursor. B abre el buscador y el directorio de áreas. «Ir al estante» lleva al lector junto al título y lo resalta en turquesa. Pulsa «Continuar recorrido» para capturar el ratón nuevamente.

`/library.html` usa la sesión actual y carga todas las páginas del catálogo mediante `formato=3d` (metadatos sin portadas ni sinopsis). Cada título ocupa un lugar único; se añaden pares de estanterías al superar 48 títulos por módulo. Los títulos con al menos un ejemplar disponible permanecen en su área; los de disponibilidad cero van a Prestados. Las fichas consultan la información completa y actual, incluyendo opiniones y solicitudes. La disponibilidad se actualiza cada minuto y con «Actualizar catálogo»; los cambios detectados en una ficha se aplican al cerrarla. Solo se mantienen en memoria gráfica las estanterías próximas al lector.

`/library.html?demo=1` funciona sin sesión ni base de datos, con 1.024 títulos de ejemplo (996 nuevos libros ficticios), incluyendo prestados y sin operaciones de escritura. Cada una de las ocho secciones tiene 128 títulos: dos estantes completos con cuatro baldas de 16 libros. Los libros generados tienen autores y descripciones identificados como ficticios; no se incorporan al catálogo real. Three.js 0.160.1 se sirve localmente, con su licencia en `public/vendor/three-LICENSE.txt`. Ejecuta `node --test tests/library.test.mjs` para verificar distribución, paginación, búsqueda y colisiones.

La vista requiere WebGL y captura del puntero en un navegador de computadora. Puede probarse la demostración sirviendo `public` con un servidor estático local.

Para incorporar explícitamente los 996 títulos ficticios al catálogo compartido por la web y la biblioteca 3D:

```bash
.venv/bin/python scripts/import_fictional_books.py
.venv/bin/python scripts/import_fictional_books.py --apply
```

El primer comando solo consulta; `--apply` inserta los títulos que faltan en la base configurada. Requiere Node.js para leer la colección de demostración. Conserva los libros existentes, no inventa ISBN, usuarios ni préstamos, y puede repetirse sin duplicar registros. Todos los ejemplares importados comienzan disponibles en su área; la sección Prestados depende exclusivamente de préstamos reales. Los registros quedan identificados con `ficticio: true` e `importacion: fictional-library-v1`, además de la indicación visible en autor y sinopsis. El catálogo publicado refleja la carga si utiliza la misma base configurada; esta operación no despliega archivos del frontend.

### Verificaciones

```bash
python -m pytest
```

Las pruebas usan una base MongoDB simulada y no modifican la base real.

Las pruebas de interfaz se ejecutan con `node --test tests/frontend.test.cjs`. Para comprobar transacciones y concurrencia contra un replica set de pruebas, configura `MONGO_TEST_URL` y ejecuta `python -m pytest tests/test_mongo_transactions.py`. Estas pruebas crean y eliminan únicamente una base temporal con prefijo `bibliomatch_test_`; nunca uses credenciales de producción. CI ejecuta ambas suites con un replica set desechable.

## Despliegue en Vercel

1. Configura `MONGO_URL`, `SECRET_KEY`, `ADMIN_APODO` y `ADMIN_PASSWORD` en las variables del proyecto.
2. Configura opcionalmente `GROQ_API_KEY` y `GROQ_MODEL`.
3. Despliega.
4. Abre `/api/salud`: debe devolver `estado: "ok"`.
5. Inicia sesión con el administrador configurado y cambia la contraseña si fue compartida por un canal temporal.

No publiques `.env`, contraseñas ni claves de API. Antes de usar el sistema con estudiantes, completa el responsable y contacto institucional en `public/privacy.html`, define copias de seguridad y revisa la política de conservación de datos.
