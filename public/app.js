"use strict";

const AREAS = {
  MAT: ["Matemática", "#2563eb"],
  CIE: ["Ciencias", "#15803d"],
  TEC: ["Tecnología", "#a16207"],
  LIT: ["Literatura", "#dc2626"],
  HIS: ["Historia", "#92400e"],
  ART: ["Arte", "#9333ea"],
  REF: ["Referencia", "#64748b"],
};

const COURSES = [
  ["Matemática", "🔢"], ["Comunicación", "🗣️"], ["Lectura", "📚"],
  ["Inglés", "🇬🇧"], ["Biología", "🧬"], ["Química", "⚗️"],
  ["Física", "🍎"], ["CCSS", "🏛️"], ["Arte", "🎨"],
];

const QUIZ = [
  ["Cuando estudias un tema nuevo, ¿qué te ayuda primero?", { V: "Ver un esquema o video", A: "Escuchar una explicación", R: "Leer y tomar apuntes", K: "Resolver un ejemplo" }],
  ["Para recordar una idea importante prefieres…", { V: "Usar colores y diagramas", A: "Repetirla en voz alta", R: "Escribirla con tus palabras", K: "Relacionarla con una actividad" }],
  ["Si debes llegar a un lugar nuevo eliges…", { V: "Mirar un mapa", A: "Pedir indicaciones habladas", R: "Leer los pasos", K: "Ir probando el camino" }],
  ["En una exposición grupal disfrutas más…", { V: "Diseñar las diapositivas", A: "Explicar al público", R: "Redactar el guion", K: "Hacer una demostración" }],
  ["Una clase se te queda mejor cuando…", { V: "Tiene imágenes", A: "Hay conversación", R: "Tiene un texto claro", K: "Incluye práctica" }],
  ["Al usar una aplicación nueva sueles…", { V: "Mirar capturas", A: "Pedir que te expliquen", R: "Leer el tutorial", K: "Probar los botones" }],
  ["Para un examen con poco tiempo prefieres…", { V: "Repasar mapas mentales", A: "Explicarte el tema", R: "Releer tus notas", K: "Resolver preguntas" }],
  ["Cuando aparece una palabra desconocida…", { V: "Buscas una imagen", A: "Preguntas su significado", R: "Lees la definición", K: "La usas en una frase" }],
];

const STYLE_NAMES = { V: "Visual", A: "Auditivo", R: "Lectoescritor", K: "Práctico" };

const state = {
  user: null,
  csrf: "",
  view: "catalog",
  books: [],
  loans: [],
  requests: [],
  users: [],
  progress: [],
  stats: null,
  selectedBook: null,
  opinions: [],
  course: null,
  style: "",
  material: null,
  loading: false,
};

const byId = (id) => document.getElementById(id);
const panels = () => document.querySelectorAll("[data-panel]");
const isStaff = () => ["bibliotecario", "admin"].includes(state.user?.rol);
const isAdmin = () => state.user?.rol === "admin";
const isHost = () => Boolean(state.user?.es_anfitrion);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function futureDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function showToast(message, error = false) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function setFormError(formId, message = "") {
  const element = document.querySelector(`[data-error-for="${formId}"]`);
  if (element) element.textContent = message;
}

