/* global supabase, RBF_CONFIG */
"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { locations: [], materials: [], movements: [], attachments: [], view: "dashboard", selectedMaterialId: null };
const STATUS_LABELS = { disponible: "Disponible", chantier: "En chantier", reparation: "En réparation", controle: "À contrôler" };
const DOCUMENT_LABELS = { facture_achat: "Facture d’achat", facture_reparation: "Facture de réparation", fiche_suivi: "Fiche de suivi", autre: "Autre document" };
let db = null;
let currentUser = null;
let toastTimer = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  const config = window.RBF_CONFIG || {};
  const valid = config.SUPABASE_URL?.startsWith("https://") && !config.SUPABASE_URL.includes("VOTRE-PROJET") && config.SUPABASE_PUBLISHABLE_KEY && !config.SUPABASE_PUBLISHABLE_KEY.includes("VOTRE_CLE");
  if (!valid) {
    hide("loading-screen");
    show("configuration-screen");
    return;
  }

  db = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  bindStaticEvents();
  const { data } = await db.auth.getSession();
  await applySession(data.session);
  db.auth.onAuthStateChange((_event, session) => setTimeout(() => applySession(session), 0));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

function bindStaticEvents() {
  $("#login-form").addEventListener("submit", login);
  $("#logout").addEventListener("click", () => db.auth.signOut());
  $("#add-location").addEventListener("click", () => openLocationModal());
  $("#add-location-inline").addEventListener("click", () => openLocationModal());
  $("#add-material").addEventListener("click", () => openMaterialModal());
  $("#add-material-inline").addEventListener("click", () => openMaterialModal());
  $("#location-modal").addEventListener("submit", submitLocation);
  $("#material-modal").addEventListener("submit", submitMaterial);
  $("#transfer-modal").addEventListener("submit", submitTransfer);
  $("#document-modal").addEventListener("submit", submitDocument);
  $("#search-material").addEventListener("input", renderInventory);
  $("#filter-location").addEventListener("change", renderInventory);
  $$("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$(".close-modal").forEach((button) => button.addEventListener("click", closeModals));
  $("#modal-backdrop").addEventListener("mousedown", (event) => { if (event.target === event.currentTarget) closeModals(); });
  $("#close-drawer").addEventListener("click", closeDrawer);
  $("#drawer-backdrop").addEventListener("mousedown", (event) => { if (event.target === event.currentTarget) closeDrawer(); });
  document.addEventListener("click", handleDynamicClick);
}

async function applySession(session) {
  hide("loading-screen");
  if (!session) {
    currentUser = null;
    hide("application");
    show("login-screen");
    return;
  }
  currentUser = session.user;
  hide("login-screen");
  show("application");
  $("#current-user").textContent = `Connexion sécurisée\n${currentUser.email || "Utilisateur"}`;
  await loadData();
}

async function login(event) {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Connexion…";
  const { error } = await db.auth.signInWithPassword({
    email: $("#login-email").value.trim(),
    password: $("#login-password").value,
  });
  button.disabled = false;
  button.textContent = "Se connecter";
  if (error) notify("Identifiants incorrects.", true);
}

async function loadData() {
  setBusy(true);
  try {
    const [locations, materials, movements, attachments] = await Promise.all([
      db.from("locations").select("*").order("type").order("name"),
      db.from("materials").select("*").order("updated_at", { ascending: false }),
      db.from("movements").select("*, from_location:locations!movements_from_location_id_fkey(name), to_location:locations!movements_to_location_id_fkey(name)").order("moved_at", { ascending: false }).limit(500),
      db.from("attachments").select("*").order("uploaded_at", { ascending: false }),
    ]);
    [locations, materials, movements, attachments].forEach((result) => { if (result.error) throw result.error; });
    state.locations = locations.data || [];
    state.materials = materials.data || [];
    state.movements = (movements.data || []).map((movement) => ({
      ...movement,
      from_location_name: movement.from_location?.name || null,
      to_location_name: movement.to_location?.name || "Emplacement inconnu",
    }));
    state.attachments = attachments.data || [];
    renderAll();
  } catch (error) {
    notify(error.message || "Impossible de charger les données.", true);
  } finally {
    setBusy(false);
  }
}

function renderAll() {
  renderStats();
  renderLocations();
  fillLocationSelects();
  renderInventory();
  $("#recent-movements").innerHTML = movementHtml(state.movements.slice(0, 5));
  $("#all-movements").innerHTML = movementHtml(state.movements, true);
  $("#movement-count").textContent = `${state.movements.length} mouvement${state.movements.length > 1 ? "s" : ""}`;
  if (state.selectedMaterialId) renderDrawer();
}

function renderStats() {
  const pieces = state.materials.reduce((sum, material) => sum + Number(material.quantity), 0);
  const chantiers = state.locations.filter((location) => location.type === "chantier" && location.status === "active").length;
  const repairs = state.materials.filter((material) => material.status === "reparation").length;
  $("#stats").innerHTML = [
    statHtml("▦", "Matériel suivi", pieces, `${state.materials.length} référence${state.materials.length > 1 ? "s" : ""}`),
    statHtml("⌂", "Chantiers actifs", chantiers, "hors dépôt"),
    statHtml("⚒", "En réparation", repairs, "à surveiller", repairs > 0),
    statHtml("▤", "Documents", state.attachments.length, "factures et fiches"),
  ].join("");
}

function statHtml(icon, label, value, detail, warning = false) {
  return `<article class="stat ${warning ? "warning" : ""}"><div class="stat-icon">${icon}</div><div><span>${label}</span><strong>${value}</strong><small>${detail}</small></div></article>`;
}

function renderLocations() {
  const active = state.locations.filter((location) => location.status === "active");
  $("#location-grid").innerHTML = active.map((location) => {
    const quantity = state.materials.filter((material) => material.location_id === location.id).reduce((sum, material) => sum + Number(material.quantity), 0);
    return `<article class="location-card ${location.type}">
      <div class="location-icon">${location.type === "depot" ? "▣" : "⌂"}</div>
      <button class="edit-icon" data-action="edit-location" data-id="${location.id}" title="Modifier">✎</button>
      <small>${location.type === "depot" ? "Dépôt" : "Chantier"}</small>
      <h3>${escapeHtml(location.name)}</h3>
      <p>⌖ ${escapeHtml(location.address || "Adresse à renseigner")}</p>
      <div><strong>${quantity} pièce${quantity > 1 ? "s" : ""}</strong><button data-action="view-location" data-id="${location.id}">Voir le stock ›</button></div>
    </article>`;
  }).join("") || `<div class="empty-small">Aucun emplacement actif.</div>`;
}

function renderInventory() {
  const query = $("#search-material").value.trim().toLowerCase();
  const locationFilter = $("#filter-location").value;
  const locations = new Map(state.locations.map((location) => [location.id, location]));
  const materials = state.materials.filter((material) => {
    const text = `${material.name} ${material.category} ${material.serial_number} ${material.description}`.toLowerCase();
    return (locationFilter === "all" || material.location_id === locationFilter) && (!query || text.includes(query));
  });
  if (!materials.length) {
    $("#inventory-content").innerHTML = `<div class="empty"><p>Aucun matériel trouvé.</p></div>`;
    return;
  }
  $("#inventory-content").innerHTML = `<div class="table-wrap"><table><thead><tr><th>Matériel</th><th>Emplacement</th><th>Quantité</th><th>Statut</th><th>Documents</th><th>Actions</th></tr></thead><tbody>${materials.map((material) => {
    const documents = state.attachments.filter((attachment) => attachment.tracking_group_id === material.tracking_group_id).length;
    return `<tr data-action="open-material" data-id="${material.id}">
      <td data-label="Matériel"><div class="material-name"><span>${material.category === "Passerelle" ? "▥" : "⚒"}</span><div><strong>${escapeHtml(material.name)}</strong><small>${escapeHtml(material.category)}${material.serial_number ? ` · N° ${escapeHtml(material.serial_number)}` : ""}</small></div></div></td>
      <td data-label="Emplacement">${escapeHtml(locations.get(material.location_id)?.name || "Inconnu")}</td>
      <td data-label="Quantité"><strong>${material.quantity}</strong> ${escapeHtml(material.unit)}</td>
      <td data-label="Statut">${statusHtml(material.status)}</td>
      <td data-label="Documents">${documents ? `⌕ ${documents}` : "—"}</td>
      <td data-label="Actions"><div class="table-actions"><button class="small-button" data-action="transfer-material" data-id="${material.id}">⇢ Transférer</button><button class="small-button" data-action="edit-material" data-id="${material.id}">✎</button></div></td>
    </tr>`;
  }).join("")}</tbody></table></div>`;
}

function movementHtml(movements, detailed = false) {
  if (!movements.length) return `<div class="empty-small">Aucun mouvement enregistré.</div>`;
  return `<div class="movements">${movements.map((movement) => `<article class="movement"><span class="movement-icon ${movement.movement_type}">→</span><div><div><strong>${escapeHtml(movement.material_name)}</strong><small>${movement.quantity} unité${movement.quantity > 1 ? "s" : ""}</small></div><p>${movement.from_location_name ? `${escapeHtml(movement.from_location_name)} → ` : "Ajouté à "}<b>${escapeHtml(movement.to_location_name)}</b></p>${detailed && movement.note ? `<em>${escapeHtml(movement.note)}</em>` : ""}</div><time>${formatDate(movement.moved_at)}</time></article>`).join("")}</div>`;
}

function fillLocationSelects() {
  const active = state.locations.filter((location) => location.status === "active");
  const filterValue = $("#filter-location").value;
  $("#filter-location").innerHTML = `<option value="all">Tous les emplacements</option>${state.locations.map((location) => `<option value="${location.id}">${escapeHtml(location.name)}</option>`).join("")}`;
  $("#filter-location").value = state.locations.some((location) => location.id === filterValue) ? filterValue : "all";
  $("#material-location").innerHTML = `<option value="">Choisir</option>${active.map((location) => `<option value="${location.id}">${escapeHtml(location.name)}</option>`).join("")}`;
}

function setView(view) {
  state.view = view;
  $$(".view-panel").forEach((panel) => panel.classList.add("hidden"));
  $(`#view-${view}`).classList.remove("hidden");
  $$(`[data-view]`).forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  if (view === "inventory") renderInventory();
}

function handleDynamicClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (action === "edit-location") openLocationModal(state.locations.find((location) => location.id === id));
  if (action === "view-location") { $("#filter-location").value = id; setView("inventory"); }
  if (action === "edit-material") { event.stopPropagation(); openMaterialModal(state.materials.find((material) => material.id === id)); }
  if (action === "transfer-material") { event.stopPropagation(); openTransferModal(id); }
  if (action === "open-material") openDrawer(id);
  if (action === "drawer-edit") openMaterialModal(state.materials.find((material) => material.id === id));
  if (action === "drawer-transfer") openTransferModal(id);
  if (action === "drawer-document") openDocumentModal(id);
  if (action === "open-document") openDocument(id);
}

