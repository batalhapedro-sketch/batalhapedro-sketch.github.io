/* AIR Framework: app cliente/admin (Supabase) */
(() => {
"use strict";
const CFG = window.AIR_CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDate = (d) => { const [y, m, dd] = String(d).split("-"); return `${dd}/${m}/${y}`; };
const LOGIN_DOMAIN = "@air.uzerconsulting.pt";
const SCORE_NAMES = ["Inexistente · 0", "Iniciado · 1", "Consolidado · 2"];
const PKEY = { V: "v", L: "l", C: "c" };
const PNAME = { V: "VISIBILIDADE", L: "LEGIBILIDADE", C: "CREDIBILIDADE" };
const PNAME_T = { V: "Visibilidade", L: "Legibilidade", C: "Credibilidade" };

/* ---------------------------------------------------------------- estrutura do framework por versão */
const COMMON_LC = {
  L: { kicker: "O que permite à IA compreender a marca", secs: [
    { t: "IDENTIDADE & ENTIDADE", q: "(a IA sabe quem é a marca, o que faz e onde atua?)", subs: [{ t: "", ids: ["L1", "L2", "L3", "L4", "L5"] }] },
    { t: "ESTRUTURA & CONTEÚDO LEGÍVEL", q: "(a informação está organizada para a IA interpretar corretamente a marca?)", subs: [{ t: "", ids: ["L6", "L7", "L8", "L9", "L10"] }] }] },
  C: { kicker: "O que permite à IA confiar na marca", secs: [
    { t: "AUTORIDADE EXTERNA", q: "(quem valida a marca institucionalmente?)", subs: [{ t: "", ids: ["C1", "C2", "C3", "C4"] }] },
    { t: "PROVA SOCIAL & CONSENSO", q: "(os clientes e comunidades confirmam a marca?)", subs: [{ t: "", ids: ["C5", "C6", "C7", "C8", "C9", "C10"] }] }] },
};
const V_OWN_EXT = { t: "CANAIS COM LEITURA DIRETA POR IA", q: "(que canais públicos tornam a marca encontrável pela AI?)", subs: [
  { t: "Canais próprios (ativáveis pela marca)", ids: ["V1", "V2", "V3"] },
  { t: "Canais externos (ativáveis pela marca)", ids: ["V4", "V5", "V6", "V7", "V8"] }] };
const STRUCT = {
  V8: { title: "AIR - AI Readiness Score", credit: "Modelo proprietário UZER CONSULTING · V8 · critérios V1–V10 · L1–L10 · C1–C10 alinhados com a Grelha de Pontuação AIX Score",
    V: { kicker: "O que permite à IA encontrar a marca", secs: [V_OWN_EXT,
      { t: "CANAIS PAGOS COM IMPACTO INDIRETO", q: "(que canais amplificam procura, tráfego e sinais de interesse pela marca?)", subs: [{ t: "", ids: ["V9", "V10"] }] }] }, ...COMMON_LC },
  V10: { title: "AIR - AI Readiness Score · V10", credit: "Modelo proprietário UZER CONSULTING · critérios V1–V10 · L1–L10 · C1–C10 · AIR Framework V10 (set 2026), consolida a V8 (jul 2026) e a revisão V9 (ago 2026)",
    V: { kicker: "O que permite à IA encontrar a marca", secs: [V_OWN_EXT,
      { t: "ÍNDICES DOS ASSISTENTES E CANAIS PAGOS", q: "(onde a IA pesquisa de facto; e o que amplifica os sinais de marca)", subs: [{ t: "", ids: ["V9", "V10"] }] }] }, ...COMMON_LC },
};
const structFor = (fw) => STRUCT[fw] || STRUCT.V10;
const REGRA = "Regra de leitura: Visibilidade mede existência/acessibilidade do ativo; Credibilidade mede independência e força da validação externa. Cada dimensão = 10 critérios × 0–2 pts.";

/* ---------------------------------------------------------------- backend: Supabase (produção) ou demo local */
function supabaseBackend() {
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true } });
  const need = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  return {
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async login(u, p) { const { error } = await sb.auth.signInWithPassword({ email: u.trim().toLowerCase() + LOGIN_DOMAIN, password: p });
      if (error) throw new Error(/invalid/i.test(error.message) ? "Username ou password incorretos." : error.message); },
    async logout() { await sb.auth.signOut(); },
    async me() { const { data: { user } } = await sb.auth.getUser(); if (!user) return null;
      return need(await sb.from("profiles").select("user_id,username,role,client_id").eq("user_id", user.id).maybeSingle()); },
    async clients() { return need(await sb.from("clients").select("id,slug,name").order("name")); },
    async audits() { return need(await sb.from("audits").select("*").order("audit_date", { ascending: false })); },
    async users() { return need(await sb.from("profiles").select("user_id,username,role,client_id,created_at").order("username")); },
    async createUser(u, p, role, clientId) { need(await sb.rpc("admin_create_user", { p_username: u, p_password: p, p_role: role, p_client_id: clientId || null })); },
    async setPassword(id, p) { need(await sb.rpc("admin_set_password", { p_user_id: id, p_password: p })); },
    async updateUser(id, role, clientId) { need(await sb.rpc("admin_update_user", { p_user_id: id, p_role: role, p_client_id: clientId || null })); },
    async deleteUser(id) { need(await sb.rpc("admin_delete_user", { p_user_id: id })); },
    async createClient(slug, name) { need(await sb.from("clients").insert({ slug, name })); },
    async updateAudit(id, patch) { return need(await sb.from("audits").update(patch).eq("id", id).select("*").single()); },
  };
}
function demoBackend() { // só em localhost, para testar a interface sem base de dados; não valida passwords
  let me = null, AUD = [], CL = [], US = [];
  const load = async () => { if (AUD.length) return; const raw = await (await fetch(CFG.demoData)).json();
    const names = { myforce: "MyForce", norauto: "Norauto" };
    CL = [...new Set(raw.map((a) => a.client))].map((s) => ({ id: "c-" + s, slug: s, name: names[s] || s }));
    AUD = raw.map((a) => ({ id: a.key, slug: a.key, client_id: "c-" + a.client, framework: a.framework, audit_date: a.date, title: a.title,
      score_total: a.score_total, pillars: a.pillars, summary: a.summary, criteria: a.criteria, explorer_url: a.explorer_url, published: true }));
    US = [{ user_id: "u-admin", username: "pedro", role: "admin", client_id: null }, ...CL.map((c) => ({ user_id: "u-" + c.slug, username: c.slug, role: "client", client_id: c.id }))]; };
  return {
    async session() { await load(); return me; },
    async login(u) { await load(); me = US.find((x) => x.username === u.trim().toLowerCase()) || null; if (!me) throw new Error("Username ou password incorretos."); },
    async logout() { me = null; }, async me() { return me; },
    async clients() { return me.role === "admin" ? CL : CL.filter((c) => c.id === me.client_id); },
    async audits() { return me.role === "admin" ? AUD : AUD.filter((a) => a.client_id === me.client_id); },
    async users() { return US; },
    async createUser(u, p, role, cid) { US.push({ user_id: "u-" + u, username: u, role, client_id: role === "admin" ? null : cid }); },
    async setPassword() {}, async updateUser(id, role, cid) { Object.assign(US.find((x) => x.user_id === id), { role, client_id: role === "admin" ? null : cid }); },
    async deleteUser(id) { US = US.filter((x) => x.user_id !== id); }, async createClient(slug, name) { CL.push({ id: "c-" + slug, slug, name }); },
    async updateAudit(id, patch) { const a = AUD.find((x) => x.id === id); Object.assign(a, JSON.parse(JSON.stringify(patch))); return { ...a }; },
  };
}
const configured = CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase;
const api = CFG.demo ? demoBackend() : configured ? supabaseBackend() : null;