async function api(path, options = {}) {
  const settings = { credentials: "same-origin", ...options };
  settings.headers = { Accept: "application/json", ...(options.headers || {}) };
  if (options.body && typeof options.body !== "string") {
    settings.headers["Content-Type"] = "application/json";
    settings.body = JSON.stringify(options.body);
  }
  if (settings.method && !["GET", "HEAD"].includes(settings.method.toUpperCase()) && state.csrf) {
    settings.headers["X-CSRF-Token"] = state.csrf;
  }
  const response = await fetch(path, settings);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    const error = new Error(data.error || `Error ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    if (response.status === 401 && path !== "/api/login") showAuth();
    throw error;
  }
  return data;
}

function showAuth(tab = "login") {
  state.user = null;
  state.csrf = "";
  byId("app-shell").classList.add("hidden");
  byId("auth-screen").classList.remove("hidden");
  switchAuthTab(tab);
}

function showApp() {
  byId("auth-screen").classList.add("hidden");
  byId("app-shell").classList.remove("hidden");
  byId("user-chip").textContent = `${state.user.apodo} · ${state.user.rol}`;
  byId("management-nav").classList.toggle("hidden", !isStaff());
  changeView("catalog");
  if (state.user.debe_cambiar_contrasena) {
    showToast("Debes reemplazar la contraseña temporal.");
    setTimeout(() => byId("password-dialog").showModal(), 250);
  }
}

function switchAuthTab(tab) {
  const login = tab === "login";
  byId("login-form").classList.toggle("hidden", !login);
  byId("register-form").classList.toggle("hidden", login);
  byId("login-tab").classList.toggle("active", login);
  byId("register-tab").classList.toggle("active", !login);
  byId("login-tab").setAttribute("aria-selected", String(login));
  byId("register-tab").setAttribute("aria-selected", String(!login));
  setFormError("login-form");
  setFormError("register-form");
}

async function boot() {
  applyTheme(localStorage.getItem("bibliomatch-theme") || "light");
  try {
    const data = await api("/api/me");
    state.user = data.usuario;
    state.csrf = data.csrf;
    showApp();
  } catch (error) {
    showAuth();
    if (error.status === 503) setFormError("login-form", error.message);
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  byId("theme-toggle").textContent = theme === "dark" ? "☀️" : "🌙";
  byId("theme-toggle").setAttribute("aria-label", theme === "dark" ? "Usar tema claro" : "Usar tema oscuro");
  localStorage.setItem("bibliomatch-theme", theme);
}

function changeView(view) {
  if (view === "management" && !isStaff()) view = "catalog";
  state.view = view;
  panels().forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== view));
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view && button.classList.contains("nav-item"));
  });
  if (view === "catalog") loadBooks();
  if (view === "learning") loadLearning();
  if (view === "management") loadManagement();
  if (view === "profile") loadProfile();
  byId("contenido").focus();
}

async function loadBooks(query = "") {
  const view = byId("catalog-view");
  view.innerHTML = catalogShell('<div class="loading">Cargando catálogo…</div>');
  try {
    const data = await api(`/api/libros${query}`);
    state.books = data.libros;
    renderCatalog();
  } catch (error) {
    view.innerHTML = catalogShell(`<div class="error-panel">${escapeHtml(error.message)}</div>`);
  }
}

function catalogShell(content) {
  return `
    <div class="page-heading">
      <div><p class="eyebrow">Catálogo escolar</p><h1>Encuentra tu próxima lectura</h1><p class="muted">Consulta disponibilidad y solicita un ejemplar.</p></div>
      ${isStaff() ? '<button class="primary" type="button" data-action="new-book">+ Registrar libro</button>' : ""}
    </div>
    <form id="catalog-filter" class="toolbar" role="search">
      <div class="search-wrap"><label class="hidden" for="catalog-search">Buscar libros</label><input id="catalog-search" name="q" placeholder="Título, autor o ISBN" maxlength="100"></div>
      <label class="hidden" for="catalog-area">Área</label>
      <select id="catalog-area" name="area"><option value="">Todas las áreas</option>${Object.entries(AREAS).map(([code, item]) => `<option value="${code}">${item[0]}</option>`).join("")}</select>
      <label class="availability-check"><input type="checkbox" name="disponible" value="1"> Solo disponibles</label>
    </form>
    ${content}`;
}

function renderCatalog() {
  const content = state.books.length
    ? `<div class="books-grid">${state.books.map(bookCard).join("")}</div>`
    : '<div class="empty-state"><div class="cover-placeholder">📭</div><h2>No hay libros para mostrar</h2><p>Prueba otros filtros o registra el primer libro.</p></div>';
  byId("catalog-view").innerHTML = catalogShell(content);
}

function cover(book, className = "") {
  if (book.foto) return `<img class="${className}" src="${escapeHtml(book.foto)}" alt="Portada de ${escapeHtml(book.titulo)}">`;
  if (book.isbn) return `<img class="${className}" src="https://covers.openlibrary.org/b/isbn/${encodeURIComponent(book.isbn)}-M.jpg?default=false" alt="Portada de ${escapeHtml(book.titulo)}">`;
  return `<div class="cover-placeholder" aria-hidden="true">📘</div>`;
}

function bookCard(book) {
  const available = book.disponibles > 0;
  return `<article class="book-card">
    <div class="book-cover">${cover(book)}</div>
    <div class="book-body">
      <span class="badge neutral">${escapeHtml(AREAS[book.area]?.[0] || book.area)}</span>
      <h2>${escapeHtml(book.titulo)}</h2>
      <p class="muted">${escapeHtml(book.autor || "Autor desconocido")}</p>
      <span class="badge ${available ? "success" : "warning"}">${available ? `${book.disponibles} disponible${book.disponibles === 1 ? "" : "s"}` : "Sin disponibilidad"}</span>
      <button class="ghost-button" type="button" data-action="open-book" data-id="${book.id}">Ver detalles</button>
    </div>
  </article>`;
}

async function openBook(bookId) {
  state.selectedBook = state.books.find((book) => book.id === bookId);
  if (!state.selectedBook) return;
  state.opinions = [];
  renderBookDialog(true);
  if (!byId("book-dialog").open) byId("book-dialog").showModal();
  try {
    const data = await api(`/api/libros/${bookId}/opiniones`);
    state.opinions = data.opiniones;
    renderBookDialog(false);
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderBookDialog(loading = false) {
  const book = state.selectedBook;
  if (!book) return;
  const own = state.opinions.find((item) => item.propia);
  const reviews = loading
    ? '<div class="loading">Cargando opiniones…</div>'
    : state.opinions.length
      ? state.opinions.map((item) => `<article class="review"><strong>${escapeHtml(item.apodo)}</strong> <span class="stars" aria-label="${item.estrellas} de 5 estrellas">${"★".repeat(item.estrellas)}${"☆".repeat(5 - item.estrellas)}</span><p>${escapeHtml(item.comentario || "Sin comentario")}</p></article>`).join("")
      : '<p class="muted">Todavía no hay opiniones.</p>';
  byId("book-dialog-content").innerHTML = `
    <div class="dialog-heading"><div><p class="eyebrow">${escapeHtml(AREAS[book.area]?.[0] || book.area)}</p><h2 id="book-dialog-title">${escapeHtml(book.titulo)}</h2></div><button class="icon-button" type="button" data-close-dialog="book-dialog" aria-label="Cerrar">✕</button></div>
    <div class="book-detail">
      <div class="book-cover detail-cover">${cover(book, "detail-cover")}</div>
      <div>
        <p><strong>${escapeHtml(book.autor)}</strong></p>
        <div class="detail-meta"><span class="badge ${book.disponibles ? "success" : "warning"}">${book.disponibles} de ${book.ejemplares_total} disponibles</span>${book.isbn ? `<span class="badge neutral">ISBN ${escapeHtml(book.isbn)}</span>` : ""}</div>
        <p>${escapeHtml(book.sinopsis || "Sin sinopsis.")}</p>
        <p class="muted">Ubicación: ${escapeHtml(book.ubicacion || "por definir")}<br>Donante: ${escapeHtml(book.donante || "sin registrar")}</p>
        <div class="button-row">
          ${book.disponibles && !isStaff() ? `<button class="primary" type="button" data-action="request-book" data-id="${book.id}">Solicitar préstamo</button>` : ""}
          ${isStaff() ? `<button class="secondary" type="button" data-action="edit-book" data-id="${book.id}">Editar</button>` : ""}
          ${isAdmin() ? `<button class="danger-button" type="button" data-action="delete-book" data-id="${book.id}">Eliminar</button>` : ""}
        </div>
      </div>
    </div>
    <section class="reviews">
      <h3>Opiniones</h3>${reviews}
      <form id="review-form" class="stack">
        <input type="hidden" name="book_id" value="${book.id}">
        <label for="review-stars">Tu puntuación</label>
        <select id="review-stars" name="estrellas" required>${[5,4,3,2,1].map((n) => `<option value="${n}" ${own?.estrellas === n ? "selected" : ""}>${n} estrella${n === 1 ? "" : "s"}</option>`).join("")}</select>
        <label for="review-comment">Comentario</label>
        <textarea id="review-comment" name="comentario" rows="3" maxlength="1000">${escapeHtml(own?.comentario || "")}</textarea>
        <button class="primary" type="submit">${own ? "Actualizar opinión" : "Publicar opinión"}</button>
        <p class="form-error" data-error-for="review-form" role="alert"></p>
      </form>
    </section>`;
}

function openBookForm(book = null) {
  const form = byId("book-form");
  form.reset();
  form.elements.id.value = book?.id || "";
  form.elements.titulo.value = book?.titulo || "";
  form.elements.autor.value = book?.autor || "";
  form.elements.isbn.value = book?.isbn || "";
  form.elements.area.value = book?.area || "LIT";
  form.elements.ejemplares_total.value = book?.ejemplares_total || 1;
  form.elements.sinopsis.value = book?.sinopsis || "";
  form.elements.ubicacion.value = book?.ubicacion || "";
  form.elements.donante.value = book?.donante || "";
  form.elements.foto.value = book?.foto || "";
  byId("book-form-title").textContent = book ? "Editar libro" : "Registrar libro";
  setFormError("book-form");
  byId("book-form-dialog").showModal();
}

function openLoanForm() {
  const available = state.books.filter((book) => book.disponibles > 0);
  byId("loan-book").innerHTML = available.map((book) => `<option value="${book.id}">${escapeHtml(book.titulo)} (${book.disponibles})</option>`).join("");
  byId("loan-due").min = new Date().toISOString().slice(0, 10);
  byId("loan-due").value = futureDate(30);
  byId("loan-form").elements.apodo.value = "";
  setFormError("loan-form");
  byId("loan-dialog").showModal();
}

async function loadManagement() {
  const view = byId("management-view");
  view.innerHTML = '<div class="loading">Cargando gestión…</div>';
  try {
    const calls = [api("/api/libros"), api("/api/prestamos?estado=activo"), api("/api/solicitudes?estado=pendiente"), api("/api/estadisticas")];
    if (isAdmin()) calls.push(api("/api/usuarios"));
    const [books, loans, requests, stats, users] = await Promise.all(calls);
    state.books = books.libros;
    state.loans = loans.prestamos;
    state.requests = requests.solicitudes;
    state.stats = stats;
    state.users = users?.usuarios || [];
    renderManagement();
  } catch (error) {
    view.innerHTML = `<div class="error-panel">${escapeHtml(error.message)}</div>`;
  }
}

function renderManagement() {
  const stats = state.stats;
  byId("management-view").innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Administración</p><h1>Gestión de biblioteca</h1><p class="muted">Inventario, circulación y usuarios en un solo lugar.</p></div><div class="button-row"><button class="secondary" type="button" data-action="new-loan">+ Préstamo</button><button class="primary" type="button" data-action="new-book">+ Libro</button></div></div>
    <div class="dashboard-grid">
      <div class="stat-card"><span class="muted">Ejemplares</span><strong>${stats.total_ejemplares}</strong></div>
      <div class="stat-card"><span class="muted">Disponibles</span><strong>${stats.disponibles}</strong></div>
      <div class="stat-card"><span class="muted">Prestados</span><strong>${stats.prestados}</strong></div>
      <div class="stat-card"><span class="muted">Vencidos</span><strong>${stats.vencidos}</strong></div>
    </div>
    <section class="management-section"><div class="section-heading"><h2>Solicitudes pendientes</h2><span class="badge neutral">${state.requests.length}</span></div>${requestTable()}</section>
    <section class="management-section"><div class="section-heading"><h2>Préstamos activos</h2><span class="badge neutral">${state.loans.length}</span></div>${loanTable()}</section>
    <section class="management-section"><div class="section-heading"><h2>Libros más leídos</h2></div>${topBooks()}</section>
    ${isAdmin() ? `<section class="management-section"><div class="section-heading"><h2>Usuarios</h2><span class="badge neutral">${state.users.length}</span></div>${userTable()}</section>` : ""}`;
}

function requestTable() {
  if (!state.requests.length) return '<div class="empty-state">No hay solicitudes pendientes.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Libro</th><th>Estudiante</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>${state.requests.map((item) => `<tr><td>${escapeHtml(item.titulo)}</td><td>${escapeHtml(item.apodo)}</td><td>${formatDate(item.creado_en)}</td><td><div class="button-row"><button class="secondary" type="button" data-action="approve-request" data-id="${item.id}">Aprobar</button><button class="danger-button" type="button" data-action="reject-request" data-id="${item.id}">Rechazar</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function loanTable() {
  if (!state.loans.length) return '<div class="empty-state">No hay préstamos activos.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Libro</th><th>Estudiante</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>${state.loans.map((item) => `<tr><td>${escapeHtml(item.titulo)}</td><td>${escapeHtml(item.apodo)}</td><td>${formatDate(item.vence_en)}</td><td><span class="badge ${item.vencido ? "warning" : "success"}">${item.vencido ? "Vencido" : "Al día"}</span></td><td><button class="secondary" type="button" data-action="return-loan" data-id="${item.id}">Devolver</button></td></tr>`).join("")}</tbody></table></div>`;
}

function topBooks() {
  if (!state.stats.mas_leidos.length) return '<p class="muted">Aún no hay historial suficiente.</p>';
  return `<div class="item-list">${state.stats.mas_leidos.map((item) => `<div class="list-item"><span>${escapeHtml(item.titulo)}</span><strong>${item.veces} préstamo${item.veces === 1 ? "" : "s"}</strong></div>`).join("")}</div>`;
}

function userTable() {
  return `<div class="table-wrap"><table><thead><tr><th>Apodo</th><th>Grado</th><th>Rol</th><th>Acciones</th></tr></thead><tbody>${state.users.map((user) => {
    const protectedAdmin = user.rol === "admin" && !isHost();
    const locked = user.id === state.user.id || user.es_anfitrion || protectedAdmin;
    const roles = isHost() ? ["estudiante", "bibliotecario", "admin"] : ["estudiante", "bibliotecario"];
    return `<tr><td>${escapeHtml(user.apodo)}${user.es_anfitrion ? ' <span class="badge success">anfitriona</span>' : ""}${user.debe_cambiar_contrasena ? ' <span class="badge warning">clave temporal</span>' : ""}</td><td>${escapeHtml([user.grado, user.seccion].filter(Boolean).join(" ") || "—")}</td><td><label class="hidden" for="role-${user.id}">Rol de ${escapeHtml(user.apodo)}</label><select id="role-${user.id}" data-action="change-role" data-id="${user.id}" ${locked ? "disabled" : ""}>${roles.map((role) => `<option value="${role}" ${role === user.rol ? "selected" : ""}>${role}</option>`).join("")}${!roles.includes(user.rol) ? `<option value="${user.rol}" selected>${user.rol}</option>` : ""}</select></td><td><div class="button-row">${isHost() && user.rol === "admin" && !user.es_anfitrion ? `<button class="danger-button" type="button" data-action="revoke-admin" data-id="${user.id}" data-name="${escapeHtml(user.apodo)}">Revocar administrador</button>` : ""}<button class="${user.activo ? "danger-button" : "secondary"}" type="button" data-action="toggle-user" data-id="${user.id}" data-active="${user.activo}" ${locked ? "disabled" : ""}>${user.activo ? "Desactivar" : "Activar"}</button><button class="ghost-button" type="button" data-action="reset-password" data-id="${user.id}" ${locked || !user.activo ? "disabled" : ""}>Nueva clave</button></div></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

async function loadProfile() {
  const view = byId("profile-view");
  view.innerHTML = '<div class="loading">Cargando perfil…</div>';
  try {
    const [loans, requests, progress] = await Promise.all([api("/api/prestamos"), api("/api/solicitudes"), api("/api/progreso")]);
    state.loans = loans.prestamos;
    state.requests = requests.solicitudes;
    state.progress = progress.progreso;
    renderProfile();
  } catch (error) {
    view.innerHTML = `<div class="error-panel">${escapeHtml(error.message)}</div>`;
  }
}

function renderProfile() {
  const activeLoans = state.loans.filter((item) => item.estado === "activo");
  const pending = state.requests.filter((item) => item.estado === "pendiente");
  byId("profile-view").innerHTML = `
    <div class="page-heading"><div class="profile-header"><div class="avatar">${escapeHtml(state.user.apodo[0].toUpperCase())}</div><div><h1>${escapeHtml(state.user.apodo)}</h1><p class="muted">${escapeHtml(state.user.rol)}${state.user.es_anfitrion ? " · anfitriona" : ""}${state.user.grado ? ` · ${escapeHtml(state.user.grado)} ${escapeHtml(state.user.seccion || "")}` : ""}</p></div></div><div class="button-row"><button class="ghost-button" type="button" data-action="change-password">Cambiar contraseña</button>${!isAdmin() ? '<button class="danger-button" type="button" data-action="delete-account">Eliminar cuenta</button>' : ""}<button class="danger-button" type="button" data-action="logout">Cerrar sesión</button></div></div>
    <div class="profile-grid">
      <section class="profile-card"><div class="section-heading"><h2>Mis préstamos</h2><span class="badge neutral">${activeLoans.length}</span></div>${activeLoans.length ? `<div class="item-list">${activeLoans.map((item) => `<div class="list-item"><span>${escapeHtml(item.titulo)}</span><span class="${item.vencido ? "badge warning" : "muted"}">${item.vencido ? "Vencido" : `hasta ${formatDate(item.vence_en)}`}</span></div>`).join("")}</div>` : '<p class="muted">No tienes préstamos activos.</p>'}</section>
      <section class="profile-card"><div class="section-heading"><h2>Mis solicitudes</h2><span class="badge neutral">${pending.length}</span></div>${pending.length ? `<div class="item-list">${pending.map((item) => `<div class="list-item"><span>${escapeHtml(item.titulo)}</span><button class="danger-button" type="button" data-action="cancel-request" data-id="${item.id}">Cancelar</button></div>`).join("")}</div>` : '<p class="muted">No tienes solicitudes pendientes.</p>'}</section>
    </div>
    <section class="profile-card"><div class="section-heading"><h2>Mi aprendizaje</h2></div>${state.progress.length ? `<div class="item-list">${state.progress.map((item) => `<div class="list-item"><span>${escapeHtml(item.curso)}</span><strong>${escapeHtml(item.estilo ? item.estilo.split("").map((letter) => STYLE_NAMES[letter]).join(" + ") : "Sin test")}${item.mejor_puntaje != null ? ` · ${item.mejor_puntaje}/${item.total}` : ""}</strong></div>`).join("")}</div>` : '<p class="muted">Completa un test en Aprender para guardar tu resultado.</p>'}</section>
    ${state.user.rol === "estudiante" ? `<section class="profile-card"><div class="section-heading"><h2>Solicitar ser administrador</h2></div><p class="muted">La anfitriona revisará tu solicitud. Explica por qué quieres ayudar a administrar BiblioMatch.</p><form id="admin-request-form" class="stack"><label for="admin-request-reason">Motivo de la solicitud</label><textarea id="admin-request-reason" name="motivo" rows="5" minlength="20" maxlength="1000" placeholder="Cuéntanos por qué quieres ser administrador y cómo ayudarías a la biblioteca…" required></textarea><button class="primary" type="submit">Enviar solicitud por correo</button><p class="field-help">Se abrirá tu aplicación de correo con el mensaje dirigido a penaariana075@gmail.com.</p><p class="form-error" data-error-for="admin-request-form" role="alert"></p></form></section>` : ""}`;
}

async function loadLearning() {
  try {
    const data = await api("/api/progreso");
    state.progress = data.progreso;
  } catch (error) {
    showToast(error.message, true);
  }
  renderLearning();
}

function renderLearning() {
  const view = byId("learning-view");
  if (!state.course) {
    view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">Herramientas de estudio</p><h1>Aprende a tu manera</h1><p class="muted">El test es orientativo: combina estrategias y conserva las que te funcionen.</p></div></div><div class="course-grid">${COURSES.map(([course, emoji]) => `<button class="course-card" type="button" data-action="start-quiz" data-course="${escapeHtml(course)}"><span aria-hidden="true">${emoji}</span><strong>${escapeHtml(course)}</strong><p class="muted">Test de preferencias</p></button>`).join("")}</div>`;
    return;
  }
  const saved = state.progress.find((item) => item.curso === state.course);
  view.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${escapeHtml(state.course)}</p><h1>Preferencias de estudio</h1><p class="muted">No es un diagnóstico: úsalo para probar técnicas distintas.</p></div><button class="ghost-button" type="button" data-action="back-courses">← Cursos</button></div>
    ${state.style ? learningResult(saved) : quizForm()}`;
}

function quizForm() {
  return `<form id="learning-quiz" class="learning-card"><ol>${QUIZ.map(([question, choices], index) => `<li class="quiz-question"><p><strong>${escapeHtml(question)}</strong></p><div class="quiz-options">${Object.entries(choices).map(([letter, answer]) => `<label><input type="radio" name="q${index}" value="${letter}" required> ${escapeHtml(answer)}</label>`).join("")}</div></li>`).join("")}</ol><button class="primary" type="submit">Ver resultado</button><p class="form-error" data-error-for="learning-quiz" role="alert"></p></form>`;
}

function learningResult(saved) {
  const names = state.style.split("").map((letter) => STYLE_NAMES[letter]).join(" + ");
  return `<section class="learning-card"><div class="result-card"><p class="eyebrow">Resultado orientativo</p><h2>${escapeHtml(names)}</h2><p>Prueba una mezcla de estas estrategias y evalúa con cuál recuerdas y comprendes mejor.</p></div>
    <h3>Genera una guía adaptada</h3><form id="material-form" class="stack"><label for="material-topic">Tema o texto de estudio</label><textarea id="material-topic" name="tema" rows="6" maxlength="3000" placeholder="Ejemplo: Las leyes de Newton…" required></textarea><button class="primary" type="submit">✨ Crear guía y preguntas</button><p class="form-error" data-error-for="material-form" role="alert"></p></form>
    ${state.material ? renderMaterial(state.material) : ""}
    ${saved ? `<p class="muted">Resultado guardado · ${saved.intentos || 0} prácticas registradas</p>` : ""}</section>`;
}

function renderMaterial(material) {
  return `<div class="result-card"><h3>${escapeHtml(material.titulo || "Guía de estudio")}</h3><p>${escapeHtml(material.resumen || "")}</p>${Array.isArray(material.puntos) ? `<ul>${material.puntos.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}${Array.isArray(material.preguntas) ? `<h3>Comprueba lo aprendido</h3><ol>${material.preguntas.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ol>` : ""}</div>`;
}

async function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  try {
    if (action === "new-book") openBookForm();
    if (action === "open-book") await openBook(id);
    if (action === "edit-book") { byId("book-dialog").close(); openBookForm(state.books.find((book) => book.id === id)); }
    if (action === "request-book") {
      button.disabled = true;
      await api("/api/solicitudes", { method: "POST", body: { libro_id: id } });
      showToast("Solicitud enviada.");
      byId("book-dialog").close();
      await loadBooks();
    }
    if (action === "delete-book" && confirm("¿Eliminar este libro y sus opiniones?")) {
      await api(`/api/libros/${id}`, { method: "DELETE" });
      byId("book-dialog").close();
      showToast("Libro eliminado.");
      await loadBooks();
    }
    if (action === "new-loan") openLoanForm();
    if (action === "return-loan" && confirm("¿Marcar este préstamo como devuelto?")) {
      await api(`/api/prestamos/${id}/devolver`, { method: "POST", body: {} });
      showToast("Devolución registrada.");
      await loadManagement();
    }
    if (action === "approve-request") {
      await api(`/api/solicitudes/${id}/resolver`, { method: "POST", body: { accion: "aprobar", vence_en: futureDate(30) } });
      showToast("Solicitud aprobada; préstamo creado por 30 días.");
      await loadManagement();
    }
    if (action === "reject-request" && confirm("¿Rechazar esta solicitud?")) {
      await api(`/api/solicitudes/${id}/resolver`, { method: "POST", body: { accion: "rechazar" } });
      showToast("Solicitud rechazada.");
      await loadManagement();
    }
    if (action === "toggle-user") {
      await api(`/api/usuarios/${id}`, { method: "PATCH", body: { activo: button.dataset.active !== "true" } });
      showToast("Usuario actualizado.");
      await loadManagement();
    }
    if (action === "reset-password" && confirm("¿Generar una contraseña temporal y cerrar las sesiones de esta cuenta?")) {
      const result = await api(`/api/usuarios/${id}/restablecer-contrasena`, { method: "POST", body: {} });
      prompt("Copia esta contraseña y entrégala por un canal seguro. Solo se mostrará ahora:", result.contrasena_temporal);
      await loadManagement();
    }
    if (action === "revoke-admin" && confirm(`¿Revocar el permiso de administrador de ${button.dataset.name}? Volverá a ser estudiante.`)) {
      await api(`/api/usuarios/${id}`, { method: "PATCH", body: { rol: "estudiante" } });
      showToast("Permiso revocado; la cuenta volvió a ser estudiante.");
      await loadManagement();
    }
    if (action === "cancel-request" && confirm("¿Cancelar esta solicitud?")) {
      await api(`/api/solicitudes/${id}`, { method: "DELETE" });
      showToast("Solicitud cancelada.");
      await loadProfile();
    }
    if (action === "change-password") byId("password-dialog").showModal();
    if (action === "logout") {
      await api("/api/logout", { method: "POST", body: {} });
      showAuth();
    }
    if (action === "delete-account") {
      const password = prompt("Para eliminar tu cuenta, escribe tu contraseña actual:");
      if (password) {
        await api("/api/cuenta", { method: "DELETE", body: { contrasena: password } });
        showToast("Cuenta eliminada.");
        showAuth();
      }
    }
    if (action === "start-quiz") { state.course = button.dataset.course; state.style = ""; state.material = null; renderLearning(); }
    if (action === "back-courses") { state.course = null; state.style = ""; state.material = null; renderLearning(); }
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
  }
}

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) changeView(viewButton.dataset.view);
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) await handleAction(actionButton);
  const closeButton = event.target.closest("[data-close-dialog]");
  if (closeButton) byId(closeButton.dataset.closeDialog).close();
});

