import { $, hoje, esc, RE_DOI, limpaDoi, ler, gravar, anexar, csv, baixar, resolver, buscarPorTexto, abnt, resumoObra, zoteroAlvos, zoteroSalvar, marcas, codigos, openalexObra, openalexCitantes, openalexReferencias, openalexBusca, doaj, sha256, duplicatas, prisma, manualDaFase, lerCsv } from "./lib.js";

let pagina = null, obra = null, ref = "";
const idb = () => new Promise((ok, err) => { const q = indexedDB.open("pesquisa-mt", 1); q.onupgradeneeded = () => q.result.createObjectStore("kv"); q.onsuccess = () => ok(q.result); q.onerror = () => err(q.error); });
async function idbGet(k) { const db = await idb(); return new Promise((ok) => { const r = db.transaction("kv").objectStore("kv").get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); }); }
async function idbSet(k, v) { const db = await idb(); return new Promise((ok) => { const r = db.transaction("kv", "readwrite").objectStore("kv").put(v, k); r.onsuccess = () => ok(); r.onerror = () => ok(); }); }
$("ver").textContent = "v" + chrome.runtime.getManifest().version;

// ---- abas ----
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button, section").forEach(e => e.classList.remove("on"));
  b.classList.add("on"); $(b.dataset.t).classList.add("on"); gravar("aba", b.dataset.t); if (b.dataset.t === "prj") estatisticas();
});

const TAB_FIXA = Number(new URLSearchParams(location.search).get("tab")) || null; // aberto em aba inteira: lê a aba de origem
if (TAB_FIXA) document.body.classList.add("aba");
const PAINEL = new URLSearchParams(location.search).get("painel") === "1"; if (PAINEL) document.body.classList.add("painel");
async function abrirAba(foco) { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?tab=" + (TAB_FIXA || t?.id || "") + (foco ? "&foco=" + foco : "")) }); }
$("abaCheia").onclick = () => abrirAba(); if (PAINEL) $("abaCheia").hidden = true;
// O seletor de pasta do sistema fecha o popup (perde o foco). Fora do modo aba, esses botões abrem a aba inteira e apontam para o botão certo.
function soNaAba(idBotao, aviso) {
  if (TAB_FIXA) return true;
  $(aviso).innerHTML = '<span class="no">o popup fecha quando o seletor de pasta abre — abrindo em uma aba inteira…</span>';
  setTimeout(() => abrirAba(idBotao), 600); return false;
}
async function lerPagina() {
  const tab = TAB_FIXA ? await chrome.tabs.get(TAB_FIXA).catch(() => null) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id) return null;
  if (tab.url && !/^https?:/.test(tab.url)) return null; // sem a permissão «tabs» o Chrome esconde a URL: tenta ler mesmo assim
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  return result;
}

// ================= Referência =================
async function resolverDoi(doi) {
  $("doi").textContent = "DOI: " + doi + " — consultando Crossref…";
  const r = await resolver(doi);
  if (!r.ok) { $("doi").innerHTML = `DOI: ${esc(doi)} — <span class="no">${r.status === 404 ? "não existe no Crossref. Não entra na biblioteca." : "Crossref respondeu " + r.status}</span>`; return; }
  obra = r.obra; ref = abnt(obra); $("refbox").textContent = ref;
  $("doi").innerHTML = `DOI: ${esc(doi)} — <span class="ok">existe no Crossref</span> · ${esc(obra.type || "")} · <b>confira título e autores com a página</b>`;
  cartaoPeriodico(obra); carregarOpenAlex(doi);
}
async function cartaoPeriodico(w) {
  const per = (w["container-title"] || [""])[0]; if (!per) return;
  const issn = w.ISSN || []; const d = await doaj(issn);
  $("periodico").innerHTML = `Periódico: <b>${esc(per)}</b>${issn.length ? " · ISSN " + esc(issn.join(", ")) : ""}${w.publisher ? " · " + esc(w.publisher) : ""} · DOAJ: ${d.listado ? `<span class="ok">acesso aberto listado${d.apc === false ? ", sem APC" : d.apc ? ", com APC" : ""}${d.licenca ? " · " + esc(d.licenca) : ""}</span>` : '<span class="muted">não listado (não é sinal de problema; DOAJ só lista periódicos de acesso aberto)</span>'}`;
}
let oa = null;
async function carregarOpenAlex(doi) {
  oa = await openalexObra(doi);
  $("oainfo").innerHTML = oa ? `OpenAlex: <b>${oa.cited_by_count}</b> citações recebidas · <b>${(oa.referenced_works || []).length}</b> referências · ${oa.open_access?.is_oa ? '<span class="ok">acesso aberto</span>' : "sem versão aberta conhecida"}` : '<span class="muted">não está no OpenAlex</span>';
}
async function paraTriagem(lista, origem) {
  if (!lista.length) { $("oainfo").textContent = "nada devolvido"; return; }
  pagina = pagina || {}; pagina.records = lista; pagina.base = "OpenAlex (" + origem + ")";
  document.querySelector('nav button[data-t="tri"]').click(); desenharTriagem(); $("tst").textContent = `${lista.length} registro(s) de ${origem} — decida um a um`;
}
$("oacita").onclick = async () => { if (oa) paraTriagem(await openalexCitantes(oa.id), "quem cita " + (pagina?.doi || "")); };
$("oaref").onclick = async () => { if (oa) paraTriagem(await openalexReferencias(oa.referenced_works), "referências de " + (pagina?.doi || "")); };
async function resolverManual() {
  const d = limpaDoi(($("doiman").value.match(RE_DOI) || [])[0]); if (!d) { $("doi").innerHTML = '<span class="no">não reconheci um DOI (formato 10.xxxx/…)</span>'; return; }
  pagina = pagina || {}; pagina.doi = d; await resolverDoi(d);
}
$("doigo").onclick = resolverManual; $("doiman").addEventListener("keydown", (e) => { if (e.key === "Enter") resolverManual(); });
$("copiar").onclick = async () => { if (ref) { await navigator.clipboard.writeText(ref); $("copiar").textContent = "Copiado ✔"; } };
$("abrir").onclick = () => { if (pagina?.doi) chrome.tabs.create({ url: "https://search.crossref.org/?q=" + encodeURIComponent(pagina.doi) }); };
async function carregarZotero() {
  const z = await zoteroAlvos(); const sel = $("zalvo");
  if (!z.ok) { $("zst").innerHTML = '<span class="muted">Zotero fechado (127.0.0.1:23119)</span>'; return; }
  sel.innerHTML = `<option value="">${esc(z.atual || "coleção selecionada")} (atual)</option>` + z.alvos.map(t => `<option value="${esc(t.id)}">${"  ".repeat(t.level || 0)}${esc(t.name)}</option>`).join("");
  $("zst").innerHTML = '<span class="ok">Zotero aberto</span>';
}
$("zotero").onclick = async () => {
  if (!obra) { $("zst").textContent = "resolva um DOI primeiro"; return; }
  const etq = $("zetq").value.split(",").map(s => s.trim()).filter(Boolean);
  const r = await zoteroSalvar(obra, $("zalvo").value, etq);
  $("zst").innerHTML = r.ok ? '<span class="ok">salvo no Zotero ✔</span>' : (r.status ? `<span class="no">Zotero respondeu ${r.status}</span>` : '<span class="no">Zotero fechado (127.0.0.1:23119)</span>');
};

