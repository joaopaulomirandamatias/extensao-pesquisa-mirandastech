# Ficha da Chrome Web Store — Pesquisa MirandasTech

**Nome:** Pesquisa MirandasTech
**Resumo (≤132):** Método científico no navegador: referências conferidas no Crossref, diário de busca, triagem, extração e registro de uso de IA. Tudo local.
**Categoria:** Produtividade → Ferramentas de desenvolvedor? Não: **Educação**
**Idioma:** Português (Brasil)

## Descrição

Pesquisa MirandasTech é o braço, dentro do navegador, dos manuais abertos de pesquisa científica da MirandasTech (16 manuais, CC BY 4.0) e do plugin Pesquisa MirandasTech para Claude e ChatGPT. Abre num painel lateral que fica ao lado da página enquanto você lê, busca e decide.

O que faz, na ordem de uma pesquisa:
• Projeto — onde está o plugin e o que ele faz; lê o PROGRESSO.md do seu projeto e aponta a fase atual e o manual dela; cria a pasta inicial do projeto; grava os registros na pasta; contador PRISMA.
• Busca — pesquisa direta no OpenAlex (base aberta, sem login) e diário de busca no padrão PRISMA-S: base, string exata, filtros, total e SHA-256 do arquivo exportado.
• Referência — lê o DOI do artigo aberto (ou você cola um), confere no Crossref, monta a referência ABNT (NBR 6023), mostra o periódico (ISSN, DOAJ), citações e referências pelo OpenAlex, e salva no Zotero com coleção e etiqueta.
• Auditoria — cola uma bibliografia inteira e confere cada DOI; linha sem DOI recebe um candidato para você conferir; as verdes vão ao Zotero em lote.
• Triagem — lê os registros da página de resultados (PubMed, SciELO, Google Scholar, qualquer página com DOIs, listas do OpenAlex), avisa duplicatas, e registra INCLUDE / EXCLUDE com código / MAYBE, um a um; exporta lote.tsv.
• Extração — selecione trechos enquanto lê (botão direito ou botão no painel), depois dê a coluna da matriz; cada célula guarda trecho literal, seção/página e valor.
• Estilo — conta, por regra e sem IA, as marcas típicas de texto gerado.
• Uso de IA — registra cada uso que influenciou decisão ou texto, nas dez colunas que a Portaria CNPq 2.664/2026 e as revistas pedem; exporta USO_DE_IA.csv.
• Manuais — links diretos para os 16 manuais e o laboratório 3D.

Privacidade: a extensão só lê a aba quando você clica no ícone (ou, se autorizar, enquanto o painel está aberto). Consulta as APIs públicas do Crossref, OpenAlex e DOAJ, e o Zotero no seu próprio computador. Buscas, decisões, usos e células ficam no seu navegador; você exporta ou apaga quando quiser. Não há conta, servidor, coleta de uso nem login em base alguma.

Feito por João Paulo Miranda Matias (MirandasTech). Manuais: https://lab.mirandastech.com.br/ · Blog: https://blog.mirandastech.com.br/

## Justificativa das permissões (campo «Práticas de privacidade»)

- activeTab + scripting: ler a aba ativa (DOI, string de busca, resultados, seleção) só quando o usuário clica no ícone ou usa o menu de contexto.
- storage: guardar localmente diário, decisões, usos de IA, notas e células.
- clipboardWrite: copiar a referência ABNT e comandos.
- contextMenus: «Conferir DOI no Crossref» e «Extrair seleção para a matriz» sobre texto selecionado.
- sidePanel: interface em painel lateral.
- host api.crossref.org, api.openalex.org, doaj.org: APIs públicas, sem chave, consultadas com o DOI/ISSN/texto que o usuário pede para conferir.
- host 127.0.0.1:23119: servidor do conector do Zotero, no computador do usuário.
- optional_host_permissions http/https: leitura automática das páginas no painel lateral, pedida explicitamente ao usuário e revogável nas opções.
- Uso de código remoto: não. Coleta de dados: nenhuma.

**Política de privacidade (URL pública):** https://github.com/joaopaulomirandamatias/extensao-pesquisa-mirandastech/blob/main/PRIVACIDADE.md
**Site:** https://plugin.mirandastech.com.br/ · **Suporte:** contato@mirandastech.com.br
**Visibilidade sugerida:** Pública (ou Não listada para a turma primeiro)
