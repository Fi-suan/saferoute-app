# Alembic migrations

## First-time setup on existing DB

The database already exists in production with all tables from
`Base.metadata.create_all()`. We need to tell Alembic "this DB is
already at the latest schema, don't try to recreate everything".

```bash
cd backend
pip install -r requirements-dev.txt

# 1) Generate the initial migration that captures the current schema
alembic revision --autogenerate -m "initial schema"

# 2) IMPORTANT: stamp the existing DB as already-migrated
#    (otherwise Alembic will try to CREATE tables that exist)
alembic stamp head
```

After this, every future change to `app/models.py` is captured by:

```bash
# Auto-generate a migration from the diff
alembic revision --autogenerate -m "describe what changed"

# Review the generated file in alembic/versions/ — autogenerate is
# not perfect (e.g. column renames look like drop+add). Edit if needed.

# Apply the migration
alembic upgrade head

# Roll back the last migration if something went wrong
alembic downgrade -1
```

## Removing `Base.metadata.create_all()` from app startup

Once Alembic is the source of truth, the runtime should not auto-create
tables. Edit `backend/app/main.py` lifespan:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Base.metadata.create_all(bind=engine)   # ← remove
    # logger.info("Database tables initialized")
    db = SessionLocal()
    try:
        from app.seed import seed_geozones
        seed_geozones(db)
    finally:
        db.close()
    yield
```

For new deployments, run `alembic upgrade head` once before starting the app.
On Render, add this to the build/start command:

```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Common commands

| Command | What it does |
|---------|--------------|
| `alembic current` | Show which revision the DB is currently at |
| `alembic history` | List all migrations in order |
| `alembic upgrade head` | Apply all pending migrations |
| `alembic upgrade +1` | Apply just the next one |
| `alembic downgrade -1` | Roll back the last one |
| `alembic downgrade base` | Roll back everything (DANGEROUS) |
| `alembic stamp head` | Mark current DB as up-to-date without running migrations |

## Tips

- Always commit migration files to git. They're code.
- Review `--autogenerate` output. It can't detect column renames or
  data backfills — those need manual edits.
- Test migrations on a copy of prod data before deploying.
- Never edit a migration that has already been applied to prod.
  Add a new one instead.
