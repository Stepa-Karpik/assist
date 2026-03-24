FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY bot/pyproject.toml ./pyproject.toml
COPY bot/app ./app
COPY bot/README.md ./README.md

RUN python -m pip install --upgrade pip && \
    python -m pip install -e .

CMD ["python", "-m", "app.main"]
