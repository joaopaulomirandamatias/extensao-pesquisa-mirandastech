# Pesquisa MirandasTech · extensão para Chrome

Ferramentas de método científico dentro do navegador, num **painel lateral** que fica aberto enquanto você navega (ou como popup, nas opções). As abas seguem a ordem da pesquisa: Projeto · Busca · Referência · Auditoria · Triagem · Extração · Estilo · Uso de IA · Manuais · Sobre. Tudo roda no seu computador: a extensão só lê a página quando você clica no ícone, consulta a API pública do Crossref e, se estiver aberto, o Zotero local. Nada é enviado a servidores da MirandasTech.

| Aba | O que faz | Regra do manual |
|---|---|---|
| Referência | acha o DOI da página, resolve no Crossref, monta a referência ABNT (NBR 6023), copia, salva no Zotero com coleção e etiqueta; cartão do periódico (ISSN, DOAJ); snowballing pelo OpenAlex (quem cita / referências → triagem) | nenhuma referência entra sem DOI resolvido |
| Auditoria | cola uma lista de referências → cada DOI é conferido; linha sem DOI recebe um candidato por busca bibliográfica | referência inventada é fabricação de evidência |
| Diário | registra base, string exata, filtros e total da tela; SHA-256 do arquivo exportado; exporta `buscas.csv` (formato do plugin, PRISMA-S) | busca sem diário não é reprodutível |
| Triagem | lê os registros da página de resultados; avisa duplicatas (mesmo DOI ou título quase igual) e o que já foi decidido; INCLUDE / EXCLUDE+código / MAYBE com nota; exporta `lote.tsv` | decisão do autor, um a um; trocar decisão exige registro |
| Uso de IA | detecta a ferramenta aberta e registra as dez colunas; exporta `USO_DE_IA.csv` | Portaria CNPq 2.664/2026 |
| Extração | trecho selecionado → botão direito → célula com campo, valor, página e trecho literal; exporta `extracao.csv` | célula conferível |
| Estilo | conta marcas típicas de texto gerado, por regra, sem IA | sinais, não prova |
| Projeto | lê o `PROGRESSO.md` e aponta a fase atual e o manual dela; contador PRISMA; importa CSV/TSV de volta; grava os arquivos na pasta do projeto; backup | uma fase por vez |
| Manuais | links diretos para os 16 manuais, o laboratório 3D e o blog | — |

## Instalar (enquanto não está na Chrome Web Store)

1. Baixe e descompacte `extensao_pesquisa.zip`.
2. `chrome://extensions` → **Modo do desenvolvedor** → **Carregar sem compactação** → escolha a pasta.
3. Fixe o ícone na barra.

## Permissões e por quê

`activeTab` + `scripting` (ler a aba atual só ao clicar) · `storage` (diário, decisões, usos e células, locais) · `clipboardWrite` (copiar ABNT) · `contextMenus` (conferir DOI e extrair seleção) · `sidePanel` (painel lateral) · hosts `api.crossref.org`, `api.openalex.org`, `doaj.org` (APIs públicas, sem chave) e `127.0.0.1:23119` (Zotero). Atalho: `Alt+Shift+P` abre o popup.

## Formatos exportados

Compatíveis com os modelos do plugin Pesquisa MirandasTech: `buscas.csv`, `USO_DE_IA.csv`, `lote.tsv` (aceito por `registrar_lote`). Separador `;`, UTF-8 com BOM.

Licença CC BY 4.0 · MirandasTech · manuais em https://lab.mirandastech.com.br/
