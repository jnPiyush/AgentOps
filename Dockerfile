FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/package.json
COPY agents/package.json ./agents/package.json
COPY mcp-servers/contract-audit-mcp/package.json ./mcp-servers/contract-audit-mcp/package.json
COPY mcp-servers/contract-compliance-mcp/package.json ./mcp-servers/contract-compliance-mcp/package.json
COPY mcp-servers/contract-drift-mcp/package.json ./mcp-servers/contract-drift-mcp/package.json
COPY mcp-servers/contract-eval-mcp/package.json ./mcp-servers/contract-eval-mcp/package.json
COPY mcp-servers/contract-extraction-mcp/package.json ./mcp-servers/contract-extraction-mcp/package.json
COPY mcp-servers/contract-feedback-mcp/package.json ./mcp-servers/contract-feedback-mcp/package.json
COPY mcp-servers/contract-intake-mcp/package.json ./mcp-servers/contract-intake-mcp/package.json
COPY mcp-servers/contract-workflow-mcp/package.json ./mcp-servers/contract-workflow-mcp/package.json

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV WORKSPACE_START_SCRIPT=start:prod

COPY package.json package-lock.json ./
COPY gateway/package.json ./gateway/package.json
COPY agents/package.json ./agents/package.json
COPY mcp-servers/contract-audit-mcp/package.json ./mcp-servers/contract-audit-mcp/package.json
COPY mcp-servers/contract-compliance-mcp/package.json ./mcp-servers/contract-compliance-mcp/package.json
COPY mcp-servers/contract-drift-mcp/package.json ./mcp-servers/contract-drift-mcp/package.json
COPY mcp-servers/contract-eval-mcp/package.json ./mcp-servers/contract-eval-mcp/package.json
COPY mcp-servers/contract-extraction-mcp/package.json ./mcp-servers/contract-extraction-mcp/package.json
COPY mcp-servers/contract-feedback-mcp/package.json ./mcp-servers/contract-feedback-mcp/package.json
COPY mcp-servers/contract-intake-mcp/package.json ./mcp-servers/contract-intake-mcp/package.json
COPY mcp-servers/contract-workflow-mcp/package.json ./mcp-servers/contract-workflow-mcp/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/gateway/dist ./gateway/dist
COPY --from=builder /app/mcp-servers ./mcp-servers
COPY --from=builder /app/ui ./ui
COPY --from=builder /app/prompts ./prompts
COPY --from=builder /app/data ./data
COPY --from=builder /app/config ./config

RUN find /app/mcp-servers -type d -name src -prune -exec rm -rf {} +
RUN find /app/mcp-servers -type f \( -name "tsconfig.json" -o -name "*.ts" \) -delete

RUN useradd --system --create-home --shell /usr/sbin/nologin appuser
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 CMD node -e "fetch('http://127.0.0.1:8000/api/v1/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"

CMD ["node", "dist/start.js"]