/* ---------------------------------------------------------------- estado */
const S = { me: null, clients: [], audits: [], users: [], view: "audit", clientId: null, auditId: null, tab: "w1", preview: false, edit: false, open: new Set() };
const root = $("#app");
const LOGO = () => $("#logo-tpl").innerHTML;
const clientOf = (id) => S.clients.find((c) => c.id === id);
const auditsOf = (cid) => S.audits.filter((a) => a.client_id === cid).sort((a, b) => b.audit_date.localeCompare(a.audit_date));
const current = () => S.audits.find((a) => a.id === S.auditId) || null;
const editing = () => S.edit && S.me?.role === "admin" && !S.preview;

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200); }
function confirmDialog(title, text, okLabel = "Confirmar", danger = false) {
  return new Promise((res) => {
    const v = document.createElement("div"); v.className = "dialog-veil";
    v.innerHTML = `<div class="dialog" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="acts"><button class="btn ghost" data-a="0">Cancelar</button><button class="btn ${danger ? "danger" : "primary"}" data-a="1">${esc(okLabel)}</button></div></div>`;
    v.addEventListener("click", (e) => { const a = e.target.closest("[data-a]"); if (a || e.target === v) { v.remove(); res(a?.dataset.a === "1"); } });
    document.body.append(v); v.querySelector("[data-a='1']").focus();
  });
}
function promptDialog(title, label, type = "text") {
  return new Promise((res) => {
    const v = document.createElement("div"); v.className = "dialog-veil";
    v.innerHTML = `<form class="dialog"><h3>${esc(title)}</h3><div class="field"><label for="pd-in">${esc(label)}</label><input id="pd-in" class="input" type="${type}" required minlength="6" autocomplete="new-password"></div>
      <div class="acts"><button type="button" class="btn ghost" data-a="0">Cancelar</button><button class="btn primary">Guardar</button></div></form>`;
    const f = v.querySelector("form");
    f.addEventListener("submit", (e) => { e.preventDefault(); const val = $("#pd-in", v).value; v.remove(); res(val); });
    v.addEventListener("click", (e) => { if (e.target.dataset.a === "0" || e.target === v) { v.remove(); res(null); } });
    document.body.append(v); $("#pd-in", v).focus();
  });
}