// ================= Auditoria em lote =================
let auditoria = [];
$("audtri").onclick = async () => {
  const d = Object.values(await ler("decisoes", {})).filter(x => x.decisao === "INCLUDE" || x.decisao === "MAYBE");
  const linhas = d.map(x => (RE_DOI.test(x.study_id) ? x.study_id : x.titulo) + (x.titulo && RE_DOI.test(x.study_id) ? "  " + x.titulo.slice(0, 80) : ""));
  if (!linhas.length) { $("audst").textContent = "nenhum INCLUDE/MAYBE na triagem ainda"; return; }
  $("audtx").value = linhas.join("\n"); $("audst").textContent = `${linhas.length} registro(s) da triagem carregado(s) — clique em Auditar`;
};
$("audrun").onclick = async () => {
  const linhas = $("audtx").value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!linhas.length) return; auditoria = []; $("audout").innerHTML = '<div class="muted">consultando…</div>';
  for (const [i, l] of linhas.entries()) {
    const doi = limpaDoi(l.match(RE_DOI)?.[0]); let item = { n: i + 1, linha: l, doi, veredito: "", titulo: "", ano: "", periodico: "", doi_encontrado: "" };
    if (doi) {
      const r = await resolver(doi);
      if (r.ok) { const o = resumoObra(r.obra); item.obra = r.obra; Object.assign(item, { veredito: "existe — confira metadados", titulo: o.titulo, ano: o.ano, periodico: o.periodico, doi_encontrado: o.doi }); }
      else item.veredito = r.status === 404 ? "NÃO EXISTE no Crossref" : "erro " + r.status;
    } else {
      const c = await buscarPorTexto(l);
      if (c.length) { const o = resumoObra(c[0].obra); Object.assign(item, { veredito: `sem DOI — candidato (score ${Math.round(c[0].score)}), conferir`, titulo: o.titulo, ano: o.ano, periodico: o.periodico, doi_encontrado: o.doi }); }
      else item.veredito = "sem DOI — nenhum candidato";
    }
    auditoria.push(item); desenharAuditoria();
    await new Promise(r => setTimeout(r, 150)); // gentileza com a API
  }
};
function desenharAuditoria() {
  const cls = (v) => v.startsWith("existe") ? "ok" : v.startsWith("NÃO") ? "no" : "";
  $("audout").innerHTML = `<table><tr><th>#</th><th>Veredito</th><th>Crossref devolveu</th></tr>` + auditoria.map(a =>
    `<tr><td>${a.n}</td><td class="${cls(a.veredito)}">${esc(a.veredito)}</td><td>${esc(a.titulo)}${a.titulo ? "<br>" : ""}<span class="muted">${esc(a.periodico)} ${esc(a.ano)} ${a.doi_encontrado ? "· " + esc(a.doi_encontrado) : ""}</span></td></tr>`).join("") + "</table>";
}
$("audzot").onclick = async () => {
  const ok = auditoria.filter(a => a.obra); if (!ok.length) { $("audst").textContent = "nada com DOI resolvido para salvar"; return; }
  const etq = ($("zetq").value || "conferido-crossref").split(",").map(s => s.trim()).filter(Boolean); let n = 0, falha = 0;
  for (const a of ok) { const r = await zoteroSalvar(a.obra, $("zalvo").value, etq); r.ok ? n++ : falha++; $("audst").textContent = `salvando… ${n + falha}/${ok.length}`; await new Promise(r => setTimeout(r, 300)); }
  $("audst").innerHTML = `<span class="${falha ? "no" : "ok"}">${n} salvo(s) no Zotero${falha ? `, ${falha} falha(s) (Zotero aberto?)` : ""}</span> — as linhas «candidato» e «NÃO EXISTE» não foram salvas.`;
};
$("audcsv").onclick = () => auditoria.length && baixar(`auditoria_referencias_${hoje()}.csv`, csv(["n", "linha", "doi_na_linha", "veredito", "titulo_crossref", "periodico", "ano", "doi_crossref"], auditoria.map(a => [a.n, a.linha, a.doi, a.veredito, a.titulo, a.periodico, a.ano, a.doi_encontrado])));

// ================= Diário de busca =================
async function desenharDiario() {
  const d = await ler("buscas", []);
  $("dlist").innerHTML = d.length ? `<h2>${d.length} busca(s) registrada(s)</h2>` + d.slice(-8).reverse().map((b, i) =>
    `<div class="rec"><div class="t">${esc(b.base)} · ${esc(b.total_retornado || "?")} resultados <span class="m">${esc(b.data)}</span></div><div class="m">${esc(b.string_verbatim)}</div>${b.filtros ? `<div class="m">filtros: ${esc(b.filtros)}</div>` : ""}</div>`).join("") : "";
}
let shaArquivo = "";
$("dfile").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; shaArquivo = await sha256(f); $("darq").value = f.name; $("dsha").textContent = "sha256 " + shaArquivo; };
$("dreg").onclick = async () => {
  const b = { data: hoje(), base: $("dbase").value.trim(), string_verbatim: $("dquery").value.trim(), filtros: $("dfiltros").value.trim(), total_retornado: $("dcount").value.trim(), arquivo_exportado: $("darq").value.trim(), sha256: shaArquivo, url: pagina?.href || "" };
  if (!b.string_verbatim) { $("dst").textContent = "a string exata é obrigatória"; return; }
  if (!b.total_retornado) { $("dst").textContent = "registre o total que está na tela"; return; }
  const n = await anexar("buscas", b); $("dst").textContent = `registrada (${n})`; shaArquivo = ""; $("dsha").textContent = ""; desenharDiario();
};
$("dcsv").onclick = async () => { const d = await ler("buscas", []); if (d.length) baixar("buscas.csv", csv(["data", "base", "string_verbatim", "filtros", "total_retornado", "arquivo_exportado", "sha256"], d.map(b => [b.data, b.base, b.string_verbatim, b.filtros, b.total_retornado, b.arquivo_exportado, b.sha256]))); };

