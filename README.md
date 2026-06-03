# Painel de Contratacoes da Reitoria

Painel publico de consulta do cronograma de contratacoes da Reitoria do Colegio Pedro II. Esta versao foi preparada para GitHub Pages e usa um Google Apps Script proprio como backend somente de leitura da planilha.

Site publicado:

```text
https://decofcp2-afk.github.io/painel-contratacoes-reitoria/
```

## Arquitetura

```text
Google Sheets (banco de dados)
         |
         | leitura
         v
Apps Script do Painel (backend somente leitura)
         |
         | JSONP publico
         v
Painel de Contratacoes (GitHub Pages)
```

## Arquivos

```text
.
|-- index.html
|-- config.js
|-- .gitignore
|-- README.md
`-- apps-script/
    `-- Code.gs
```

## Como Publicar no GitHub Pages

1. Use um repositorio separado para o painel, como `painel-contratacoes-reitoria`.
2. Mantenha `index.html`, `config.js`, `README.md` e `apps-script/` na raiz do repositorio.
3. No Apps Script da conta institucional, cole o conteudo de `apps-script/Code.gs`.
4. Implante o Apps Script como Web App.
5. Copie a URL `/exec` da implantacao.
6. Cole essa URL em `config.js`, no campo `apiUrl`.
7. Ative o GitHub Pages em `Settings > Pages`, com `main` e `/(root)`.

O campo `Custom domain` deve ficar vazio enquanto nao houver um dominio institucional real com DNS configurado pela TI.

## Rotas do Backend

O painel usa apenas rotas publicas de leitura:

- `?route=painel.dados`
- `?route=painel.capacidade`

Para funcionar em GitHub Pages, o painel usa JSONP:

```text
?route=painel.dados&callback=nomeDaFuncao
```
