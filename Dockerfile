FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY start.py ./
COPY gateway/python ./gateway/python
COPY agents/microsoft-framework ./agents/microsoft-framework
COPY mcp-servers ./mcp-servers
COPY ui ./ui
COPY prompts ./prompts
COPY data ./data
COPY config ./config

RUN useradd --system --create-home --shell /usr/sbin/nologin appuser
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')"

CMD ["python", "start.py"]