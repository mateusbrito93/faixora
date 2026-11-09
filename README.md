<div align="center">

# 🎵 FAIXORA
### *Every song has an identity.*

**Plataforma inteligente de reconhecimento e identificação musical para áudios extensos, CDs completos, coletâneas, medleys e vídeos musicais.**

[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Chromaprint_%2B_PCM-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## 📖 Sobre o Projeto

O **FAIXORA** é uma plataforma web Full Stack de inteligência musical projetada para analisar gravações contínuas de até **1h30 (90 minutos)** — como CDs promocionais, shows ao vivo, sets de DJ, coletâneas e vídeos do YouTube — e extrair automaticamente um **catálogo cronológico completo** de todas as faixas presentes no áudio.

Para cada faixa identificada, o sistema determina:
- 🎶 **Nome da música** e **Cantor / Banda**
- 💿 **Álbum**, **Ano de lançamento** e **Gênero musical predominante**
- ⏱️ **Momento exato de início**, **término estimado** e **duração da faixa**
- 📊 **Grau de confiança (%)** da identificação acústica

---

## ✨ Funcionalidades Principais

- **📊 Dashboard Analítico em Tempo Real:**
  - Indicadores globais de análises realizadas, total de músicas identificadas, tempo total de áudio processado e taxa média de reconhecimento.
  - Gráfico real dos últimos 7 dias agrupado diretamente do banco de dados SQLite.
  - Feed de atividade recente com as últimas faixas identificadas.
- **📤 Duas Fontes de Entrada (Nova Análise):**
  - **Opção A — Upload de Arquivo:** Suporte via *drag-and-drop* para `MP3`, `WAV`, `FLAC`, `M4A`, `AAC`, `OGG` e `MP4`, com leitura imediata de duração, barra de progresso de envio e opção de cancelamento.
  - **Opção B — Link do YouTube:** Validação de URL, obtenção de metadados oficiais (`oEmbed`) e extração automatizada de stream de áudio via `yt-dlp`.
- **🧠 Pipeline Acústico Híbrido (Shazam DSP + Chromaprint/AcoustID + MusicBrainz):**
  - Segmentação automática do áudio com janelas temporais e extração PCM `16kHz` via **FFmpeg**.
  - Reconhecimento acústico real de cada segmento e consolidação inteligente de janelas consecutivas da mesma música em uma única faixa cronológica.
  - Detecção automática do **gênero musical predominante** com base nos metadados oficiais das faixas reconhecidas.
- **📡 Acompanhamento em Tempo Real (Server-Sent Events — SSE):**
  - Tela dedicada com as 6 etapas visuais do processamento, percentual ao vivo, tempo decorrido e contadores de segmentos analisados/pendentes.
  - Processamento resiliente em segundo plano (continua mesmo se o usuário fechar o navegador).
- **🛡️ Tratamento Rigoroso de Músicas Não Identificadas:**
  - O sistema **nunca inventa nomes ou artistas** quando não há evidência acústica.
  - Intervalos sem correspondência são marcados como `"Música não identificada"`, permitindo **Reanálise Acústica** ou **Identificação Manual** com busca integrada ao catálogo do **MusicBrainz**.
- **🎧 Relatório Interativo & Exportação:**
  - Player de áudio sincronizado com mapa visual de segmentos (clique em qualquer faixa para ouvir exatamente aquele trecho).
  - Exportação com 1 clique para **Capítulos do YouTube (Timestamps)**, **CSV** e **JSON**.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias Utilizadas |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS, React Router v7, Lucide Icons |
| **Backend** | Node.js 24+, Express, Server-Sent Events (SSE), Multer |
| **Banco de Dados** | SQLite nativo (`node:sqlite` com `WAL` mode habilitado) |
| **Processamento de Áudio** | FFmpeg, FFprobe, `libchromaprint` (`fpcalc`), `yt-dlp` |
| **Motores de Reconhecimento** | Shazam Acoustic Engine (`node-shazam`), AcoustID API, MusicBrainz API |
| **Infraestrutura** | Docker & Docker Compose |

---

## 🚀 Como Executar com Docker (Recomendado)

O projeto já possui `Dockerfile` e `docker-compose.yml` configurados com todas as dependências nativas (`Node.js 24`, `FFmpeg`, `Chromaprint/fpcalc`, `Python 3` e `yt-dlp`).

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/faixora.git
cd faixora
```

### 2. Suba o container com Docker Compose
```bash
docker compose up -d --build
```

### 3. Acesse no navegador
- **Aplicação Web + API:** [http://localhost:3001](http://localhost:3001)

> 💡 **Persistência de dados:** Os diretórios `./data` (banco SQLite `faixora.db`) e `./uploads` (arquivos de áudio) são mapeados como volumes no `docker-compose.yml`, garantindo que nenhuma análise seja perdida ao reiniciar o container.

---

## 💻 Como Executar Localmente (Desenvolvimento)

### Pré-requisitos
- **Node.js v24+** (necessário para o módulo nativo `node:sqlite`)
- **FFmpeg** instalado e disponível no `PATH` do sistema
- **Python 3** com `yt-dlp` instalado (`pip install yt-dlp`) para suporte a links do YouTube

### Passo a passo

1. **Instale as dependências do Node.js:**
   ```bash
   npm install
   ```

2. **Inicie o servidor backend e o frontend simultaneamente:**
   ```bash
   npm run dev
   ```

3. **Acesse no navegador:**
   - **Frontend (Vite HMR):** [http://localhost:5173](http://localhost:5173)
   - **Backend API & SSE:** [http://localhost:3001](http://localhost:3001)

---

## 📂 Estrutura de Diretórios

```text
faixora/
├── data/                     # Banco de dados SQLite persistente (faixora.db)
├── uploads/                  # Arquivos de áudio enviados e extraídos
├── server/
│   ├── index.js              # Servidor Express, rotas REST e stream SSE
│   ├── db.js                 # Schema SQLite e inicialização de configurações
│   └── audioPipeline.js      # Pipeline FFmpeg, Shazam DSP, Chromaprint e consolidação
├── src/
│   ├── components/           # Layout SaaS, Sidebar responsiva e sistema de Toasts
│   ├── pages/
│   │   ├── Dashboard.tsx     # KPIs, gráfico real de 7 dias e atividade recente
│   │   ├── NewAnalysis.tsx   # Upload drag-and-drop (Opção A) e YouTube (Opção B)
│   │   ├── ProcessingView.tsx# Acompanhamento em tempo real via SSE (6 etapas)
│   │   ├── ReportView.tsx    # Relatório cronológico, player sincronizado e exportação
│   │   ├── AnalysesList.tsx  # Catálogo histórico com busca e filtros por gênero
│   │   └── SettingsView.tsx  # Configurações de chaves AcoustID e limites operacionais
│   ├── utils/
│   │   └── format.ts         # Formatadores de tempo (HH:MM:SS) e tamanho de arquivo
│   ├── types.ts              # Interfaces TypeScript
│   ├── App.tsx               # Roteamento principal
│   └── main.tsx              # Entrypoint React
├── Dockerfile                # Imagem de produção multi-dependências
├── docker-compose.yml        # Orquestração com volumes persistentes
└── package.json              # Scripts e dependências do projeto
```

---

## 🔌 Principais Endpoints da API

| Método | Rota | Descrição |
| :---: | :--- | :--- |
| `GET` | `/api/dashboard` | Retorna métricas globais, gráfico real dos últimos 7 dias e atividade recente |
| `GET` | `/api/analyses` | Lista todas as análises com suporte a busca e filtro por gênero |
| `GET` | `/api/analyses/:id` | Retorna os detalhes da análise, faixas consolidadas e segmentos brutos |
| `GET` | `/api/analyses/:id/stream` | Canal **Server-Sent Events (SSE)** para progresso em tempo real |
| `POST` | `/api/analyses/upload` | Cria uma nova análise a partir de arquivo de áudio/vídeo (`multipart/form-data`) |
| `POST` | `/api/analyses/youtube` | Cria uma nova análise a partir de um link validado do YouTube |
| `POST` | `/api/analyses/:id/reprocess` | Reprocessa o áudio completo com o motor de reconhecimento acústico |
| `POST` | `/api/tracks/:trackId/retry` | Executa nova tentativa de reconhecimento em uma faixa não identificada |
| `PUT` | `/api/tracks/:trackId` | Atualiza/identifica manualmente uma faixa do relatório |
| `GET` | `/api/musicbrainz/search` | Consulta o catálogo oficial do MusicBrainz por nome da música/artista |

---

## 🎨 Identidade Visual

O **FAIXORA** foi desenhado seguindo uma direção visual **Dark SaaS Premium**:
- **Background Principal:** `#0B0F19`
- **Superfícies:** `#111827`
- **Cards:** `#182233`
- **Cor Primária (Azul Elétrico):** `#6366F1`
- **Cor Secundária (Ciano):** `#22D3EE`
- **Tipografia:** `Inter` (Interface) e `JetBrains Mono` (Timestamps e Telemetria)

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja `LICENSE` para mais informações.
