// Service worker (Manifest V3): menus de contexto e modo de abertura (painel lateral ou popup). Nada roda sem gesto do usuário.
async function aplicarModo() {
  const { modo = "painel" } = await chrome.storage.local.get("modo");
  if (modo === "painel") { await chrome.action.setPopup({ popup: "" }); await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); }
  else { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }); await chrome.action.setPopup({ popup: "popup.html" }); }
}
chrome.runtime.onStartup.addListener(aplicarModo); aplicarModo();
chrome.storage.onChanged.addListener((ch) => { if (ch.modo) aplicarModo(); });
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "crossref", title: "Conferir DOI no Crossref: \"%s\"", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "extrair", title: "Extrair seleção para a matriz", contexts: ["selection"] });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "crossref") {
    const m = (info.selectionText || "").match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
    const q = m ? m[0].replace(/[).,;]+$/, "") : info.selectionText;
    chrome.tabs.create({ url: "https://search.crossref.org/?q=" + encodeURIComponent(q) });
  }
  if (info.menuItemId === "extrair" && tab?.id) {
    // vira uma nota solta na aba Extração (trecho + artigo + URL); coluna, página e valor são preenchidos no painel
    let doi = "", titulo = "", secao = "";
    try { const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); doi = result?.doi || ""; titulo = result?.title || ""; secao = result?.secao || ""; } catch {}
    const { notas = [] } = await chrome.storage.local.get("notas");
    notas.push({ n: Date.now(), trecho: (info.selectionText || "").trim(), id: doi, titulo, secao, url: info.pageUrl || "", data: new Date().toISOString().slice(0, 10) });
    await chrome.storage.local.set({ notas });
    chrome.action.setBadgeText({ text: String(notas.length) }); chrome.action.setBadgeBackgroundColor({ color: "#C99A2E" });
  }
});