/* ---------------------------------------------------------------- arranque */
async function boot() {
  if (!api) { root.innerHTML = setupScreen(); return; }
  root.innerHTML = `<div class="loading">A carregar…</div>`;
  try { if (await api.session()) await enter(); else renderLogin(); }
  catch (e) { renderLogin(e.message); }
}
function setupScreen() {
  return `<div class="login"><div class="login-card"><a class="logo" href="/" aria-label="UZER Consulting, página inicial">${LOGO()}</a>
    <h1>Plataforma AIR: configuração pendente</h1>
    <p class="login-foot">A base de dados ainda não está ligada (config.js sem URL/chave do Supabase).</p></div></div>`;
}
function renderLogin(err = "") {
  root.innerHTML = `<main class="login fade-in"><div class="login-card">
    <a class="logo" href="/" aria-label="UZER Consulting, página inicial">${LOGO()}</a>
    <h1>AIR (AI Readiness Score) · Área de cliente</h1>
    <form id="login-form" novalidate>
      <div class="field"><label for="lg-user">Username</label><input id="lg-user" class="input" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="field"><label for="lg-pass">Password</label><input id="lg-pass" class="input" type="password" autocomplete="current-password" required></div>
      <div class="err" id="lg-err">${esc(err)}</div>
      <button class="btn primary" id="lg-btn">Entrar</button>
    </form>
    <p class="login-foot">UZER CONSULTING · Modelo proprietário AIR</p></div></main>`;
  $("#lg-user").focus();
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault(); const b = $("#lg-btn"); b.disabled = true; b.textContent = "A entrar…";
    try { await api.login($("#lg-user").value, $("#lg-pass").value); await enter(); }
    catch (er) { $("#lg-err").textContent = er.message; b.disabled = false; b.textContent = "Entrar"; }
  });
}
async function enter() {
  S.me = await api.me();
  if (!S.me) { await api.logout(); return renderLogin("Esta conta não tem perfil atribuído. Contacte a UZER."); }
  [S.clients, S.audits] = await Promise.all([api.clients(), api.audits()]);
  if (S.me.role === "admin") { S.users = await api.users(); const first = S.clients[0]; S.clientId = first?.id || null; S.auditId = first ? auditsOf(first.id)[0]?.id : null; if (first) S.open.add(first.id); }
  else { S.clientId = S.me.client_id; S.auditId = auditsOf(S.clientId)[0]?.id || null; }
  S.tab = "w1"; S.preview = false; render();
  const h = location.hash.slice(1).toUpperCase(); if (/^[VLC](10|[1-9])$/.test(h) && current()) { S.tab = "w3"; render(); openPanel(h); }
}
async function logout() { await api.logout(); Object.assign(S, { me: null, clients: [], audits: [], users: [] }); renderLogin(); }

/* ---------------------------------------------------------------- render principal */
function render() {
  closePanel();
  if (S.me.role === "admin" && !S.preview) return renderAdmin();
  renderClient();
}
function tabsHTML(a) {
  const cn = esc(clientOf(a.client_id)?.name || "");
  return `<div class="tabs" role="tablist" aria-label="Vistas">
    ${[["w1", `Framework ${esc(a.framework)}`], ["w2", "Resumo Executivo"], ["w3", `Diagnóstico ${cn}`]].map(([w, l], i) =>
      `<button class="tab" role="tab" aria-selected="${S.tab === w}" data-tab="${w}"><span class="n">${i + 1}</span>${l}</button>`).join("")}</div>`;
}
function auditSelect(list) {
  if (list.length < 2) return "";
  return `<select class="select" id="audit-sel" aria-label="Auditoria">${list.map((a) =>
    `<option value="${esc(a.id)}" ${a.id === S.auditId ? "selected" : ""}>${fmtDate(a.audit_date)} · ${esc(a.framework)} · ${fmt(a.score_total)}</option>`).join("")}</select>`;
}
function renderClient() {
  const c = clientOf(S.clientId), a = current(), list = auditsOf(S.clientId);
  root.innerHTML = `
    ${S.preview ? `<div class="preview-banner">Pré-visualização: está a ver a plataforma como o cliente <b>${esc(c?.name)}</b> vê. <button class="btn sm" id="exit-preview">Voltar ao admin</button></div>` : ""}
    <header class="topbar"><div class="topbar-in">
      <a class="logo" href="/" aria-label="UZER Consulting, página inicial">${LOGO()}</a>
      <div class="crumb"><span class="sep"></span><b>${esc(c?.name || "")}</b></div>
      <div class="spacer"></div>
      ${a ? tabsHTML(a) : ""}
      ${auditSelect(list)}
      ${a ? `<div class="score-pill"><small>AIR</small><span class="big">${fmt(a.score_total)}</span><small>/ 100</small></div>` : ""}
      ${S.preview ? "" : `<button class="btn ghost sm" id="logout">Sair</button>`}
    </div></header>
    <main class="client-main fade-in">${a ? auditView(a) : `<div class="empty">Ainda não há auditorias publicadas para a sua conta.</div>`}</main>`;
  wireCommon();
  $("#exit-preview")?.addEventListener("click", () => { S.preview = false; render(); });
}