// ================= Busca no OpenAlex =================
let oaRes = null, oaPag = 1, oaItens = [];
async function buscarOA(mais = false) {
  const q = $("oaq").value.trim(); if (!q) { $("oast").textContent = "escreva a string"; return; }
  if (!mais) { oaPag = 1; oaItens = []; } else oaPag++;
  $("oast").textContent = "consultando OpenAlex…";
  const r = await openalexBusca(q, { de: $("oade").value.trim(), ate: $("oaate").value.trim(), soArtigos: $("oaart").checked, pagina: oaPag });
  if (!r.ok) { $("oast").innerHTML = `<span class="no">OpenAlex respondeu ${r.status}</span>`; return; }
  oaRes = r; oaItens = oaItens.concat(r.itens);
  $("oast").innerHTML = `<b>${r.total.toLocaleString("pt-BR")}</b> resultados · mostrando ${oaItens.length} · ${hoje()}${r.filtros ? " · filtros: " + esc(r.filtros) : ""}`;
  $("oalist").innerHTML = oaItens.map(w => `<div class="rec"><div class="t">${esc(w.title)}</div><div class="m">${esc(w.id)} · ${esc(w.fonte)}</div></div>`).join("");
  ["oamais", "oatri", "oacsv", "oadiario"].forEach(id => $(id).hidden = false); $("oamais").hidden = oaItens.length >= r.total;
}
$("oabuscar").onclick = () => buscarOA(false); $("oamais").onclick = () => buscarOA(true);
$("oaq").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); buscarOA(false); } });
$("oatri").onclick = () => { pagina = pagina || {}; pagina.records = oaItens.map(w => ({ id: w.id, title: w.title, fonte: w.fonte })); pagina.base = "OpenAlex"; pagina.href = oaRes.url; document.querySelector('nav button[data-t="tri"]').click(); desenharTriagem(); $("tst").textContent = `${oaItens.length} registro(s) do OpenAlex — decida um a um`; };
$("oacsv").onclick = () => baixar(`openalex_${hoje()}.csv`, csv(["id", "titulo", "ano", "periodico", "citacoes", "acesso_aberto", "tipo"], oaItens.map(w => [w.id, w.title, w.ano, w.periodico, w.cit, w.oa ? "sim" : "não", w.tipo])));
$("oadiario").onclick = async () => {
  const b = { data: hoje(), base: "OpenAlex", string_verbatim: $("oaq").value.trim(), filtros: oaRes.filtros, total_retornado: String(oaRes.total), arquivo_exportado: "", sha256: "", url: oaRes.url };
  const n = await anexar("buscas", b); $("oast").innerHTML += ` · <span class="ok">registrada no diário (${n})</span>`; desenharDiario();
};
// ================= Triagem =================
let decisoes = {}, ocultos = [];
async function desenharTriagem() {
  const cods = await codigos(); const opts = cods.map(([c, d]) => `<option value="${c}">${c} — ${esc(d)}</option>`).join("");
  $("tcod").innerHTML = opts;
  decisoes = await ler("decisoes", {}); ocultos = await ler("ocultos", []);
  const todos = pagina?.records || []; const mostrarOcultos = $("tocultos").checked;
  const recs = todos.filter(r => mostrarOcultos || !ocultos.includes(r.id));
  if (!todos.length) { $("tlist").innerHTML = '<div class="warn">Nenhum registro reconhecido nesta página. Funciona em páginas de resultados (PubMed, SciELO, Google Scholar, Crossref), em qualquer página com links doi.org e nas listas do snowballing (aba Referência).</div>'; return; }
  const dup = duplicatas(recs, decisoes); const nOc = todos.filter(r => ocultos.includes(r.id)).length;
  $("tinfo").textContent = `${recs.length} registro(s)${nOc ? ` · ${nOc} oculto(s)` : ""} · ${Object.keys(decisoes).length} decisão(ões) guardada(s) no total`;
  $("tlist").innerHTML = recs.map(r => { const d = decisoes[r.id]; const oc = ocultos.includes(r.id); const cls = d ? (d.decisao === "INCLUDE" ? "inc" : d.decisao === "EXCLUDE" ? "exc" : "may") : "";
    return `<div class="rec ${cls}${oc ? " oc" : ""}" data-id="${esc(r.id)}"><div class="t">${esc(r.title)} <button class="x" data-d="${oc ? "MOSTRAR" : "OCULTAR"}" title="${oc ? "voltar a mostrar" : "não é um estudo / lixo da página: tirar da lista (não é decisão de triagem)"}">${oc ? "↩" : "✕"}</button></div>
      <div class="m">${esc(r.id)} ${r.fonte ? "· " + esc(r.fonte) : ""}</div>${dup[r.id] ? `<div class="warn">⚠ ${esc(dup[r.id])}</div>` : ""}
      ${d ? `<div class="m"><b>${d.decisao}${d.codigo ? " " + d.codigo : ""}</b> · ${esc(d.data)}${d.nota ? " · " + esc(d.nota) : ""} <button class="b o s" data-d="LIMPAR">limpar</button></div>`
          : `<div class="row"><select class="cod">${opts}</select><input class="nota" placeholder="nota (opcional): por quê?"></div>
             <button class="b g s" data-d="INCLUDE">INCLUDE</button><button class="b r s" data-d="EXCLUDE">EXCLUDE</button><button class="b y s" data-d="MAYBE">MAYBE</button>`}</div>`; }).join("");
  $("tlist").querySelectorAll("select.cod").forEach(s => s.value = $("tcod").value);
  $("tlist").querySelectorAll("button[data-d]").forEach(b => b.onclick = async () => {
    const el = b.closest(".rec"); const id = el.dataset.id; const rec = todos.find(r => r.id === id); const acao = b.dataset.d;
    if (acao === "OCULTAR") { ocultos.push(id); await gravar("ocultos", ocultos); desenharTriagem(); return; }
    if (acao === "MOSTRAR") { ocultos = ocultos.filter(x => x !== id); await gravar("ocultos", ocultos); desenharTriagem(); return; }
    if (acao === "LIMPAR") { delete decisoes[id]; await gravar("decisoes", decisoes); desenharTriagem(); return; }
    if (decisoes[id]) { $("tst").textContent = "já decidido — limpe antes (trocar decisão fica registrado)"; return; }
    const nota = el.querySelector(".nota")?.value.trim() || ""; const cod = acao === "EXCLUDE" ? el.querySelector(".cod").value : "";
    decisoes[id] = { study_id: id, titulo: rec.title, decisao: acao, codigo: cod, nota, data: hoje(), lote: $("tlote").value.trim(), base: pagina?.base || "", url: pagina?.href || "" };
    await gravar("decisoes", decisoes); $("tst").textContent = `${acao}${cod ? " " + cod : ""} registrado`; desenharTriagem();
  });
}
$("tcod").onchange = () => $("tlist").querySelectorAll("select.cod").forEach(s => s.value = $("tcod").value);
$("tocultos").onchange = () => desenharTriagem();
$("tzot").onclick = async () => {
  const d = Object.values(await ler("decisoes", {})).filter(x => (x.decisao === "INCLUDE" || x.decisao === "MAYBE") && RE_DOI.test(x.study_id));
  if (!d.length) { $("tst").textContent = "nenhum INCLUDE/MAYBE com DOI para salvar"; return; }
  const etq = ($("zetq").value || "conferido-crossref").split(",").map(s => s.trim()).filter(Boolean); let n = 0, falha = 0, semdoi = 0;
  for (const x of d) {
    const r = await resolver(limpaDoi(x.study_id.match(RE_DOI)[0])); if (!r.ok) { semdoi++; continue; }
    const z = await zoteroSalvar(r.obra, $("zalvo").value, [...etq, "triagem-" + x.decisao.toLowerCase()]); z.ok ? n++ : falha++;
    $("tst").textContent = `salvando… ${n + falha + semdoi}/${d.length}`; await new Promise(r => setTimeout(r, 250));
  }
  $("tst").innerHTML = `<span class="${falha ? "no" : "ok"}">${n} salvo(s) no Zotero</span>${semdoi ? ` · ${semdoi} DOI não resolvido (não salvo)` : ""}${falha ? ` · ${falha} falha(s) — o Zotero está aberto?` : ""} — etiquetas: ${esc([...etq, "triagem-include/maybe"].join(", "))}`;
};
$("ttsv").onclick = async () => { const d = Object.values(await ler("decisoes", {})); if (d.length) baixar(`lote_${hoje()}.tsv`, "# study_id\tdecisao\tcodigo\tnota\n" + d.map(x => [x.study_id, x.decisao, x.codigo, x.nota].map(v => String(v ?? "").replace(/\t/g, " ")).join("\t")).join("\n"), "text/tab-separated-values;charset=utf-8"); };
$("tcsv").onclick = async () => { const d = Object.values(await ler("decisoes", {})); if (d.length) baixar(`decisoes_triagem_${hoje()}.csv`, csv(["study_id", "titulo", "decisao", "codigo", "nota", "data", "lote", "base", "url"], d.map(x => [x.study_id, x.titulo, x.decisao, x.codigo, x.nota, x.data, x.lote, x.base, x.url]))); };

