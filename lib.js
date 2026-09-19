// Funções compartilhadas pelo popup e pela página de opções. Sem dependências.
export const $ = (id) => document.getElementById(id);
export const hoje = () => new Date().toISOString().slice(0, 10);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const RE_DOI = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
export const limpaDoi = (d) => (d || "").replace(/^.*doi\.org\//, "").replace(/[).,;]+$/, "");

// ---- armazenamento local (chrome.storage.local) ----
export async function ler(chave, padrao) { const r = await chrome.storage.local.get(chave); return r[chave] ?? padrao; }
export async function gravar(chave, valor) { await chrome.storage.local.set({ [chave]: valor }); }
export async function anexar(chave, item) { const l = await ler(chave, []); l.push(item); await gravar(chave, l); return l.length; }

// ---- CSV com ponto e vírgula e BOM (abre direto no Excel/LibreOffice em pt-BR) ----
export function csv(cabecalho, linhas) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cabecalho.join(";"), ...linhas.map(l => l.map(q).join(";"))].join("\n");
}
export function baixar(nome, texto, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---- Crossref ----
const UA = { "User-Agent": "PesquisaMirandasTech/0.3 (https://plugin.mirandastech.com.br; mailto:contato@mirandastech.com.br)" };
export async function resolver(doi) {
  const r = await fetch("https://api.crossref.org/works/" + encodeURIComponent(doi), { headers: UA });
  if (r.status === 404) return { ok: false, status: 404 };
  if (!r.ok) return { ok: false, status: r.status };
  return { ok: true, obra: (await r.json()).message };
}
// Busca bibliográfica por texto (para referência sem DOI): devolve o melhor candidato e a pontuação do Crossref.
export async function buscarPorTexto(texto) {
  const r = await fetch("https://api.crossref.org/works?rows=3&query.bibliographic=" + encodeURIComponent(texto.slice(0, 300)), { headers: UA });
  if (!r.ok) return [];
  return ((await r.json()).message.items || []).map(w => ({ obra: w, score: w.score }));
}

// ABNT NBR 6023: SOBRENOME, N. Título. Periódico, v., n., p., ano. DOI.
export function abnt(w) {
  const autores = (w.author || []).map(a => a.family ? `${a.family.toUpperCase()}, ${(a.given || "").split(/\s+/).filter(p => p && !/^(da|de|do|das|dos|di|del|della|van|von|der|den|le|la|e|y)$/i.test(p)).map(p => p[0].toUpperCase() + ".").join(" ")}` : (a.name || "").toUpperCase());
  const aut = autores.length > 3 ? autores.slice(0, 3).join("; ") + " et al." : autores.join("; ");
  const ano = w.issued?.["date-parts"]?.[0]?.[0] || "s.d.";
  const per = (w["container-title"] || [])[0] || "";
  const tipo = w.type || "";
  const partes = [aut ? (aut.endsWith(".") ? aut : aut + ".") : "", `${(w.title || [""])[0]}.`,
    tipo === "book" && w.publisher ? `${w["publisher-location"] ? w["publisher-location"] + ": " : ""}${w.publisher},` : (per ? `${per},` : ""),
    w.volume ? `v. ${w.volume},` : "", w.issue ? `n. ${w.issue},` : "", w.page ? `p. ${w.page},` : "", `${ano}.`, w.DOI ? `DOI: https://doi.org/${w.DOI}.` : ""];
  return partes.filter(Boolean).join(" ");
}
export function resumoObra(w) {
  return { titulo: (w.title || [""])[0], autores: (w.author || []).map(a => a.family ? `${a.family}, ${a.given || ""}` : a.name).join("; "),
    periodico: (w["container-title"] || [""])[0], ano: w.issued?.["date-parts"]?.[0]?.[0] || "", tipo: w.type || "", doi: w.DOI || "" };
}

// ---- Zotero (servidor do conector, Zotero aberto em 127.0.0.1:23119) ----
const ZH = { "Content-Type": "application/json", "X-Zotero-Connector-API-Version": "3", "Zotero-Allowed-Request": "1" };
export async function zoteroAlvos() {
  try {
    const r = await fetch("http://127.0.0.1:23119/connector/getSelectedCollection", { method: "POST", headers: ZH, body: "{}" });
    if (!r.ok) return { ok: false, status: r.status };
    const j = await r.json();
    return { ok: true, atual: j.name || j.libraryName || "", alvos: j.targets || [], id: j.id || (j.collectionID ? "C" + j.collectionID : "L" + (j.libraryID || 1)) };
  } catch { return { ok: false, status: 0 }; }
}
export async function zoteroSalvar(obra, alvo, etiquetas) {
  const item = {
    itemType: obra.type === "book" ? "book" : obra.type === "book-chapter" ? "bookSection" : obra.type === "proceedings-article" ? "conferencePaper" : "journalArticle",
    title: (obra.title || [""])[0],
    creators: (obra.author || []).map(a => a.family ? { firstName: a.given || "", lastName: a.family, creatorType: "author" } : { name: a.name || "", creatorType: "author" }),
    publicationTitle: (obra["container-title"] || [""])[0], volume: obra.volume || "", issue: obra.issue || "", pages: obra.page || "",
    date: String(obra.issued?.["date-parts"]?.[0]?.[0] || ""), DOI: obra.DOI || "", url: obra.DOI ? "https://doi.org/" + obra.DOI : (obra.URL || ""),
    tags: (etiquetas || []).map(t => ({ tag: t })), extra: "Conferido no Crossref em " + hoje()
  };
  const sessionID = crypto.randomUUID(); let r;
  try { r = await fetch("http://127.0.0.1:23119/connector/saveItems", { method: "POST", headers: ZH, body: JSON.stringify({ items: [item], uri: item.url, sessionID }) }); }
  catch { return { ok: false, status: 0 }; } // Zotero fechado
  if (!r.ok) return { ok: false, status: r.status };
  if (alvo) { // move para a coleção escolhida e aplica etiquetas (Zotero 5.0.75+)
    try { await fetch("http://127.0.0.1:23119/connector/updateSession", { method: "POST", headers: ZH, body: JSON.stringify({ sessionID, target: alvo, tags: (etiquetas || []).join(",") }) }); } catch {}
  }
  return { ok: true };
}

// ---- marcas de texto gerado (regras, não IA; sinais, não prova) ----
export const MARCAS = [
  { nome: "Antítese «não é X, é Y»", re: /\bnão (?:é|se trata de|está em)(?=\s)[^.;:]{3,90}?[,;]\s*(?:é|mas sim|e sim|mas)(?=\s)/gi, faz: "Diga só o Y. Uma ou duas por artigo é ênfase; dez é tique." },
  { nome: "Tricolon", re: /\b\w{4,}, \w{4,} e \w{4,}\b/g, faz: "Se são três de verdade, mantenha; se o terceiro entrou pelo ritmo, corte." },
  { nome: "Abertura por negação do óbvio", re: /(^|\n)\s*Não (?:se trata|é) (?:apenas|somente|só)\b/g, faz: "Corte a frase; a próxima costuma ser a boa." },
  { nome: "Marcadores de importância", re: /\b(?:vale (?:destacar|ressaltar|notar|lembrar)|é (?:crucial|importante|fundamental|essencial) (?:notar|destacar|ressaltar|observar)|cabe (?:destacar|ressaltar))\b/gi, faz: "Se é importante, o conteúdo mostra. Retire o aviso." },
  { nome: "Superlativo sem medida", re: /\b(?:o|a|os|as) mais \w+ (?:já|de todos|de todas|encontrad[oa]s?|existentes?)\b/gi, faz: "Mais segundo qual medida? Cite-a ou retire." },
  { nome: "Travessão em cascata", re: /—[^—\n]{1,80}—[^—\n]{1,80}—/g, faz: "Um por frase, e nem sempre." },
  { nome: "Fecho grandiloquente", re: /\b(?:lacuna que ninguém|abre caminho para|transforma(?:r)? (?:radicalmente|profundamente)|revolucion\w+|um novo paradigma|passo decisivo)\b/gi, faz: "Termine com o dado." },
  { nome: "Parágrafo de uma frase", re: /(^|\n\n)[^\n.!?]{20,200}[.!?](?=\n\n|$)/g, faz: "Uma vez por artigo, no máximo." }
];
export function marcas(texto) {
  return MARCAS.map(m => { const hits = [...texto.matchAll(m.re)].map(x => x[0].replace(/\s+/g, " ").trim().slice(0, 90)); return { nome: m.nome, n: hits.length, exemplos: hits.slice(0, 3), faz: m.faz }; });
}

// ---- códigos de exclusão (padrão do modelo CODEBOOK.md do plugin; editável nas opções) ----
export const CODIGOS_PADRAO = [["E1", "Fora do escopo (sistema/contexto)"], ["E2", "Só simulação, sem dados de campo"], ["E3", "Sem desfecho de interesse"], ["E4", "Tipo de documento fora do critério"], ["E5", "Idioma fora do critério"], ["E6", "Texto completo não obtido"]];
export async function codigos() { return ler("codigos", CODIGOS_PADRAO); }

// ---- OpenAlex (aberto): quem cita e o que é citado, para snowballing ----
const OA = "https://api.openalex.org/";
const oaMail = "mailto=contato@mirandastech.com.br";
export async function openalexObra(doi) {
  const r = await fetch(`${OA}works/https://doi.org/${encodeURIComponent(doi)}?${oaMail}`); if (!r.ok) return null; return r.json();
}
export async function openalexCitantes(oaId, n = 25) {
  const id = oaId.replace(/^https:\/\/openalex\.org\//, "");
  const r = await fetch(`${OA}works?filter=cites:${id}&per-page=${n}&sort=cited_by_count:desc&select=id,doi,title,publication_year,cited_by_count&${oaMail}`);
  if (!r.ok) return []; return ((await r.json()).results || []).map(w => ({ id: (w.doi || w.id).replace(/^https:\/\/doi\.org\//, ""), title: w.title || "", fonte: `${w.publication_year || ""} · ${w.cited_by_count} citações` }));
}
export async function openalexReferencias(ids, n = 25) {
  if (!ids?.length) return [];
  const r = await fetch(`${OA}works?filter=openalex:${ids.slice(0, n).map(i => i.replace(/^https:\/\/openalex\.org\//, "")).join("|")}&per-page=${n}&select=id,doi,title,publication_year,cited_by_count&${oaMail}`);
  if (!r.ok) return []; return ((await r.json()).results || []).map(w => ({ id: (w.doi || w.id).replace(/^https:\/\/doi\.org\//, ""), title: w.title || "", fonte: `${w.publication_year || ""} · ${w.cited_by_count} citações` }));
}
// ---- DOAJ (aberto): o periódico é de acesso aberto listado? ----
export async function doaj(issns) {
  for (const issn of issns || []) {
    try { const r = await fetch(`https://doaj.org/api/search/journals/issn:${encodeURIComponent(issn)}?pageSize=1`); if (!r.ok) continue; const j = await r.json(); if (j.total > 0) { const b = j.results[0].bibjson; return { listado: true, titulo: b.title, apc: b.apc?.has_apc, licenca: (b.license || []).map(x => x.type).join(", ") }; } } catch {}
  }
  return { listado: false };
}
// ---- SHA-256 de um arquivo (coluna sha256 do buscas.csv) ----
export async function sha256(arquivo) {
  const buf = await arquivo.arrayBuffer(); const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// ---- duplicatas: mesmo DOI ou título quase igual (Jaccard de palavras) ----
const norm = (t) => (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2);
export function similares(a, b) { const A = new Set(norm(a)), B = new Set(norm(b)); if (A.size < 4 || B.size < 4) return 0; let i = 0; for (const w of A) if (B.has(w)) i++; return i / (A.size + B.size - i); }
export function duplicatas(recs, decididos) {
  const avisos = {}; const todos = [...recs, ...Object.values(decididos || {}).map(d => ({ id: d.study_id, title: d.titulo, decidido: true }))];
  for (let i = 0; i < recs.length; i++) for (let j = 0; j < todos.length; j++) {
    const a = recs[i], b = todos[j]; if (a.id === b.id && !b.decidido) continue; if (a.id === b.id && b.decidido) continue;
    if ((a.id.toLowerCase() === b.id.toLowerCase()) || similares(a.title, b.title) >= 0.7) { avisos[a.id] = (b.decidido ? "já decidido como " : "possível duplicata de ") + b.id; break; }
  }
  return avisos;
}
// ---- contador PRISMA a partir do que está guardado ----
export function prisma(buscas, decisoes) {
  const d = Object.values(decisoes || {}); const porCod = {};
  d.filter(x => x.decisao === "EXCLUDE").forEach(x => porCod[x.codigo || "?"] = (porCod[x.codigo || "?"] || 0) + 1);
  return { identificados: buscas.reduce((s, b) => s + (parseInt(String(b.total_retornado).replace(/\D/g, "")) || 0), 0), bases: new Set(buscas.map(b => b.base)).size,
    triados: d.length, incluidos: d.filter(x => x.decisao === "INCLUDE").length, maybe: d.filter(x => x.decisao === "MAYBE").length, excluidos: d.filter(x => x.decisao === "EXCLUDE").length, porCodigo: porCod };
}
// ---- fase do PROGRESSO.md → manual que a cobre ----
export const FASE_MANUAL = [[/pergunta|tema|diagn/i, ["Metodologia da pesquisa", "https://metodologia.mirandastech.com.br/"]], [/m[eé]todo|desenho|projeto|[eé]tica/i, ["Metodologia da pesquisa", "https://metodologia.mirandastech.com.br/"]],
  [/busca|string|base/i, ["Busca em bases científicas", "https://busca.mirandastech.com.br/"]], [/biblioteca|zotero|refer/i, ["Zotero", "https://zotero.mirandastech.com.br/"]],
  [/triagem|protocolo|prisma|revis/i, ["Revisão sistemática · PRISMA 2020", "https://prisma.mirandastech.com.br/"]], [/leitura|s[ií]ntese|fichamento|extra/i, ["Gemini Notebook", "https://notebook.mirandastech.com.br/"]],
  [/an[aá]lise|dados/i, ["Análise de dados", "https://dados.mirandastech.com.br/"]], [/escrita|abnt|latex|redig/i, ["LaTeX · Overleaf · abnTeX2", "https://latex.mirandastech.com.br/"]],
  [/banca|defesa|qualifica/i, ["Defesa e qualificação", "https://defesa.mirandastech.com.br/"]], [/entrega|submiss|peri[oó]dico|orcid|lattes/i, ["Submissão · ORCID · Lattes", "https://submissao.mirandastech.com.br/"]],
  [/\bia\b|intelig/i, ["Uso de IA na pesquisa", "https://manual.mirandastech.com.br/"]]];
export function manualDaFase(nome) { const f = FASE_MANUAL.find(([re]) => re.test(nome || "")); return f ? f[1] : ["Laboratório 3D", "https://lab.mirandastech.com.br/"]; }
// ---- importar CSV/TSV exportados (de volta para a extensão) ----
export function lerCsv(texto) {
  const t = texto.replace(/^\ufeff/, ""); const linhas = []; let campo = "", linha = [], aspas = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true; else if (c === ";" || c === ",") { linha.push(campo); campo = ""; } else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; } else if (c !== "\r") campo += c; }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const cab = linhas.shift() || []; return linhas.filter(l => l.some(x => x)).map(l => Object.fromEntries(cab.map((k, i) => [k.trim(), l[i] ?? ""])));
}

// ---- busca direta no OpenAlex (base aberta; sem login) ----
export async function openalexBusca(q, { de = "", ate = "", soArtigos = false, pagina = 1, porPagina = 50 } = {}) {
  const filtros = []; if (de) filtros.push(`from_publication_date:${de}-01-01`); if (ate) filtros.push(`to_publication_date:${ate}-12-31`); if (soArtigos) filtros.push("type:article");
  const url = `${OA}works?search=${encodeURIComponent(q)}${filtros.length ? "&filter=" + filtros.join(",") : ""}&per-page=${porPagina}&page=${pagina}&sort=relevance_score:desc&select=id,doi,title,publication_year,cited_by_count,primary_location,open_access,type&${oaMail}`;
  const r = await fetch(url); if (!r.ok) return { ok: false, status: r.status };
  const j = await r.json();
  return { ok: true, total: j.meta?.count ?? 0, url, filtros: filtros.join("; "), itens: (j.results || []).map(w => ({ id: (w.doi || w.id).replace(/^https:\/\/doi\.org\//, ""), title: w.title || "", ano: w.publication_year || "", periodico: w.primary_location?.source?.display_name || "", cit: w.cited_by_count, oa: !!w.open_access?.is_oa, tipo: w.type || "", fonte: `${w.publication_year || ""} · ${w.primary_location?.source?.display_name || ""} · ${w.cited_by_count} cit.${w.open_access?.is_oa ? " · OA" : ""}` })) };
}