function openLocationModal(location = null) {
  $("#location-modal-title").textContent = location ? "Modifier l’emplacement" : "Ajouter un emplacement";
  $("#location-id").value = location?.id || "";
  $("#location-type").value = location?.type || "chantier";
  $("#location-name").value = location?.name || "";
  $("#location-address").value = location?.address || "";
  $("#location-manager").value = location?.manager || "";
  $("#location-status").value = location?.status || "active";
  showModal("location-modal");
}

function openMaterialModal(material = null) {
  fillLocationSelects();
  $("#material-modal-title").textContent = material ? "Modifier le matériel" : "Ajouter du matériel";
  $("#material-id").value = material?.id || "";
  $("#material-name").value = material?.name || "";
  $("#material-category").value = material?.category || "Électroportatif";
  $("#material-location").value = material?.location_id || state.locations.find((location) => location.status === "active")?.id || "";
  $("#material-status").value = material?.status || "disponible";
  $("#material-quantity").value = material?.quantity || 1;
  $("#material-unit").value = material?.unit || "pièce";
  $("#material-serial").value = material?.serial_number || "";
  $("#material-description").value = material?.description || "";
  showModal("material-modal");
}

function openTransferModal(materialId) {
  const material = state.materials.find((item) => item.id === materialId);
  if (!material) return;
  $("#transfer-material-id").value = material.id;
  $("#transfer-description").textContent = `${material.name} · ${material.quantity} ${material.unit}`;
  $("#transfer-quantity").value = material.quantity;
  $("#transfer-quantity").max = material.quantity;
  $("#transfer-note").value = "";
  $("#transfer-destination").innerHTML = `<option value="">Choisir</option>${state.locations.filter((location) => location.status === "active" && location.id !== material.location_id).map((location) => `<option value="${location.id}">${escapeHtml(location.name)}</option>`).join("")}`;
  showModal("transfer-modal");
}