// ================= Uso de IA =================
const chips = (id) => [...document.querySelectorAll(`#${id} input:checked`)].map(i => i.value);
$("idadoschips").addEventListener("change", () => { $("iaviso").hidden = !chips("idadoschips").some(v => /licenciada|PDF|dados da pesquisa|terceiros/.test(v)); });
async function desenharUsos() {
  const u = await ler("usos", []);
  $("ilist").innerHTML = u.length ? `<h2>${u.length} uso(s) registrado(s)</h2>` + u.slice(-5).reverse().map(x => `<div class="rec"><div class="t">${esc(x.ferramenta)} · ${esc(x.etapa)} <span class="m">${esc(x.data)} · declara: ${esc(x.declara)}</span></div><div class="m">${esc(x.finalidade)} → ${esc(x.decisao_humana)}</div><div class="m">enviado: ${esc(x.dados_enviados)} · conferido: ${esc(x.validacao)}</div></div>`).join("") : "";
}
async function prepararIA() {
  $("idata").value = hoje(); $("iquem").value = await ler("quem", "");
  if (pagina?.ia) { $("iahdr").innerHTML = `Ferramenta detectada nesta aba: <b>${esc(pagina.ia.ferramenta)}</b> (${esc(pagina.ia.fornecedor)}). Registre o uso que acabou de fazer.`; $("iferr").value = pagina.ia.ferramenta; }
  else $("iahdr").textContent = "Nenhuma ferramenta de IA detectada nesta aba — preencha a ferramenta à mão.";
  desenharUsos();
}
$("iex").onclick = () => {
  $("ietapa").value = "busca"; $("iferr").value = "ChatGPT (GPT «Consensus»)"; $("imod").value = "GPT-5"; $("ifin").value = "encontrar artigos-semente sobre fraude em postos de combustível";
  $("iprompt").value = "«Quais evidências científicas existem sobre o combate à fraude em postos de combustível? Quero artigos revisados por pares»";
  document.querySelector('#idadoschips input[value="nenhum dado pessoal"]').checked = true; document.querySelector('#ivalchips input[value="DOI conferido no Crossref"]').checked = true;
  $("idec").value = "escolhi Meneses & Rocha (2025) como primeira leitura; os outros 8 ficam para a busca na base"; $("idecl").value = "sim"; $("ist").textContent = "exemplo carregado — edite e registre, ou limpe os campos";
};
$("ireg").onclick = async () => {
  const dados = [...chips("idadoschips"), $("idados").value.trim()].filter(Boolean).join("; "); const val = [...chips("ivalchips"), $("ival").value.trim()].filter(Boolean).join("; ");
  const u = { data: $("idata").value, etapa: $("ietapa").value, ferramenta: $("iferr").value.trim(), modelo_versao: $("imod").value.trim(), finalidade: $("ifin").value.trim(), dados_enviados: dados, prompt_ou_consulta: $("iprompt").value.trim(), validacao: val, decisao_humana: $("idec").value.trim(), declara: $("idecl").value, quem: $("iquem").value.trim(), url: pagina?.url || "" };
  const falta = [["ferramenta", "a ferramenta"], ["finalidade", "a finalidade (o que pediu)"], ["dados_enviados", "o que saiu do seu computador (bloco 2)"], ["validacao", "como conferiu (bloco 3)"], ["decisao_humana", "a decisão humana"]].find(([k]) => !u[k]);
  if (falta) { $("ist").innerHTML = `<span class="no">falta ${falta[1]}</span>`; return; }
  await gravar("quem", u.quem); const n = await anexar("usos", u); $("ist").innerHTML = `<span class="ok">registrado (${n})</span>`;
  ["ifin", "idados", "iprompt", "ival", "idec"].forEach(id => $(id).value = ""); document.querySelectorAll("#idadoschips input, #ivalchips input").forEach(i => i.checked = false); $("iaviso").hidden = true; desenharUsos();
};
$("icsv").onclick = async () => { const d = await ler("usos", []); if (d.length) baixar("USO_DE_IA.csv", csv(["data", "etapa", "ferramenta", "modelo_versao", "finalidade", "dados_enviados", "prompt_ou_consulta", "validacao", "decisao_humana", "declara", "quem"], d.map(u => [u.data, u.etapa, u.ferramenta, u.modelo_versao, u.finalidade, u.dados_enviados, u.prompt_ou_consulta, u.validacao, u.decisao_humana, u.declara, u.quem]))); };

