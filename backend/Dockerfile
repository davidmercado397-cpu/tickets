# --- Build: dependencias en un venv aislado ---
FROM python:3.13-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY requirements.txt requirements-dev.txt ./
ARG INSTALL_DEV=false
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --upgrade pip && \
    if [ "$INSTALL_DEV" = "true" ]; then /opt/venv/bin/pip install -r requirements-dev.txt; \
    else /opt/venv/bin/pip install -r requirements.txt; fi

# --- Runtime: imagen mínima (la misma para API y worker) ---
FROM python:3.13-slim
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN groupadd -r appuser && useradd -r -g appuser appuser
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini pytest.ini docker-entrypoint.sh ./
COPY tests ./tests
RUN chmod +x ./docker-entrypoint.sh
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').getcode()==200 else 1)" || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
