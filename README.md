# Tournament Hub

Aplicação web mobile-first para o ecossistema de tênis brasileiro: agrega torneios da CBT, FPT e federações em um único hub centrado no jogador, com motor de elegibilidade explicável, watchlist, alertas proativos e painel administrativo.

**Stack:** Django 5 · DRF · PostgreSQL · Redis · Celery · React 18 · TypeScript · Tailwind · Vite · Railway.

---

## 1. Rodar localmente

### Pré-requisitos
- Python 3.11+
- Node.js 20+
- PostgreSQL 14+ e Redis 6+ (ou as credenciais do Railway, já configuradas no `.env`)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # ajuste DATABASE_URL e REDIS_URL se necessário
python manage.py migrate
python manage.py seed_all         # popula categorias, federações, fontes
python manage.py createsuperuser  # opcional, para acessar /admin
python manage.py runserver 0.0.0.0:8000
```

API disponível em `http://localhost:8000` · Docs Swagger em `/api/docs/` · Admin Django em `/admin/`.

### Worker e scheduler (opcional para desenvolvimento)

Em terminais separados:

```bash
cd backend && source venv/bin/activate
celery -A config worker --loglevel=info
celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env              # VITE_API_BASE_URL=http://localhost:8000
npm run dev                       # abre em http://localhost:5173
```

Para gerar build de produção: `npm run build` (saída em `dist/`).

---

## 2. Configurar PostgreSQL no Railway

1. No painel do Railway, **New → Database → Add PostgreSQL**.
2. Aguarde o provisionamento. Em **Variables**, copie:
   - `DATABASE_URL` (interno, usado pelo serviço da API)
   - `DATABASE_PUBLIC_URL` (externo, usado para conexões locais)
3. No serviço da API (passo 4), configure a variável `DATABASE_URL` com o valor interno do Postgres do Railway.
4. As migrations rodam automaticamente no `release` do deploy (definido no `Procfile`).

Para **Redis**, repita o processo (**New → Database → Add Redis**) e exponha a variável `REDIS_URL` ao serviço da API.

---

## 3. Rodar e fazer o deploy no Railway

### Backend

1. **New → GitHub Repo** → selecione o repositório.
2. Em **Settings → Source → Root Directory**: `backend`.
3. **Settings → Variables**, defina (mínimo):

   | Variável | Valor |
   | --- | --- |
   | `SECRET_KEY` | string aleatória ≥ 50 caracteres |
   | `DEBUG` | `False` |
   | `ALLOWED_HOSTS` | `seu-app.up.railway.app,*.railway.app` |
   | `CSRF_TRUSTED_ORIGINS` | `https://seu-app.up.railway.app` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `CORS_ALLOWED_ORIGINS` | `https://seu-frontend.up.railway.app` |
   | `FRONTEND_URL` | `https://seu-frontend.up.railway.app` |
   | `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | (opcional, p/ envio real de e-mails) |

4. **Settings → Networking → Generate Domain**.
5. O Railway detecta `nixpacks.toml` + `Procfile`, instala dependências, executa `release` (migrate + collectstatic + seed_all) e sobe `gunicorn`. Healthcheck em `/health/`.
6. Para subir o **worker** e o **beat** como serviços separados no mesmo projeto:
   - **New Service → Empty Service** (ou Deploy from Repo) duplicando o backend
   - Em **Settings → Deploy → Custom Start Command**:
     - Worker: `celery -A config worker --loglevel=info --concurrency=2`
     - Beat:   `celery -A config beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler`

### Frontend

1. **New → GitHub Repo**, mesmo repositório.
2. **Settings → Source → Root Directory**: `frontend`.
3. **Variables**:

   | Variável | Valor |
   | --- | --- |
   | `VITE_API_BASE_URL` | `https://seu-app.up.railway.app` |

4. **Networking → Generate Domain**. Build executa `npm run build` e serve `dist/` via `vite preview`.

### Comandos úteis (Railway CLI)

```bash
railway login
railway link                   # vincula ao projeto
railway logs --service api     # logs em tempo real
railway run python manage.py migrate
railway run python manage.py createsuperuser
railway run python manage.py seed_all
```

---

## 4. Deploy resumido

| Etapa | Comando |
| --- | --- |
| Migrations | rodam no `release` do `Procfile` automaticamente |
| Seed inicial | `python manage.py seed_all` (também executado no `release`) |
| Healthcheck | `GET /health/` deve retornar `{"status":"ok"}` |
| Disparar ingestão manual | `POST /api/ingestion/runs/run-all/` (auth admin) ou via painel |
| Logs | `railway logs --service <api|worker|beat|frontend>` |

### Estrutura de pastas

```
tournament_hub/
├── backend/          Django + DRF + Celery
│   ├── apps/         11 apps (accounts, players, tournaments, eligibility, ...)
│   ├── config/       settings, urls, celery, wsgi
│   ├── templates/    e-mail templates
│   ├── Procfile  railway.json  nixpacks.toml  runtime.txt
│   └── requirements.txt
└── frontend/         React + TypeScript + Tailwind + Vite
    ├── src/
    │   ├── components/   AppLayout, ProtectedRoute, TournamentCard
    │   ├── contexts/     AuthContext (JWT)
    │   ├── pages/        Login, Register, Onboarding, Home, Tournaments,
    │   │                 TournamentDetail, Watchlist, Alerts, Profile, Admin
    │   ├── services/     api (axios + JWT refresh), auth, tournaments, data
    │   ├── types/        TypeScript matching backend serializers
    │   └── utils/        format helpers (datas, BRL, status, motivos)
    └── package.json  vite.config.ts  tailwind.config.js  nixpacks.toml
```

### Endpoints principais

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/register/` | criar conta + LGPD consent |
| POST | `/api/auth/login/` | obter access + refresh JWT |
| GET  | `/api/tournaments/editions/` | lista paginada com filtros |
| GET  | `/api/tournaments/editions/closing_soon/?days=14` | inscrições fechando |
| GET  | `/api/tournaments/editions/compatible/?profile_id=N` | torneios compatíveis |
| GET  | `/api/eligibility/evaluate/<id>/?profile_id=N` | avaliação por categoria |
| POST | `/api/watchlist/toggle/` | adicionar/remover da agenda |
| GET  | `/api/alerts/` | central de alertas |
| GET  | `/api/admin-panel/dashboard/` | métricas admin |
| POST | `/api/ingestion/runs/run-all/` | dispara ingestão (admin) |
| GET  | `/api/docs/` | Swagger UI completo |