/* ---------------------------------------------------------------- admin */
function renderAdmin() {
  const a = S.view === "audit" ? current() : null;
  root.innerHTML = `
    <header class="topbar"><div class="topbar-in">
      <a class="logo" href="/" aria-label="UZER Consulting, página inicial">${LOGO()}</a>
      <div class="crumb"><span class="sep"></span><span>Admin</span>${a ? `<span>›</span><b>${esc(clientOf(a.client_id)?.name)}</b><span>${fmtDate(a.audit_date)}</span>` : S.view === "users" ? `<span>›</span><b>Utilizadores</b>` : ""}</div>
      <div class="spacer"></div>
      ${a ? tabsHTML(a) : ""}
      ${a ? `<button class="btn sm ${S.edit ? "on" : ""}" id="edit-mode" aria-pressed="${S.edit}" title="Alterar os textos e as pontuações desta auditoria">${S.edit ? "A editar" : "Editar"}</button>` : ""}
      ${a ? `<button class="btn sm" id="as-client" title="Ver exatamente o que o cliente vê">Ver como cliente</button>` : ""}
      <span class="tag admin">${esc(S.me.username)} · admin</span>
      <button class="btn ghost sm" id="logout">Sair</button>
    </div></header>
    <div class="shell">
      <aside class="sidebar">${sidebarHTML()}</aside>
      <main class="main fade-in">${a && editing() ? `<div class="edit-banner"><b>Modo edição</b><span>${S.tab === "w2" ? "Altere o título da auditoria e o texto de cada pilar e carregue em Guardar." : "Clique num critério para alterar título, pontuação, racional, fontes, citações e link de evidência."} O cliente vê as alterações assim que forem guardadas.</span></div>` : ""}${S.view === "users" ? usersView() : a ? auditView(a) : `<div class="empty">Selecione uma auditoria na barra lateral.</div>`}</main>
    </div>`;
  wireCommon();
  $("#as-client")?.addEventListener("click", () => { S.preview = true; render(); window.scrollTo({ top: 0 }); });
  $("#edit-mode")?.addEventListener("click", () => { S.edit = !S.edit; render(); });
  if (a && editing() && S.tab === "w2") wireSummaryEdit(a);
  root.querySelectorAll(".folder>button").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.cid; S.open.has(id) ? S.open.delete(id) : S.open.add(id); b.parentElement.classList.toggle("open"); }));
  root.querySelectorAll(".leaf[data-aid]").forEach((b) => b.addEventListener("click", () => { S.view = "audit"; S.auditId = b.dataset.aid; S.clientId = current().client_id; S.tab = "w1"; render(); }));
  $("#nav-users")?.addEventListener("click", () => { S.view = "users"; render(); });
  if (S.view === "users") wireUsers();
}
const FOLDER = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>`;
const CHEV = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>`;
const USERS_ICO = `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" style="width:16px;height:16px"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.6c1.4.6 2.3 2 2.6 4.4"/></svg>`;
function sidebarHTML() {
  return `<div><div class="side-h">Clientes</div><div class="tree">
    ${S.clients.map((c) => { const list = auditsOf(c.id); return `
      <div class="folder ${S.open.has(c.id) ? "open" : ""}">
        <button data-cid="${esc(c.id)}" aria-expanded="${S.open.has(c.id)}">${CHEV}${FOLDER}<span>${esc(c.name)}</span><span class="cnt">${list.length}</span></button>
        <div class="kids">${list.length ? list.map((a) => `
          <button class="leaf" data-aid="${esc(a.id)}" aria-current="${S.view === "audit" && a.id === S.auditId}">
            ${fmtDate(a.audit_date)} · ${esc(a.framework)}<span class="meta">${fmt(a.score_total)}</span></button>`).join("")
          : `<span class="leaf" style="cursor:default">Sem auditorias</span>`}</div>
      </div>`; }).join("")}
    </div></div>
    <div><div class="side-h">Gestão</div><div class="tree">
      <button class="leaf" id="nav-users" aria-current="${S.view === "users"}" data-nav="1">${USERS_ICO}Utilizadores &amp; clientes<span class="meta">${S.users.length}</span></button>
    </div></div>`;
}
function usersView() {
  const opts = (sel) => S.clients.map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");
  return `<div class="page-head"><div><div class="eyebrow">Gestão</div><h1>Utilizadores &amp; clientes</h1>
      <p>Cada cliente entra com o seu username e vê apenas as auditorias da sua empresa. O administrador vê e gere tudo.</p></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Username</th><th>Perfil</th><th>Cliente</th><th style="text-align:right">Ações</th></tr></thead><tbody>
      ${S.users.map((u) => `<tr data-uid="${esc(u.user_id)}">
        <td class="u">${esc(u.username)}</td>
        <td>${u.role === "admin" ? `<span class="tag admin">Administrador</span>` : `<span class="tag">Cliente</span>`}</td>
        <td>${u.role === "admin" ? `<span style="color:var(--text-3)">Todos</span>` : `<select class="select" data-act="client" aria-label="Cliente de ${esc(u.username)}">${opts(u.client_id)}</select>`}</td>
        <td><div class="row-actions">
          ${u.role !== "admin" ? `<button class="btn sm" data-act="view">Ver como</button>` : ""}
          <button class="btn sm" data-act="pw">Nova password</button>
          ${u.user_id !== S.me.user_id ? `<button class="btn sm danger" data-act="del">Apagar</button>` : ""}
        </div></td></tr>`).join("")}
    </tbody></table></div>
    <div class="cards2">
      <form class="box" id="new-user"><h3>Novo login</h3>
        <div class="row"><div class="field"><label for="nu-name">Username</label><input id="nu-name" class="input" required pattern="[a-zA-Z0-9._\\-]{2,40}" autocomplete="off"></div>
          <div class="field"><label for="nu-pass">Password (mín. 6)</label><input id="nu-pass" class="input" type="password" required minlength="6" autocomplete="new-password"></div></div>
        <div class="row"><div class="field"><label for="nu-role">Perfil</label><select id="nu-role" class="select"><option value="client">Cliente</option><option value="admin">Administrador</option></select></div>
          <div class="field"><label for="nu-client">Cliente</label><select id="nu-client" class="select">${opts(S.clientId)}</select></div></div>
        <div class="err" id="nu-err"></div><button class="btn primary" style="align-self:flex-start">Criar login</button></form>
      <form class="box" id="new-client"><h3>Novo cliente</h3>
        <div class="row"><div class="field"><label for="nc-name">Nome</label><input id="nc-name" class="input" required placeholder="Ex.: Midas Portugal"></div>
          <div class="field"><label for="nc-slug">Identificador</label><input id="nc-slug" class="input" required pattern="[a-z0-9-]{2,40}" placeholder="midas"></div></div>
        <p class="hint" style="margin:0">A pasta do cliente aparece na barra lateral. As auditorias entram pelo script de importação.</p>
        <div class="err" id="nc-err"></div><button class="btn primary" style="align-self:flex-start">Criar cliente</button></form>
    </div>`;
}
async function refreshUsers() { [S.users, S.clients] = await Promise.all([api.users(), api.clients()]); render(); }
function wireUsers() {
  root.querySelectorAll("tr[data-uid]").forEach((tr) => {
    const u = S.users.find((x) => x.user_id === tr.dataset.uid);
    tr.addEventListener("click", async (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act; if (!act || act === "client") return;
      try {
        if (act === "view") { S.clientId = u.client_id; S.auditId = auditsOf(u.client_id)[0]?.id || null; S.view = "audit"; S.preview = true; S.tab = "w1"; render(); }
        if (act === "pw") { const p = await promptDialog(`Nova password para ${u.username}`, "Password (mín. 6 caracteres)", "password"); if (p) { await api.setPassword(u.user_id, p); toast("Password alterada"); } }
        if (act === "del" && await confirmDialog(`Apagar ${u.username}?`, "O login deixa de funcionar de imediato. Os dados do cliente e as auditorias mantêm-se.", "Apagar login", true)) { await api.deleteUser(u.user_id); toast("Login apagado"); await refreshUsers(); }
      } catch (er) { toast(er.message); }
    });
    tr.querySelector("[data-act='client']")?.addEventListener("change", async (e) => {
      try { await api.updateUser(u.user_id, u.role, e.target.value); toast("Cliente atualizado"); await refreshUsers(); } catch (er) { toast(er.message); }
    });
  });
  const role = $("#nu-role"), cl = $("#nu-client"); role.addEventListener("change", () => { cl.disabled = role.value === "admin"; });
  $("#new-user").addEventListener("submit", async (e) => {
    e.preventDefault(); const err = $("#nu-err"); err.textContent = "";
    if (!e.target.checkValidity()) { err.textContent = "Username (2–40: letras, números, . _ -) e password com 6+ caracteres."; return; }
    try { await api.createUser($("#nu-name").value.trim().toLowerCase(), $("#nu-pass").value, role.value, cl.value); toast("Login criado"); await refreshUsers(); }
    catch (er) { err.textContent = /duplicate|unique/i.test(er.message) ? "Esse username já existe." : er.message; }
  });
  $("#nc-name").addEventListener("input", (e) => { const s = $("#nc-slug"); if (!s.dataset.touched) s.value = e.target.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); });
  $("#nc-slug").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });
  $("#new-client").addEventListener("submit", async (e) => {
    e.preventDefault(); const err = $("#nc-err"); err.textContent = "";
    if (!e.target.checkValidity()) { err.textContent = "Preencha o nome e um identificador (minúsculas, números, hífen)."; return; }
    try { await api.createClient($("#nc-slug").value, $("#nc-name").value.trim()); toast("Cliente criado"); await refreshUsers(); }
    catch (er) { err.textContent = /duplicate|unique/i.test(er.message) ? "Esse identificador já existe." : er.message; }
  });
}