function openDocumentModal(materialId) {
  const material = state.materials.find((item) => item.id === materialId);
  if (!material) return;
  $("#document-material-id").value = material.id;
  $("#document-description").textContent = `Document associé à ${material.name}.`;
  $("#document-type").value = material.category === "Passerelle" ? "fiche_suivi" : "facture_achat";
  $("#document-file").value = "";
  showModal("document-modal");
}

async function submitLocation(event) {
  event.preventDefault();
  const id = $("#location-id").value;
  const payload = { name: $("#location-name").value.trim(), type: $("#location-type").value, address: $("#location-address").value.trim(), manager: $("#location-manager").value.trim(), status: $("#location-status").value };
  await execute(async () => {
    const result = id ? await db.from("locations").update(payload).eq("id", id) : await db.from("locations").insert(payload);
    if (result.error) throw result.error;
  }, id ? "Emplacement modifié." : "Emplacement ajouté.");
}

async function submitMaterial(event) {
  event.preventDefault();
  const id = $("#material-id").value;
  const payload = { name: $("#material-name").value.trim(), category: $("#material-category").value, location_id: $("#material-location").value, status: $("#material-status").value, quantity: Number($("#material-quantity").value), unit: $("#material-unit").value.trim() || "pièce", serial_number: $("#material-serial").value.trim(), description: $("#material-description").value.trim() };
  await execute(async () => {
    if (id) {
      const result = await db.from("materials").update(payload).eq("id", id);
      if (result.error) throw result.error;
    } else {
      const result = await db.from("materials").insert(payload).select().single();
      if (result.error) throw result.error;
      const movement = await db.from("movements").insert({ material_id: result.data.id, tracking_group_id: result.data.tracking_group_id, material_name: result.data.name, from_location_id: null, to_location_id: result.data.location_id, quantity: result.data.quantity, movement_type: "ajout", note: "Ajout du matériel à l’inventaire", actor: currentUser.email || "Utilisateur" });
      if (movement.error) throw movement.error;
    }
  }, id ? "Matériel modifié." : "Matériel ajouté.");
}