// ================= Extração com âncora =================
$("ecampo").onchange = () => { $("ecampo2").hidden = $("ecampo").value !== "outro"; };
function campoAtual() { return $("ecampo").value === "outro" ? $("ecampo2").value.trim() : $("ecampo").value; }
async function desenharExtracao() {
  await desenharNotas();
  if (pagina?.doi && !$("eid").value) $("eid").value = pagina.doi;
  const m = await ler("matriz", []);
  // visão por artigo: linhas = artigos, colunas preenchidas
  const porArtigo = {}; m.forEach(c => { (porArtigo[c.id] = porArtigo[c.id] || []).push(c); });
  $("elist").innerHTML = m.length ? `<h2>Matriz: ${Object.keys(porArtigo).length} artigo(s) · ${m.length} célula(s)</h2>` + Object.entries(porArtigo).slice(-6).reverse().map(([id, cs]) =>
    `<div class="rec"><div class="t">${esc(id)}</div>${cs.map(c => `<div class="m"><b>${esc(c.campo)}</b>: ${esc(c.valor || c.trecho.slice(0, 70))} <span class="muted">· ${esc(c.pagina)}</span></div>`).join("")}</div>`).join("") : "";
}
// lê a seleção atual da página (ao vivo, não a de quando o painel abriu)
async function selecaoAoVivo() {
  try { const d = await lerPagina(); if (d) { pagina = pagina || {}; Object.assign(pagina, { selection: d.selection, secao: d.secao, doi: d.doi || pagina.doi, title: d.title, href: d.href }); } return d; } catch { return null; }
}
$("esel").onclick = async () => {
  const d = await selecaoAoVivo();
  if (!d?.selection) { $("est_").innerHTML = '<span class="no">nada selecionado na página — selecione o trecho e clique de novo</span>'; return; }
  $("etrecho").value = d.selection; if (d.secao && !$("epag").value) $("epag").value = d.secao; if (d.doi) $("eid").value = d.doi; $("est_").textContent = "seleção carregada";
};
// ---- notas soltas: criadas pelo botão direito (background) ou pelo botão «+ nota» ----
const OPCOES_COLUNA = () => [...$("ecampo").options].filter(o => o.value !== "outro").map(o => `<option value="${o.value}">${o.textContent}</option>`).join("") + '<option value="">(coluna…)</option>';
async function desenharNotas() {
  const notas = await ler("notas", []); chrome.action?.setBadgeText?.({ text: notas.length ? String(notas.length) : "" });
  $("egravartodas").hidden = !notas.length;
  $("enotas").innerHTML = notas.map(n => `<div class="rec nota" data-n="${n.n}"><div class="m">«${esc(n.trecho.slice(0, 220))}${n.trecho.length > 220 ? "…" : ""}»</div>
    <div class="m">${esc(n.id || n.url || "")} · ${esc(n.data)} <button class="x" data-a="apagar" title="apagar nota">✕</button></div>
    <div class="row"><select class="ncol">${OPCOES_COLUNA()}</select><input class="npag" placeholder="página/seção" value="${esc(n.secao || "")}"><input class="nval" placeholder="valor (opcional)"></div>
    <button class="b s" data-a="gravar">Gravar esta</button></div>`).join("");
  $("enotas").querySelectorAll("select.ncol").forEach(s => s.value = "");
  $("enotas").querySelectorAll("button[data-a]").forEach(btn => btn.onclick = () => acaoNota(btn.closest(".nota"), btn.dataset.a));
}
async function acaoNota(el, acao) {
  const notas = await ler("notas", []); const i = notas.findIndex(n => String(n.n) === el.dataset.n); if (i < 0) return;
  if (acao === "apagar") { notas.splice(i, 1); await gravar("notas", notas); desenharNotas(); return; }
  const col = el.querySelector(".ncol").value, pag = el.querySelector(".npag").value.trim(), val = el.querySelector(".nval").value.trim();
  if (!col || !pag) { el.querySelector(".npag").style.borderColor = pag ? "" : "#B3261E"; el.querySelector(".ncol").style.borderColor = col ? "" : "#B3261E"; $("est_").innerHTML = '<span class="no">a nota precisa de coluna e página para virar célula</span>'; return false; }
  const n = notas[i]; await anexar("matriz", { data: hoje(), id: n.id || n.url, titulo: n.titulo || "", campo: col, valor: val, pagina: pag, trecho: n.trecho, url: n.url });
  notas.splice(i, 1); await gravar("notas", notas); return true;
}
$("enota").onclick = async () => {
  const d = await selecaoAoVivo(); const sel = d?.selection || "";
  if (!sel) { $("est_").innerHTML = '<span class="no">nada selecionado na página — selecione o trecho e clique de novo</span>'; return; }
  await anexar("notas", { n: Date.now(), trecho: sel, id: d.doi || pagina?.doi || "", titulo: d.title || "", secao: d.secao || "", url: d.href || "", data: hoje() });
  $("est_").innerHTML = '<span class="ok">nota criada — continue lendo e marcando</span>'; desenharNotas();
};
$("egravartodas").onclick = async () => {
  let ok = 0, pend = 0;
  for (const el of [...$("enotas").querySelectorAll(".nota")]) { const r = await acaoNota(el, "gravar"); r ? ok++ : pend++; }
  $("est_").innerHTML = `<span class="ok">${ok} célula(s) gravada(s)</span>${pend ? ` · ${pend} nota(s) ficaram: faltou coluna ou página` : ""}`; desenharNotas(); desenharExtracao();
};
chrome.storage?.onChanged?.addListener((ch) => { if (ch.notas) desenharNotas(); });
$("ereg").onclick = async () => {
  const c = { data: hoje(), id: $("eid").value.trim() || pagina?.doi || pagina?.url || "", titulo: pagina?.title || "", campo: campoAtual(), valor: $("evalor").value.trim(), pagina: $("epag").value.trim(), trecho: $("etrecho").value.trim(), url: pagina?.href || "" };
  const falta = !c.id ? "o artigo (linha da matriz)" : !c.campo ? "a coluna" : !c.trecho ? "o trecho literal" : !c.pagina ? "a página ou seção — sem âncora a célula não é conferível" : "";
  if (falta) { $("est_").innerHTML = `<span class="no">falta ${falta}</span>`; return; }
  const n = await anexar("matriz", c); $("est_").innerHTML = `<span class="ok">célula gravada (${n})</span>`; ["evalor", "epag", "etrecho", "ecampo2"].forEach(id => $(id).value = ""); $("ecampo2").hidden = true; desenharExtracao();
};
$("ecsv").onclick = async () => { const m = await ler("matriz", []); if (m.length) baixar("extracao.csv", csv(["id", "titulo", "campo", "valor", "pagina", "trecho_literal", "url", "data"], m.map(c => [c.id, c.titulo, c.campo, c.valor, c.pagina, c.trecho, c.url, c.data]))); };

// ================= Estilo =================
$("esrun").onclick = () => {
  const t = $("estx").value; if (!t.trim()) return;
  const r = marcas(t); const total = r.reduce((s, x) => s + x.n, 0);
  $("esout").innerHTML = `<p class="muted">${t.split(/\s+/).length} palavras · ${total} ocorrência(s)</p><table><tr><th>Marca</th><th>N</th><th>Exemplo · o que fazer</th></tr>` +
    r.map(x => `<tr><td>${esc(x.nome)}</td><td class="${x.n ? "no" : "ok"}"><b>${x.n}</b></td><td>${x.exemplos.map(e => `<div>«${esc(e)}»</div>`).join("")}<span class="muted">${esc(x.faz)}</span></td></tr>`).join("") + "</table>";
};