document.addEventListener("change", async (event) => {
  if (event.target.closest("#catalog-filter") && event.target.matches("select, input[type=checkbox]")) {
    event.target.form.requestSubmit();
    return;
  }
  const select = event.target.closest('[data-action="change-role"]');
  if (!select) return;
  try {
    await api(`/api/usuarios/${select.dataset.id}`, { method: "PATCH", body: { rol: select.value } });
    showToast("Rol actualizado.");
    await loadManagement();
  } catch (error) {
    showToast(error.message, true);
    await loadManagement();
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.id === "admin-request-form") {
    event.preventDefault();
    const reason = new FormData(form).get("motivo").trim();
    const subject = `Solicitud de administrador de ${state.user.apodo}`;
    const body = `Hola Ariana,\n\nSoy ${state.user.apodo} y solicito permiso para ser administrador de BiblioMatch.\n\nMotivo:\n${reason}\n\nGracias.`;
    window.location.href = `mailto:penaariana075@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast("Solicitud preparada en tu aplicación de correo.");
    return;
  }
  if (form.id === "catalog-filter") {
    event.preventDefault();
    const params = new URLSearchParams(new FormData(form));
    [...params.entries()].forEach(([key, value]) => { if (!value) params.delete(key); });
    await loadBooks(params.toString() ? `?${params}` : "");
  }
  if (form.id === "review-form") {
    event.preventDefault();
    setFormError(form.id);
    const data = Object.fromEntries(new FormData(form));
    try {
      await api(`/api/libros/${data.book_id}/opinion`, { method: "PUT", body: { estrellas: Number(data.estrellas), comentario: data.comentario } });
      showToast("Opinión guardada.");
      await openBook(data.book_id);
    } catch (error) { setFormError(form.id, error.message); }
  }
  if (form.id === "learning-quiz") {
    event.preventDefault();
    const data = new FormData(form);
    const counts = { V: 0, A: 0, R: 0, K: 0 };
    for (let index = 0; index < QUIZ.length; index += 1) counts[data.get(`q${index}`)] += 1;
    const maximum = Math.max(...Object.values(counts));
    state.style = Object.keys(counts).filter((letter) => counts[letter] === maximum).join("");
    try {
      await api(`/api/progreso/${encodeURIComponent(state.course)}`, { method: "PUT", body: { estilo: state.style } });
      const progress = await api("/api/progreso");
      state.progress = progress.progreso;
    } catch (error) { showToast(error.message, true); }
    renderLearning();
  }
  if (form.id === "material-form") {
    event.preventDefault();
    setFormError(form.id);
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    submit.textContent = "Creando guía…";
    try {
      const data = Object.fromEntries(new FormData(form));
      const result = await api("/api/generar", { method: "POST", body: { tipo: "material", curso: state.course, estilo: state.style, tema: data.tema } });
      state.material = result.material;
      renderLearning();
    } catch (error) {
      setFormError(form.id, error.message);
      submit.disabled = false;
      submit.textContent = "✨ Crear guía y preguntas";
    }
  }
});

byId("login-tab").addEventListener("click", () => switchAuthTab("login"));
byId("register-tab").addEventListener("click", () => switchAuthTab("register"));
byId("theme-toggle").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

byId("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("login-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const data = await api("/api/login", { method: "POST", body: values });
    state.user = data.usuario;
    state.csrf = data.csrf;
    form.reset();
    showApp();
  } catch (error) {
    setFormError("login-form", error.message);
  } finally { submit.disabled = false; }
});

byId("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("register-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    const data = await api("/api/registro", { method: "POST", body: values });
    state.user = data.usuario;
    state.csrf = data.csrf;
    form.reset();
    showApp();
  } catch (error) {
    setFormError("register-form", error.message);
  } finally { submit.disabled = false; }
});

byId("book-photo").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 750_000) {
    setFormError("book-form", "La portada no puede superar 750 KB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { byId("book-form").elements.foto.value = reader.result; };
  reader.readAsDataURL(file);
});

byId("book-ai-button").addEventListener("click", async () => {
  const form = byId("book-form");
  const title = form.elements.titulo.value.trim();
  if (!title) return setFormError("book-form", "Escribe primero el título.");
  const button = byId("book-ai-button");
  button.disabled = true;
  button.textContent = "Buscando…";
  try {
    const data = await api("/api/generar", { method: "POST", body: { tipo: "libro", titulo: title } });
    form.elements.autor.value = data.autor || "";
    form.elements.area.value = data.area || "LIT";
    form.elements.sinopsis.value = data.sinopsis || "";
    showToast("Información generada; revísala antes de guardar.");
  } catch (error) { setFormError("book-form", error.message); }
  finally { button.disabled = false; button.textContent = "✨ Completar con IA"; }
});

byId("book-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("book-form");
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  delete values.foto_archivo;
  values.ejemplares_total = Number(values.ejemplares_total);
  const id = values.id;
  delete values.id;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    await api(id ? `/api/libros/${id}` : "/api/libros", { method: id ? "PUT" : "POST", body: values });
    byId("book-form-dialog").close();
    showToast(id ? "Libro actualizado." : "Libro registrado.");
    if (state.view === "management") await loadManagement(); else await loadBooks();
  } catch (error) { setFormError("book-form", error.message); }
  finally { submit.disabled = false; }
});

byId("loan-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("loan-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    const values = Object.fromEntries(new FormData(form));
    await api("/api/prestamos", { method: "POST", body: values });
    byId("loan-dialog").close();
    showToast("Préstamo registrado.");
    await loadManagement();
  } catch (error) { setFormError("loan-form", error.message); }
  finally { submit.disabled = false; }
});

byId("password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormError("password-form");
  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    await api("/api/cuenta/contrasena", { method: "POST", body: Object.fromEntries(new FormData(form)) });
    form.reset();
    byId("password-dialog").close();
    state.user.debe_cambiar_contrasena = false;
    showToast("Contraseña actualizada.");
  } catch (error) { setFormError("password-form", error.message); }
  finally { submit.disabled = false; }
});

boot();