async function submitTransfer(event) {
  event.preventDefault();
  const materialId = $("#transfer-material-id").value;
  await execute(async () => {
    const result = await db.rpc("transfer_material", { p_material_id: materialId, p_destination_id: $("#transfer-destination").value, p_quantity: Number($("#transfer-quantity").value), p_note: $("#transfer-note").value.trim() });
    if (result.error) throw result.error;
  }, "Transfert enregistré.");
}

async function submitDocument(event) {
  event.preventDefault();
  const material = state.materials.find((item) => item.id === $("#document-material-id").value);
  const file = $("#document-file").files[0];
  if (!material || !file) return;
  if (file.size > 15 * 1024 * 1024) { notify("Le fichier dépasse 15 Mo.", true); return; }
  await execute(async () => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "document";
    const path = `${material.tracking_group_id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await db.storage.from("materiel-documents").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upload.error) throw upload.error;
    const insert = await db.from("attachments").insert({ material_id: material.id, tracking_group_id: material.tracking_group_id, document_type: $("#document-type").value, file_name: file.name, storage_path: path, mime_type: file.type || "application/octet-stream", size_bytes: file.size });
    if (insert.error) { await db.storage.from("materiel-documents").remove([path]); throw insert.error; }
  }, "Document ajouté.");
}

async function execute(action, successMessage) {
  setBusy(true);
  try {
    await action();
    closeModals();
    await loadData();
    notify(successMessage);
  } catch (error) {
    notify(error.message || "Enregistrement impossible.", true);
  } finally {
    setBusy(false);
  }
}

function openDrawer(materialId) {
  state.selectedMaterialId = materialId;
  renderDrawer();
  show("drawer-backdrop");
}

function renderDrawer() {
  const material = state.materials.find((item) => item.id === state.selectedMaterialId);
  if (!material) { closeDrawer(); return; }
  const location = state.locations.find((item) => item.id === material.location_id);
  const movements = state.movements.filter((item) => item.tracking_group_id === material.tracking_group_id);
  const attachments = state.attachments.filter((item) => item.tracking_group_id === material.tracking_group_id);
  $("#drawer-content").innerHTML = `<div class="drawer-head"><span class="drawer-symbol">${material.category === "Passerelle" ? "▥" : "⚒"}</span><h2>${escapeHtml(material.name)}</h2><p>${escapeHtml(material.category)} · ${escapeHtml(location?.name || "Emplacement inconnu")}</p></div><div class="drawer-body"><div class="drawer-actions"><button class="button primary" data-action="drawer-transfer" data-id="${material.id}">⇢ Transférer</button><button class="button secondary" data-action="drawer-edit" data-id="${material.id}">✎ Modifier</button><button class="button secondary" data-action="drawer-document" data-id="${material.id}">⌕ Document</button></div><div class="details"><div><small>Quantité</small><strong>${material.quantity} ${escapeHtml(material.unit)}</strong></div><div><small>Statut</small>${statusHtml(material.status)}</div><div><small>N° de série</small><strong>${escapeHtml(material.serial_number || "Non renseigné")}</strong></div><div><small>Emplacement</small><strong>${escapeHtml(location?.name || "Inconnu")}</strong></div></div>${material.description ? `<section class="drawer-section"><header><h3>Description</h3></header><p>${escapeHtml(material.description)}</p></section>` : ""}<section class="drawer-section"><header><h3>Documents</h3><button class="text-button" data-action="drawer-document" data-id="${material.id}">＋ Ajouter</button></header>${attachments.length ? attachments.map((attachment) => `<button class="document-item" data-action="open-document" data-id="${attachment.id}"><b>▤</b><span><strong>${escapeHtml(attachment.file_name)}</strong><small>${DOCUMENT_LABELS[attachment.document_type] || "Document"} · ${formatSize(attachment.size_bytes)}</small></span><b>›</b></button>`).join("") : `<div class="empty-small">Aucun document joint.</div>`}</section><section class="drawer-section"><header><h3>Historique</h3></header>${movementHtml(movements, true)}</section></div>`;
}

async function openDocument(attachmentId) {
  const attachment = state.attachments.find((item) => item.id === attachmentId);
  if (!attachment) return;
  const result = await db.storage.from("materiel-documents").createSignedUrl(attachment.storage_path, 120);
  if (result.error) { notify(result.error.message, true); return; }
  window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
}

function showModal(id) {
  $$("#modal-backdrop .modal").forEach((modal) => modal.classList.add("hidden"));
  $("#modal-backdrop").classList.remove("hidden");
  $(`#${id}`).classList.remove("hidden");
}
function closeModals() { $("#modal-backdrop").classList.add("hidden"); $$("#modal-backdrop .modal").forEach((modal) => modal.classList.add("hidden")); }
function closeDrawer() { state.selectedMaterialId = null; hide("drawer-backdrop"); }
function statusHtml(status) { return `<span class="status status-${status}"><i></i>${STATUS_LABELS[status] || escapeHtml(status)}</span>`; }
function setBusy(busy) { document.body.style.cursor = busy ? "wait" : ""; $$('button[type="submit"]').forEach((button) => { button.disabled = busy; }); }
function show(id) { $(`#${id}`).classList.remove("hidden"); }
function hide(id) { $(`#${id}`).classList.add("hidden"); }
function formatDate(value) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function notify(message, error = false) { clearTimeout(toastTimer); const toast = $("#toast"); toast.textContent = message; toast.className = `toast show ${error ? "error" : ""}`; toastTimer = setTimeout(() => { toast.className = "toast"; }, 3500); }