// ================= Projeto =================
document.querySelectorAll("code.cp").forEach(c => c.onclick = async () => { await navigator.clipboard.writeText(c.textContent); const t = c.textContent; c.textContent = "copiado ✔"; setTimeout(() => c.textContent = t, 900); });
// Lê o PROGRESSO.md do plugin: tabela de fases (| n | Nome | … | [ ] |) e checklists (| M1 | Área | Item | Slides | [x] |); aceita também listas «- [ ]».
function lerProgresso(t) {
  const secoes = []; let atual = null;
  for (const linha of t.split("\n")) {
    const hh = linha.match(/^#{2,3}\s+(.+)$/); if (hh) { atual = { nome: hh[1].replace(/\s+—.*$/, ""), itens: [] }; secoes.push(atual); continue; }
    if (!atual) continue;
    const li = linha.match(/^\s*[-*]\s*\[([ xX])\]\s*(.+)$/); if (li) { atual.itens.push({ feito: li[1] !== " ", nome: li[2].trim(), id: "" }); continue; }
    if (/^\|/.test(linha) && /\[[ xX]\]/.test(linha)) {
      const c = linha.split("|").slice(1, -1).map(s => s.trim()); const est = c.findIndex(x => /^\[[ xX]\]/.test(x)); if (est < 0) continue;
      const fase = /^\d+$/.test(c[0]); atual.itens.push({ feito: !/^\[ \]/.test(c[est]), nome: fase ? c[1] : (c[2] || c[1]), id: c[0], porta: fase ? c[2] : "", quem: fase ? c[3] : "", data: c[est + 1] || "", evid: c[est + 2] || "" });
    }
  }
  return secoes.filter(s => s.itens.length);
}
$("parq").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; const t = await f.text(); const secoes = lerProgresso(t);
  if (!secoes.length) { $("pout").innerHTML = '<div class="warn">Não encontrei fases nem checklists neste arquivo. É o PROGRESSO.md gerado pelo plugin?</div>'; return; }
  const cab = t.match(/^\*\*Método provável:\*\*.*$/m)?.[0]?.replace(/\*\*/g, "") || ""; const esquema = t.match(/<!-- esquema: (\d+)/)?.[1];
  const fases = secoes.find(s => /^Fases/i.test(s.nome)); const faseAtual = fases?.itens.find(i => !i.feito);
  const [mNome, mUrl] = manualDaFase(faseAtual?.nome);
  let html = cab ? `<p class="muted">${esc(cab)}${esquema ? " · esquema " + esquema : ""}</p>` : "";
  html += faseAtual ? `<div class="warn">Fase atual: <b>${esc(faseAtual.id)} · ${esc(faseAtual.nome)}</b> (${esc(faseAtual.quem)})<br>Porta de saída: ${esc(faseAtual.porta)}<br>Manual desta fase: <a href="${mUrl}" target="_blank">${esc(mNome)}</a></div>` : '<div class="ok">Todas as fases marcadas.</div>';
  if (fases) html += `<table class="fases">${fases.itens.map(i => `<tr><td>${i.feito ? '<span class="ok">✔</span>' : "☐"} ${esc(i.id)}</td><td>${esc(i.nome)}</td><td class="muted">${esc(i.data)} ${esc(i.evid)}</td></tr>`).join("")}</table>`;
  html += `<table><tr><th>Checklist</th><th>Feito</th><th>Próximo item</th></tr>${secoes.filter(s => s !== fases).map(s => { const p = s.itens.find(i => !i.feito); return `<tr><td>${esc(s.nome)}</td><td>${s.itens.filter(i => i.feito).length}/${s.itens.length}</td><td class="muted">${p ? esc(p.id + " " + p.nome).slice(0, 90) : "—"}</td></tr>`; }).join("")}</table>`;
  $("pout").innerHTML = html;
};
// Cria a pasta inicial do projeto com a mesma estrutura do iniciar_projeto.py do plugin (modo aba).
const PASTAS = ["00_projeto", "00_protocolo", "01_revisao/fichas", "01_buscas", "02_instrumentos", "02_triagem", "03_etica", "03_extracao", "04_sintese", "05_analise", "06_texto", "07_banca", "tools", "dados_FORA_DO_GIT"];
const FASES = [["0", "Diagnóstico", "Tema, prazo, programa, orientador e ferramentas registrados; pasta criada", "Pesquisador"], ["1", "Pergunta", "Tema delimitado → problema → pergunta com tabela vazia do resultado → objetivos", "Metodólogo"], ["2", "Método", "Classificação, desenho, amostra, instrumento, análise; o que a IA pode fazer aqui", "Metodólogo · Orientador"], ["3", "Projeto e ética", "Projeto NBR 15287:2025; parecer do CEP quando houver pessoas", "Metodólogo"], ["4", "Busca e biblioteca", "Bases, strings verbatim, coleção por base e data; auditoria da biblioteca", "Metodólogo · Bibliotecário"], ["5", "Triagem", "Deduplicação, triagem assistida com status preliminar, decisão do aluno, números do PRISMA", "Orientador · Bibliotecário"], ["6", "Leitura e síntese", "PDFs do Zotero → notebook; fichamento; matriz de síntese conferida célula a célula", "Leitura (Gemini Notebook)"], ["7", "Análise", "Coleta e análise conforme o método; IA só onde autorizada e registrada", "Metodólogo · Orientador"], ["8", "Escrita ABNT", "NBR 14724, 10520, 6023 via Zotero; verificação automática de citações e referências", "Bibliotecário · scripts"], ["9", "Pré-banca", "Cinco objeções mais fortes, perguntas prováveis, respostas com página", "Metodólogo · Leitura"], ["10", "Entrega", "Declaração de uso de IA, backup, versão congelada da biblioteca, checklist final", "Orientador · Bibliotecário"]];
async function escrever(dir, caminho, conteudo) {
  const partes = caminho.split("/"); let d = dir; for (const p of partes.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
  const nome = partes.at(-1); try { await d.getFileHandle(nome); return false; } catch {} // nunca sobrescreve
  const fh = await d.getFileHandle(nome, { create: true }); const w = await fh.createWritable(); await w.write(conteudo); await w.close(); return true;
}
$("ccriar").onclick = async () => {
  if (!soNaAba("ccriar", "cst")) return;
  if (!window.showDirectoryPicker) { $("cst").textContent = "este navegador não tem a File System Access API"; return; }
  const tema = $("ctema").value.trim() || "(tema a definir)", metodo = $("cmetodo").value.trim() || "(a definir)", prog = $("cprog").value.trim() || "(a definir)", prazo = $("cprazo").value.trim() || "(a definir)";
  let h; try { h = await window.showDirectoryPicker({ mode: "readwrite" }); } catch { $("cst").textContent = "cancelado"; return; }
  for (const p of PASTAS) { let d = h; for (const s of p.split("/")) d = await d.getDirectoryHandle(s, { create: true }); }
  const prog_md = [`# Progresso — ${tema}`, "<!-- esquema: 1 · gerado pela extensão Pesquisa MirandasTech; o plugin completa os checklists -->", "", `**Método provável:** ${metodo} · **Programa:** ${prog} · **Prazo:** ${prazo} · **Início:** ${hoje()}`,
    "Manuais: https://metodologia.mirandastech.com.br/ · https://manual.mirandastech.com.br/ · https://zotero.mirandastech.com.br/ · https://notebook.mirandastech.com.br/", "",
    "Regra: um item só é marcado `[x]` pelo agente responsável depois de conferir a evidência (arquivo, script, número). Anote data e evidência ao lado. O aluno decide; o agente formula e registra em DECISOES.md.", "",
    "## Fases (Pesquisador)", "", "| Fase | Nome | Porta de saída | Quem conduz | Estado | Data | Evidência |", "|---|---|---|---|---|---|---|", ...FASES.map(([n, nome, porta, quem]) => `| ${n} | ${nome} | ${porta} | ${quem} | [ ] | | |`), "",
    "## Método (Metodólogo) — slides em metodologia.mirandastech.com.br", "", "(o plugin preenche este checklist ao rodar /pesquisa:iniciar na pasta)", "",
    "## Uso de IA (Orientador) — slides em manual.mirandastech.com.br", "", "(idem)", ""].join("\n");
  const arquivos = { "PROGRESSO.md": prog_md,
    "00_projeto/DECISOES_METODO.md": `# Decisões de método — ${tema}\n\nRegistro da entrevista de decisão com o Metodólogo (uma seção por pergunta, com data).\n\n## Tema delimitado\n\n## Problema e lacuna\n\n## Pergunta e tabela vazia do resultado\n\n## Objetivos\n\n## Classificação (4 eixos)\n\n## Desenho — «escolhi … porque …; descartei … porque …»\n\n## População, amostra, n\n\n## Técnicas e instrumentos\n\n## Análise\n\n## Ética\n`,
    "00_protocolo/protocolo.md": `# Protocolo — ${tema}\n\n**Método:** ${metodo}\n**Congelado em:** (preencher — depois disso, só por emenda)\n\n1. Pergunta e subperguntas\n2. Bases e justificativa\n3. Blocos conceituais e strings (verbatim)\n4. Janela, idiomas, tipos documentais\n5. Critérios de inclusão e códigos de exclusão\n6. Procedimento de triagem\n7. Conjunto-semente\n8. Campos de extração e codebook\n9. Avaliação de qualidade\n10. Plano de síntese\n11. Gates humanos\n12. Procedimento de emenda\n\n## Emendas\n(nenhuma)\n`,
    "02_triagem/CODEBOOK.md": `# Codebook de triagem\n\nVersão: 1.0 · Data: (congelar antes da primeira triagem) · Revisores: A, B\n\n## Regra de inclusão\n\n(os dois requisitos que título e resumo precisam sustentar)\n\n## Códigos de exclusão\n\n| Código | Motivo |\n|---|---|\n` + (await codigos()).map(([c, d]) => `| ${c} | ${d} |`).join("\n") + "\n",
    "01_buscas/buscas.csv": "data,base,string_verbatim,filtros,total_retornado,arquivo_exportado,sha256\n",
    "00_projeto/USO_DE_IA.csv": "data,etapa,ferramenta,modelo_versao,finalidade,dados_enviados,prompt_ou_consulta,validacao,decisao_humana,declara,quem\n",
    "02_triagem/lote.tsv": "# study_id\tdecisao\tcodigo\tnota\n",
    ".gitignore": "dados_FORA_DO_GIT/\n*.xlsx\n*.xls\n*.pdf\nexports/\n.env\n" };
  let novos = 0; for (const [c, t] of Object.entries(arquivos)) if (await escrever(h, c, t)) novos++;
  await idbSet("pasta", h);
  $("cst").innerHTML = `<span class="ok">projeto criado em «${esc(h.name)}»: ${PASTAS.length} pastas, ${novos} arquivo(s) novo(s) (os já existentes foram mantidos).</span> Agora abra a pasta no Claude Code e diga «Pesquisador, onde paramos?».`;
  $("pastast").textContent = "pasta: " + h.name;
};
async function estatisticas() {
  const [b, d, u, m] = await Promise.all([ler("buscas", []), ler("decisoes", {}), ler("usos", []), ler("matriz", [])]);
  const pr = prisma(b, d);
  $("prisma").innerHTML = `Identificados: <b>${pr.identificados}</b> em ${pr.bases} base(s) · Triados: <b>${pr.triados}</b> · Incluídos: <b class="ok">${pr.incluidos}</b> · MAYBE: ${pr.maybe} · Excluídos: <b class="no">${pr.excluidos}</b>${Object.keys(pr.porCodigo).length ? " (" + Object.entries(pr.porCodigo).map(([c, n]) => c + ": " + n).join(", ") + ")" : ""}<br><span class="muted">«Identificados» soma os totais do diário; duplicatas entre bases ainda não são descontadas aqui.</span>`;
  $("pstat").textContent = `${b.length} buscas · ${Object.keys(d).length} decisões de triagem · ${u.length} usos de IA · ${m.length} células extraídas — tudo em chrome.storage.local, só neste navegador.`;
}
$("pbackup").onclick = async () => baixar(`pesquisa_mirandastech_backup_${hoje()}.json`, JSON.stringify(await chrome.storage.local.get(null), null, 2), "application/json");
$("plimpar").onclick = async () => { if (confirm("Apagar buscas, decisões, usos de IA e células desta extensão? Exporte antes.")) { await chrome.storage.local.clear(); estatisticas(); } };
$("popts").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };

async function lerEPreencher() {
  try { pagina = await lerPagina(); } catch (e) { pagina = null; }
  obra = null; ref = ""; $("refbox").textContent = ""; $("periodico").textContent = ""; $("oainfo").textContent = "resolva um DOI para ver citações";
  if (!pagina) {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); const web = !t?.url || /^https?:/.test(t.url);
    $("doi").innerHTML = web ? '<span class="muted">a extensão ainda não tem acesso a esta aba. Clique no ícone <b>M</b> da barra, ou </span><button class="b s" id="permitir">permitir ler as páginas automaticamente</button><div class="muted">Com a permissão, o painel lê cada página que você abre (só quando está aberto). Nada é enviado a lugar nenhum. Pode retirar nas opções.</div>'
      : '<span class="muted">esta aba não é uma página web (chrome://, PDF ou loja). Abra um artigo ou uma base, ou cole um DOI acima.</span>';
    $("permitir")?.addEventListener("click", async () => { const ok = await chrome.permissions.request({ origins: ["http://*/*", "https://*/*"] }); if (ok) lerEPreencher(); });
  }
  else {
    $("dbase").value = pagina.base; $("dquery").value = pagina.query; $("dcount").value = pagina.count; $("dfiltros").value = pagina.filtros;
    if (pagina.doi) resolverDoi(pagina.doi); else $("doi").innerHTML = '<span class="no">nenhum DOI encontrado na página</span>';
  }
  desenharTriagem(); prepararIA(); desenharExtracao();
}
async function lerComPermissao() {
  $("doi").innerHTML = '<span class="muted">lendo a página…</span>';
  await lerEPreencher(); if (pagina) return;
  // o clique no botão é um gesto do usuário: dá para pedir a permissão opcional aqui mesmo, sem passar pelas opções
  const ORIG = { origins: ["http://*/*", "https://*/*"] };
  if (!(await chrome.permissions.contains(ORIG))) {
    $("doi").innerHTML = '<span class="muted">o Chrome vai perguntar se a extensão pode ler as páginas — confirme para continuar.</span>';
    const ok = await chrome.permissions.request(ORIG).catch(() => false);
    if (ok) { await lerEPreencher(); return; }
    $("doi").innerHTML = '<span class="no">sem permissão.</span> <span class="muted">Alternativa: clique no ícone <b>M</b> da barra com esta aba aberta e depois no botão de novo.</span>';
  }
}
$("reler").onclick = lerComPermissao; $("lerartigo").onclick = lerComPermissao;
if (PAINEL && chrome.tabs?.onActivated) { chrome.tabs.onActivated.addListener(() => lerEPreencher()); chrome.tabs.onUpdated.addListener((id, info, tab) => { if (info.status === "complete" && tab.active) lerEPreencher(); }); }
// ================= início =================
(async () => {
  const foco = new URLSearchParams(location.search).get("foco");
  const aba = foco ? "prj" : await ler("aba", "prj"); (document.querySelector(`nav button[data-t="${aba}"]`) || document.querySelector("nav button")).click();
  if (foco && $(foco)) { const bl = $(foco).closest("details.bloco"); if (bl) bl.open = true; setTimeout(() => { $(foco).scrollIntoView({ block: "center" }); $(foco).classList.add("pisca"); $(foco).focus(); }, 300); }
  await lerEPreencher();
  $("zetq").value = await ler("etiqueta", "conferido-crossref");
  const abertos = await ler("blocos", []); document.querySelectorAll("#prj details.bloco").forEach(d => { d.open = abertos.includes(d.id); d.addEventListener("toggle", async () => { const a = [...document.querySelectorAll("#prj details.bloco")].filter(x => x.open).map(x => x.id); await gravar("blocos", a); }); });
  carregarZotero(); desenharDiario(); estatisticas();
})();

