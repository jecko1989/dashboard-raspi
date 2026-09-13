# Convenzioni backend

- **Config**: usare sempre `get_settings` da `app.core.config`; evitare accesso diretto a `os.environ` nei moduli applicativi.
- **Route sottili**: logica SSH, DB e business nei services, non nelle route.
- **Pydantic v2**: conversione ORM verso schema con `model_validate`.
- **Import lazy nelle route**: usarli quando opportuno per ridurre accoppiamento e side effect.
