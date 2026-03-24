FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY server/pyproject.toml ./pyproject.toml
COPY server/app ./app
COPY server/README.md ./README.md

RUN python -m pip install --upgrade pip && \
    python -m pip install -e .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