/* ---------------------------------------------------------------- vistas da auditoria */
function auditView(a) {
  if (S.tab === "w2") return summaryView(a);
  return frameworkView(a, S.tab === "w3");
}
function critRow(c, scored, clickable) {
  const dots = [0, 1, 2].map((i) => `<i class="${scored && i === c.score ? "s" + c.score : ""}"></i>`).join("");
  const attrs = clickable ? ` class="crit click${editing() ? " edit" : ""}" tabindex="0" role="button" data-id="${esc(c.id)}" aria-haspopup="dialog"` : ` class="crit"`;
  return `<div${attrs}><span class="id">${esc(c.id)}</span><span class="txt">${esc(c.label)}</span><span class="dots" aria-label="${scored ? SCORE_NAMES[c.score] : "por avaliar"}">${dots}</span></div>`;
}
function frameworkView(a, scored) {
  const st = structFor(a.framework), byId = Object.fromEntries(a.criteria.map((c) => [c.id, c])), cn = clientOf(a.client_id)?.name || "";
  const P = a.pillars, v = 35 * P.V / 20, l = 30 * P.L / 20, cc = 35 * P.C / 20;
  const formula = scored ? `AIR ${esc(cn)} = 35 × (${P.V}/20) + 30 × (${P.L}/20) + 35 × (${P.C}/20) = ${fmt(v).replace(",0", "")} + ${fmt(l).replace(",0", "")} + ${fmt(cc).replace(",0", "")} → ${fmt(a.score_total)} / 100`
    : `AIR Score (ponderação-base v1) = 35 × (V/20) + 30 × (L/20) + 35 × (C/20) → 0–100`;
  const pillar = (k) => { const pk = PKEY[k]; return `<section class="pillar ${pk}">
      <div class="kicker">${esc(st[k].kicker)}</div>
      <h3>${PNAME[k]}${scored ? `<span class="pscore">${P[k]}/20</span>` : ""}</h3>
      ${st[k].secs.map((s) => `<div class="sec-t">${esc(s.t)}</div><div class="sec-q">${esc(s.q)}</div>
        ${s.subs.map((sub) => `${sub.t ? `<div class="sub-t">${esc(sub.t)}</div>` : ""}${sub.ids.map((id) => byId[id] ? critRow(byId[id], scored, scored || editing()) : "").join("")}`).join("")}`).join("")}
    </section>`; };
  return `<div class="fw">
    <div class="fw-head"><div><h2>${esc(scored ? "AIR - AI Readiness Score" : st.title)}</h2>
      <div class="sub">Como preparar uma marca para ser incluída nas respostas finais da IA</div>
      ${scored ? `<div class="meta">${esc(a.title || `Diagnóstico: ${cn} · ${fmtDate(a.audit_date)}`)}</div>` : ""}</div></div>
    ${editing() ? "" : scored ? `<p class="hint"><b>Clique em qualquer critério</b> para ver a evidência: racional, fontes consultadas e citações exatas.</p>` : ""}
    <div class="camada"><b>CAMADA IA: a camada de leitura e interpretação que atravessa toda a cadeia digital</b>
      <div class="models">ChatGPT · Perplexity · Gemini · Claude · Copilot · Google AI Mode · AI Overviews</div>
      <div class="note">O AIR mede prontidão de resposta transversal para visibilidade em IA; não prevê diretamente a probabilidade de citação num modelo específico</div></div>
    <div class="arrows" aria-hidden="true"><span>↓</span><span>↓</span><span>↓</span></div>
    <div class="pillars">${pillar("V")}${pillar("L")}${pillar("C")}</div>
    <div class="band"><div class="band-row">
      <span class="dotk"><i style="background:var(--s0)"></i>Encarnado: Inexistente (0 pts)</span>
      <span class="dotk"><i style="background:var(--s1)"></i>Amarelo: Iniciado (1 pt)</span>
      <span class="dotk"><i style="background:var(--s2)"></i>Verde: Consolidado (2 pts)</span>
      <span class="formula">${formula}</span></div>
      <div class="regra">${REGRA}${scored ? ` Score auditado com evidência pública a ${fmtDate(a.audit_date)} (30/30 critérios verificados).` : ""}</div></div>
    <section class="medicao"><div class="kicker">O que permite à marca melhorar a sua presença em IA</div><h3>MEDIÇÃO &amp; ITERAÇÃO</h3>
      <div class="cols">
        <div><h4>MONITORIZAÇÃO DAS RESPOSTAS <span>(a IA encontra, compreende e confia na marca?)</span></h4>
          <ul><li>Testes repetidos com painel fixo de prompts, modelos e datas</li><li>Presença por perguntas-alvo, categoria, serviço e localização</li><li>Fontes citadas pela IA e qualidade das menções</li><li>Sentimento, posicionamento e erros ou alucinações</li></ul></div>
        <div><h4>SISTEMA DE MELHORIA <span>(que ações corrigem os gaps encontrados?)</span></h4>
          <ul><li>Dashboard por Visibilidade, Legibilidade e Credibilidade</li><li>Backlog priorizado por impacto, esforço e owner</li><li>Sprints mensais de conteúdo, estrutura técnica e autoridade externa</li><li>Relatório com evolução vs concorrentes e próximos testes</li></ul></div>
      </div></section>
    <p class="credit">${esc(st.credit)}</p>
  </div>`;
}
function summaryView(a) {
  const cn = clientOf(a.client_id)?.name || "", P = a.pillars;
  const kpi = (k) => `<div class="kpi ${PKEY[k]}"><div class="lbl">${PNAME_T[k]}</div><div class="val">${P[k]}<small> / 20</small></div><div class="bar"><i style="width:${P[k] * 5}%"></i></div></div>`;
  const card = (k) => {
    const crit = a.criteria.filter((c) => c.id[0] === k), gaps = crit.filter((c) => c.score < 2).sort((x, y) => x.score - y.score);
    const n = [0, 1, 2].map((s) => crit.filter((c) => c.score === s).length);
    const pl = (x, one, many) => `${x} ${x === 1 ? one : many}`;
    const text = a.summary?.[k] || autoSummary(a, k);
    return `<article class="sum-card ${PKEY[k]}"><div><span class="badge">${PNAME_T[k]}</span><span class="ps">${P[k]}/20</span></div>
      <div>${editing() ? `<textarea class="ed-in" name="sum_${k}" rows="5" aria-label="Texto do pilar ${PNAME_T[k]}">${esc(text)}</textarea>` : `<p>${esc(text)}</p>`}${gaps.length ? `<div class="chips">${gaps.map((c) => `<button class="chip" data-id="${esc(c.id)}"><i style="background:var(--s${c.score})"></i><b>${esc(c.id)}</b>${esc(c.label.length > 48 ? c.label.slice(0, 46) + "…" : c.label)}</button>`).join("")}</div>` : ""}</div></article>`;
  };
  const body = `<div class="page-head"><div><div class="eyebrow">Resumo executivo · ${fmtDate(a.audit_date)} · Framework ${esc(a.framework)}</div><h1>${esc(cn)}</h1></div></div>
    ${editing() ? `<label class="ed-f dark"><span>Título da auditoria (aparece no Diagnóstico)</span><input class="ed-in dark" name="title" value="${esc(a.title || "")}" placeholder="Diagnóstico: ${esc(cn)} · ${fmtDate(a.audit_date)}"></label>` : ""}
    <div class="sum-head"><div class="kpi"><div class="lbl">AIR ${esc(cn)}</div><div class="val">${fmt(a.score_total)}<small> / 100</small></div><div class="bar"><i style="width:${a.score_total}%"></i></div></div>${kpi("V")}${kpi("L")}${kpi("C")}</div>
    <div class="sum-grid">${card("V")}${card("L")}${card("C")}</div>`;
  return editing() ? `<form id="ed-sum" novalidate>${body}<div class="ed-bar"><button class="btn primary" id="ed-sum-save">Guardar resumo</button></div></form>` : body;
}
function autoSummary(a, k) {
  const crit = a.criteria.filter((c) => c.id[0] === k), n = [0, 1, 2].map((s) => crit.filter((c) => c.score === s).length);
  const pl = (x, one, many) => `${x} ${x === 1 ? one : many}`;
  return `Neste pilar: ${pl(n[2], "critério consolidado", "critérios consolidados")}, ${pl(n[1], "iniciado", "iniciados")} e ${pl(n[0], "inexistente", "inexistentes")}. Os pontos por trabalhar estão abaixo; clique num para ver a evidência.`;
}
function wireSummaryEdit(a) {
  $("#ed-sum").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, summary = { ...(a.summary || {}) };
    ["V", "L", "C"].forEach((k) => { const v = f.elements["sum_" + k].value.trim(); if (v && v !== autoSummary(a, k)) summary[k] = v; else delete summary[k]; });
    await saveAudit(a, { title: f.elements.title.value.trim() || null, summary }, $("#ed-sum-save"), "Guardar resumo");
  });
}

