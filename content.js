// Content script: roda dentro da página aberta e SÓ LÊ. Nunca preenche formulário, nunca faz login.
// Devolve um objeto com o que as abas do popup precisam.
(() => {
  const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.content || "";
  const RE_DOI = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
  const limpa = (d) => (d || "").replace(/^.*doi\.org\//, "").replace(/[).,;]+$/, "");
  const u = new URL(location.href);
  const host = u.hostname.replace(/^www\./, "");

  // ---- 1. DOI da página (artigo aberto) ----
  let doi = meta("citation_doi") || meta("dc.identifier") || meta("DC.Identifier") || meta("prism.doi");
  if (!RE_DOI.test(doi)) {
    const a = [...document.querySelectorAll('a[href*="doi.org/"]')].map(a => a.href).find(h => RE_DOI.test(h));
    doi = (a || document.body.innerText).match(RE_DOI)?.[0] || "";
  }
  doi = limpa(doi);

  // ---- 2. Base de dados e busca (diário PRISMA-S) ----
  const BASES = {
    "webofscience.com": "Web of Science", "clarivate.com": "Web of Science", "scopus.com": "Scopus",
    "search.scielo.org": "SciELO", "scielo.org": "SciELO", "pubmed.ncbi.nlm.nih.gov": "PubMed",
    "ieeexplore.ieee.org": "IEEE Xplore", "scholar.google.com": "Google Scholar", "scholar.google.com.br": "Google Scholar",
    "periodicos.capes.gov.br": "Portal de Periódicos CAPES", "openalex.org": "OpenAlex", "semanticscholar.org": "Semantic Scholar",
    "search.crossref.org": "Crossref", "dl.acm.org": "ACM Digital Library", "sciencedirect.com": "ScienceDirect",
    "link.springer.com": "SpringerLink", "bdtd.ibict.br": "BDTD", "lens.org": "Lens", "dimensions.ai": "Dimensions"
  };
  const base = Object.entries(BASES).find(([k]) => host === k || host.endsWith("." + k))?.[1] || host;
  const PARAMS = ["q", "query", "s", "term", "queryText", "search", "TS", "AllField", "searchTerm", "text", "qs"];
  let query = PARAMS.map(k => u.searchParams.get(k)).find(Boolean) || "";
  if (!query) {
    // bases que não põem a string na URL (Web of Science, Scopus dinâmico): tenta o campo de busca visível
    const inp = document.querySelector('input[type="search"], input[name="q"], input[aria-label*="earch" i], textarea[aria-label*="earch" i]');
    query = inp?.value || "";
  }
  const filtros = [...u.searchParams.entries()].filter(([k]) => !PARAMS.includes(k) && !/^(page|start|sort|pos|offset|hl|lang|as_sdt|as_vis|oq|sxsrf|ei|ved|uact)$/i.test(k))
    .map(([k, v]) => `${k}=${v}`).join("; ");
  const txt = document.body.innerText;
  const mc = txt.match(/(?:of|de|aproximadamente|about)?\s*([\d][\d.,]{0,12})\s*(results?|resultados?|documents?|documentos?|registros?|records?|artigos?|articles?)\b/i);
  const count = mc ? mc[1].replace(/[.,](?=\d{3}\b)/g, "") : "";

  // ---- 3. Registros da página de resultados (triagem no navegador) ----
  const recs = []; const seen = new Set();
  const push = (id, title, extra) => { id = (id || "").trim(); title = (title || "").replace(/\s+/g, " ").trim(); if (!id || !title || seen.has(id)) return; seen.add(id); recs.push({ id, title, ...extra }); };
  if (host === "pubmed.ncbi.nlm.nih.gov") {
    document.querySelectorAll(".docsum-content").forEach(el => {
      const t = el.querySelector(".docsum-title"); const cit = el.querySelector(".docsum-journal-citation")?.textContent || "";
      const d = limpa(cit.match(RE_DOI)?.[0]); const pmid = t?.getAttribute("data-article-id");
      push(d || (pmid ? "PMID:" + pmid : ""), t?.textContent, { fonte: cit.slice(0, 120) });
    });
  } else if (host.endsWith("scielo.org")) {
    document.querySelectorAll(".results .item, .item").forEach(el => {
      const t = el.querySelector(".title, strong.title, a.title"); const d = limpa([...el.querySelectorAll('a[href*="doi.org"]')].map(a => a.href).find(h => RE_DOI.test(h)));
      push(d || t?.href || "", t?.textContent, { fonte: el.querySelector(".source")?.textContent?.trim().slice(0, 120) || "" });
    });
  } else if (host.startsWith("scholar.google")) {
    document.querySelectorAll(".gs_r .gs_ri").forEach(el => {
      const t = el.querySelector(".gs_rt a"); push(t?.href || "", t?.textContent, { fonte: el.querySelector(".gs_a")?.textContent?.slice(0, 120) || "" });
    });
  }
  if (!recs.length) {
    // genérico: todo link para doi.org vira um registro; o título é o texto do link ou do cabeçalho mais próximo
    document.querySelectorAll('a[href*="doi.org/10."]').forEach(a => {
      const d = limpa(a.href.match(RE_DOI)?.[0]); if (!d) return;
      const h = a.closest("li, article, tr, .result, .item, div")?.querySelector("h1,h2,h3,h4,.title,strong");
      const t = (a.textContent && !RE_DOI.test(a.textContent) && a.textContent.trim().length > 15) ? a.textContent : (h?.textContent || "");
      push(d, t, { fonte: "" });
    });
  }

  // ---- 4. Ferramenta de IA aberta (registro de uso) ----
  const IA = { "chatgpt.com": ["ChatGPT", "OpenAI"], "chat.openai.com": ["ChatGPT", "OpenAI"], "claude.ai": ["Claude", "Anthropic"], "gemini.google.com": ["Gemini", "Google"],
    "notebooklm.google.com": ["NotebookLM", "Google"], "elicit.com": ["Elicit", "Elicit"], "consensus.app": ["Consensus", "Consensus"], "scite.ai": ["Scite", "Scite"],
    "perplexity.ai": ["Perplexity", "Perplexity"], "copilot.microsoft.com": ["Copilot", "Microsoft"], "typeset.io": ["SciSpace", "SciSpace"], "scispace.com": ["SciSpace", "SciSpace"],
    "researchrabbitapp.com": ["ResearchRabbit", "ResearchRabbit"], "connectedpapers.com": ["Connected Papers", "Connected Papers"], "undermind.ai": ["Undermind", "Undermind"] };
  const ia = Object.entries(IA).find(([k]) => host === k || host.endsWith("." + k))?.[1] || null;

  // ---- 5. seleção atual e a seção (último título antes dela): vira a «página/seção» da célula em páginas HTML ----
  const sel = window.getSelection(); const selection = (sel?.toString() || "").trim().slice(0, 2000); let secao = "";
  if (selection && sel.rangeCount) {
    const no = sel.getRangeAt(0).startContainer; const el = no.nodeType === 1 ? no : no.parentElement;
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(h => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    secao = (hs.at(-1)?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90);
    const pg = el.closest?.("[data-page-number],[data-page],.page"); const npg = pg?.getAttribute("data-page-number") || pg?.getAttribute("data-page"); if (npg) secao = `p. ${npg}` + (secao ? " · " + secao : "");
  }
  return {
    doi, base, query, filtros, count, url: u.origin + u.pathname, href: location.href, title: document.title,
    records: recs.slice(0, 200), ia: ia ? { ferramenta: ia[0], fornecedor: ia[1] } : null,
    selection, secao
  };
})();
