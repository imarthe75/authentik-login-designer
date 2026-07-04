FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Ejecutar como usuario sin privilegios (evita que un RCE en el proceso
# obtenga root dentro del contenedor). UID/GID 1000 para que coincida con el
# propietario del bind-mount del host (docker-compose.yml monta ./backend:/app,
# propiedad de un usuario host con uid/gid 1000) y con el volumen compartido
# de templates de Authentik si se monta más adelante — ver la regresión
# documentada en authentik-login-manager al aplicar este mismo cambio.
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --home /app app \
    && chown -R app:app /app
USER app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