/* ---------------------------------------------------------------- gravar (admin) */
async function saveAudit(a, patch, btn, label = "Guardar alterações") {
  if (patch.criteria) {                                   // pilares e total recalculados a partir das pontuações
    const P = { V: 0, L: 0, C: 0 }; patch.criteria.forEach((c) => { P[c.id[0]] += c.score; });
    patch.pillars = P; patch.score_total = Math.round((35 * P.V / 20 + 30 * P.L / 20 + 35 * P.C / 20) * 10) / 10;
  }
  if (btn) { btn.disabled = true; btn.textContent = "A guardar…"; }
  try {
    const row = await api.updateAudit(a.id, patch);
    Object.assign(a, row || patch); $("#panel").dataset.dirty = ""; closePanel(); render(); toast("Alterações guardadas");
  } catch (er) { toast("Não foi possível guardar: " + er.message); if (btn) { btn.disabled = false; btn.textContent = label; } }
}

/* ---------------------------------------------------------------- painel de evidência */
const SRC_ROW = (v) => `<div class="ed-src"><input class="ed-in" value="${esc(v)}" placeholder="dominio.pt/pagina" aria-label="Fonte"><button type="button" class="ed-rm" aria-label="Remover fonte">✕</button></div>`;
function editorHTML(c) {
  return `<div class="panel-head"><span class="id">${esc(c.id)}</span><h3 id="panel-title">Editar critério</h3><button class="x" aria-label="Fechar">✕</button></div>
    <form class="panel-body ed" id="ed-form" novalidate>
      <label class="ed-f"><span>Título do critério</span><input class="ed-in" name="label" value="${esc(c.label)}"></label>
      <label class="ed-f"><span>Pontuação</span><select class="ed-in" name="score">${SCORE_NAMES.map((n, i) => `<option value="${i}" ${i === c.score ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="ed-f"><span>Racional</span><textarea class="ed-in" name="rationale" rows="5">${esc(c.rationale)}</textarea></label>
      <div class="ed-f"><span>Fontes consultadas</span><div class="ed-srcs">${(c.sources || []).map(SRC_ROW).join("")}</div><button type="button" class="ed-add">+ Adicionar fonte</button></div>
      <label class="ed-f"><span>Citações-chave (extratos exatos)</span><textarea class="ed-in" name="quotes" rows="5">${esc(c.quotes)}</textarea></label>
      <label class="ed-f"><span>Link do Evidence Explorer <em>(só o admin vê)</em></span><input class="ed-in" name="proof_url" value="${esc(c.proof_url || "")}" placeholder="https://…"></label>
      <div class="ed-acts"><span class="ed-err" role="alert"></span><button type="button" class="btn ed-cancel">Cancelar</button><button class="btn ed-save">Guardar alterações</button></div>
    </form>`;
}
function openEditor(a, c, panel) {
  panel.innerHTML = editorHTML(c); panel.dataset.dirty = "";
  const f = $("#ed-form", panel), box = $(".ed-srcs", panel), dirty = () => { panel.dataset.dirty = "1"; };
  f.addEventListener("input", dirty); f.addEventListener("change", dirty);
  $(".ed-add", panel).addEventListener("click", () => { box.insertAdjacentHTML("beforeend", SRC_ROW("")); box.lastElementChild.querySelector("input").focus(); dirty(); });
  box.addEventListener("click", (e) => { const rm = e.target.closest(".ed-rm"); if (rm) { rm.parentElement.remove(); dirty(); } });
  $(".ed-cancel", panel).addEventListener("click", requestClose);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const label = f.elements.label.value.trim();
    if (!label) { $(".ed-err", panel).textContent = "O título do critério não pode ficar vazio."; return; }
    const next = { ...c, label, score: +f.elements.score.value, rationale: f.elements.rationale.value.trim(), quotes: f.elements.quotes.value.trim(),
      sources: [...box.querySelectorAll("input")].map((i) => i.value.trim()).filter(Boolean) };
    const pu = f.elements.proof_url.value.trim(); if (pu) next.proof_url = pu; else delete next.proof_url;
    await saveAudit(a, { criteria: a.criteria.map((x) => (x.id === c.id ? next : x)) }, $(".ed-save", panel));
  });
}
function openPanel(id) {
  const a = current(); const c = a?.criteria.find((x) => x.id === id); if (!c) return;
  const pk = PKEY[id[0]], panel = $("#panel");
  if (editing()) {
    panel.style.setProperty("--pc", `var(--${pk})`); openEditor(a, c, panel);
    panel.querySelector(".x").addEventListener("click", requestClose);
    $("#veil").classList.add("on"); panel.classList.add("on"); panel.scrollTop = 0; $("[name=label]", panel).focus({ preventScroll: true });
    return;
  }
  const src = (s) => /^[\w.-]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(s) ? `<a href="https://${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a>` : `<span>${esc(s)}</span>`;
  const isAdmin = S.me.role === "admin" && !S.preview;
  panel.style.setProperty("--pc", `var(--${pk})`); panel.style.setProperty("--pi", `var(--${pk}-ink)`);
  panel.innerHTML = `<div class="panel-head"><span class="id">${esc(id)}</span><h3 id="panel-title">${esc(c.label)}</h3><button class="x" aria-label="Fechar">✕</button></div>
    <div class="panel-body"><span class="spill s${c.score}"><i></i>${SCORE_NAMES[c.score]}</span>
      <div class="pb"><h4>Racional</h4><p>${esc(c.rationale)}</p></div>
      <div class="pb"><h4>Fontes consultadas</h4><div class="srcs">${(c.sources || []).map(src).join("")}</div></div>
      <div class="pb"><h4>Citações-chave (extratos exatos)</h4><div class="quote">${esc(c.quotes)}</div></div></div>
    ${isAdmin && c.proof_url ? `<div class="panel-foot"><a href="${esc(c.proof_url)}" target="_blank" rel="noopener">Abrir no Evidence Explorer ↗</a><span>Só visível para admin: screenshots e texto integral</span></div>` : ""}`;
  panel.dataset.dirty = "";
  panel.querySelector(".x").addEventListener("click", requestClose);
  $("#veil").classList.add("on"); panel.classList.add("on"); panel.scrollTop = 0; panel.querySelector(".x").focus({ preventScroll: true });
}
function closePanel() { $("#veil")?.classList.remove("on"); $("#panel")?.classList.remove("on"); }
async function requestClose() {                           // fecho pedido pelo utilizador: avisa se houver alterações por guardar
  const p = $("#panel");
  if (p?.dataset.dirty && !(await confirmDialog("Fechar sem guardar?", "As alterações a este critério perdem-se.", "Fechar sem guardar", true))) return;
  if (p) p.dataset.dirty = ""; closePanel();
}

/* ---------------------------------------------------------------- ligações comuns */
function wireCommon() {
  $("#logout")?.addEventListener("click", logout);
  root.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { S.tab = b.dataset.tab; render(); window.scrollTo({ top: 0 }); }));
  $("#audit-sel")?.addEventListener("change", (e) => { S.auditId = e.target.value; render(); });
}
// listeners delegados no #app (o elemento persiste entre renders; só o conteúdo muda)
root.addEventListener("click", (e) => { const el = e.target.closest(".crit.click,.chip[data-id]"); if (el) openPanel(el.dataset.id); });
root.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".crit.click")) { e.preventDefault(); openPanel(e.target.dataset.id); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.querySelector(".dialog-veil")) requestClose(); });
$("#veil").addEventListener("click", requestClose);

boot();
})();