$("prismacsv").onclick = async () => { const pr = prisma(await ler("buscas", []), await ler("decisoes", {})); baixar("prisma_flow.csv", csv(["etapa", "n"], [["identificados_bases", pr.identificados], ["bases", pr.bases], ["triados_titulo_resumo", pr.triados], ["excluidos", pr.excluidos], ...Object.entries(pr.porCodigo).map(([c, n]) => ["excluidos_" + c, n]), ["maybe", pr.maybe], ["incluidos_para_texto_completo", pr.incluidos]])); };

// ---- importar de volta ----
$("pimp").onchange = async (e) => {
  let msg = [];
  for (const f of e.target.files) {
    const t = await f.text();
    if (/\.tsv$/i.test(f.name) || t.startsWith("# study_id")) {
      const d = await ler("decisoes", {}); let n = 0;
      t.split("\n").filter(l => l.trim() && !l.startsWith("#")).forEach(l => { const [id, dec, cod, nota] = l.split("\t"); if (id && dec && !d[id]) { d[id] = { study_id: id, titulo: "", decisao: dec, codigo: cod || "", nota: nota || "", data: hoje(), lote: f.name, base: "", url: "" }; n++; } });
      await gravar("decisoes", d); msg.push(`${f.name}: ${n} decisão(ões)`); continue;
    }
    const rows = lerCsv(t); if (!rows.length) { msg.push(`${f.name}: vazio`); continue; }
    const cab = Object.keys(rows[0]);
    if (cab.includes("string_verbatim")) { const b = await ler("buscas", []); rows.forEach(r => b.push(r)); await gravar("buscas", b); msg.push(`${f.name}: ${rows.length} busca(s)`); }
    else if (cab.includes("prompt_ou_consulta")) { const u = await ler("usos", []); rows.forEach(r => u.push(r)); await gravar("usos", u); msg.push(`${f.name}: ${rows.length} uso(s)`); }
    else if (cab.includes("study_id")) { const d = await ler("decisoes", {}); let n = 0; rows.forEach(r => { if (r.study_id && !d[r.study_id]) { d[r.study_id] = r; n++; } }); await gravar("decisoes", d); msg.push(`${f.name}: ${n} decisão(ões)`); }
    else if (cab.includes("trecho_literal")) { const m = await ler("matriz", []); rows.forEach(r => m.push({ id: r.id, titulo: r.titulo, campo: r.campo, valor: r.valor, pagina: r.pagina, trecho: r.trecho_literal, url: r.url, data: r.data })); await gravar("matriz", m); msg.push(`${f.name}: ${rows.length} célula(s)`); }
    else msg.push(`${f.name}: formato não reconhecido (${cab.slice(0, 4).join(", ")}…)`);
  }
  $("pimpst").textContent = msg.join(" · "); estatisticas();
};

// ---- pasta do projeto (File System Access API; o handle fica no IndexedDB) ----
$("pasta").onclick = async () => {
  if (!soNaAba("pasta", "pastast")) return;
  if (!window.showDirectoryPicker) { $("pastast").textContent = "este navegador não tem a File System Access API"; return; }
  try { const h = await window.showDirectoryPicker({ mode: "readwrite" }); await idbSet("pasta", h); $("pastast").textContent = "pasta: " + h.name; } catch (e) { $("pastast").textContent = "cancelado"; }
};
$("pastagravar").onclick = async () => {
  const h = await idbGet("pasta"); if (!h) { $("pastast").textContent = "escolha a pasta primeiro"; return; }
  if ((await h.requestPermission({ mode: "readwrite" })) !== "granted") { $("pastast").textContent = "sem permissão de escrita"; return; }
  const [b, d, u, m] = await Promise.all([ler("buscas", []), ler("decisoes", {}), ler("usos", []), ler("matriz", [])]);
  const arquivos = {
    "buscas.csv": csv(["data", "base", "string_verbatim", "filtros", "total_retornado", "arquivo_exportado", "sha256"], b.map(x => [x.data, x.base, x.string_verbatim, x.filtros, x.total_retornado, x.arquivo_exportado, x.sha256])),
    "USO_DE_IA.csv": csv(["data", "etapa", "ferramenta", "modelo_versao", "finalidade", "dados_enviados", "prompt_ou_consulta", "validacao", "decisao_humana", "declara", "quem"], u.map(x => [x.data, x.etapa, x.ferramenta, x.modelo_versao, x.finalidade, x.dados_enviados, x.prompt_ou_consulta, x.validacao, x.decisao_humana, x.declara, x.quem])),
    "lote.tsv": "# study_id\tdecisao\tcodigo\tnota\n" + Object.values(d).map(x => [x.study_id, x.decisao, x.codigo, x.nota].map(v => String(v ?? "").replace(/\t/g, " ")).join("\t")).join("\n"),
    "extracao.csv": csv(["id", "titulo", "campo", "valor", "pagina", "trecho_literal", "url", "data"], m.map(c => [c.id, c.titulo, c.campo, c.valor, c.pagina, c.trecho, c.url, c.data]))
  };
  const destino = { "buscas.csv": "01_buscas", "USO_DE_IA.csv": "00_projeto", "lote.tsv": "02_triagem", "extracao.csv": "03_extracao" };
  let n = 0;
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    let d = h; try { d = await h.getDirectoryHandle(destino[nome]); } catch {} // se a subpasta do plugin existe, grava nela; senão, na raiz
    const fh = await d.getFileHandle(nome, { create: true }); const w = await fh.createWritable(); await w.write(conteudo); await w.close(); n++; }
  $("pastast").textContent = `${n} arquivo(s) gravado(s) em ${h.name} · ${hoje()}`;
};
(async () => { const h = await idbGet("pasta"); if (h) $("pastast").textContent = "pasta: " + h.name; })();

$("ver2").textContent = "v" + chrome.runtime.getManifest().version;
$("copiarcit").onclick = async () => { await navigator.clipboard.writeText($("citar").textContent.replace("DATA", new Date().toLocaleDateString("pt-BR"))); $("copiarcit").textContent = "Copiado ✔"; };
$("verpriv").onclick = (e) => { e.preventDefault(); chrome.tabs.create({ url: "https://plugin.mirandastech.com.br/" }); };

// ---- lixeiras por aba: apagam só a chave daquela aba, com confirmação ----
document.querySelectorAll("button.lixo").forEach(b => b.onclick = async () => {
  const chaves = b.dataset.chave.split(","); const n = (await Promise.all(chaves.map(k => ler(k, null)))).map(v => Array.isArray(v) ? v.length : v ? Object.keys(v).length : 0).reduce((a, c) => a + c, 0);
  if (!n) { alert("Não há nada para apagar aqui."); return; }
  if (!confirm(`Apagar ${b.dataset.nome} (${n} registro(s))? Exporte antes se precisar. Não tem volta.`)) return;
  for (const k of chaves) await chrome.storage.local.remove(k);
  chrome.action?.setBadgeText?.({ text: "" });
  desenharDiario(); desenharTriagem(); desenharUsos(); desenharNotas(); desenharExtracao(); estatisticas();
});
$("plimpar").onclick = async () => { if (confirm("Apagar TUDO desta extensão: buscas, decisões, usos de IA, notas, matriz, ocultos e preferências? Exporte antes. Não tem volta.")) { await chrome.storage.local.clear(); chrome.action?.setBadgeText?.({ text: "" }); location.reload(); } };
