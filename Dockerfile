# ==============================================================================
# FAIXORA — Multi-stage Production Dockerfile
# Node.js 24 + FFmpeg + Chromaprint (fpcalc) + Python3 / yt-dlp + SQLite
# ==============================================================================

FROM node:24-bookworm-slim AS base

# Install system dependencies required by FAIXORA audio pipeline:
# - ffmpeg: audio normalization, 16kHz PCM extraction, ffprobe metadata
# - libchromaprint-tools: fpcalc for AcoustID fingerprinting
# - python3 + pip: yt-dlp YouTube audio stream extraction
# - ca-certificates & curl: HTTPS requests and container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libchromaprint-tools \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
  && pip3 install --no-cache-dir --break-system-packages yt-dlp \
  && ln -sf /usr/bin/python3 /usr/local/bin/python \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source and build the React + Vite frontend
COPY . .
RUN npm run build

# Ensure persistent directories exist for SQLite database and uploaded audio files
RUN mkdir -p /app/data /app/uploads

ENV NODE_ENV=production
ENV PORT=3001
ENV TZ=America/Sao_Paulo

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/dashboard || exit 1

CMD ["node", "server/index.js"]
