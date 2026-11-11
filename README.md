# Ledgerly — Accounting Workspace

Ledgerly is a full-stack accounting application built with **Laravel 12**, **React 19**, **Inertia.js**, and **Tailwind CSS 4**. It ships with a polished dashboard shell, a chart of accounts, contacts, invoicing, payments, double-entry journal entries, and financial reporting — plus a token-authenticated REST API for integrations.

## Stack

| Layer | Technology |
| --- | --- |
| Backend | PHP 8.2+, Laravel 12 |
| Frontend | React 19, Inertia.js 3, Tailwind CSS 4, Heroicons |
| Build | Vite 6, `@vitejs/plugin-react`, `@tailwindcss/vite` |
| Auth | Session auth (web) + Laravel Sanctum bearer tokens (API) |
| Database | MySQL 8 / MariaDB (SQLite `:memory:` for tests) |
| Queue / Cache | Redis via `predis` (database driver also supported) |
| Testing | Pest 3 + PHPUnit 11 |
| Runtime | Native PHP + MariaDB + Vite (Docker/Sail optional) |

## Features

- **Dashboard** with cached KPI cards, cash position, revenue, receivables, recent invoices, and a revenue trend.
- **Chart of accounts** with hierarchical account types, balances, search, and type filters.
- **Contacts** for customers and vendors with search, type filters, and activity stats.
- **Invoices** with line items, tax calculations, status lifecycle (draft → sent → paid/overdue/void), payment tracking, and reminder queueing.
- **Payments** that update invoice balances and statuses automatically.
- **Double-entry journal** with balanced debit/credit validation and posting workflow.
- **Reports** — trial balance and profit & loss with date-range filtering.
- **API tokens** UI for creating and revoking Sanctum personal access tokens.
- **Background processing** — queued invoice reminders and a daily overdue-reminder schedule.
- **Dark sidebar dashboard shell** with responsive layouts, reusable components, and flash messaging.

## Quick Start (native services)

> This is the default setup for this workspace. It needs PHP 8.2+, Composer, Node 20+, and a local MySQL/MariaDB server.

1. Create a MySQL/MariaDB database named `ledgerly`.
2. Point `.env` at your local services:

```dotenv
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ledgerly
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
QUEUE_CONNECTION=database
CACHE_STORE=database
REDIS_CLIENT=predis
```

3. Install, migrate, and build:

```bash
composer install
npm install
php artisan key:generate
php artisan migrate:fresh --seed
npm run build
```

4. Run the app and background workers (each in its own terminal):

```bash
php artisan serve            # http://127.0.0.1:8000
npm run dev                  # Vite HMR on http://localhost:5173 (optional)
php artisan queue:work --tries=1 --timeout=90
php artisan schedule:work    # or cron: * * * * * php artisan schedule:run
```

`npm run dev` is optional; `npm run build` is enough for normal use. On Windows, run the queue worker and scheduler in separate hidden terminals or as scheduled tasks if you want them to persist.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@ledgerly.test` | `password` |
| Accountant | `accountant@ledgerly.test` | `password` |

## Optional: Docker / Sail

> Only needed if you prefer containers. Docker Desktop on Windows requires **WSL2 or Hyper-V**, which in turn require **hardware virtualization (VT-x/AMD-V) enabled in the BIOS/UEFI**. If Docker's engine cannot start, check `Get-CimInstance Win32_Processor | Select VirtualizationFirmwareEnabled`.

Sail provisions MySQL, Redis, Mailpit, a queue worker, and the scheduler from `compose.yaml`.

```bash
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
composer install
npm install

./vendor/bin/sail up -d
./vendor/bin/sail artisan key:generate
./vendor/bin/sail artisan migrate --seed
./vendor/bin/sail npm run build
```

Visit `http://localhost`. Mailpit is available at `http://localhost:8025`.

> On Windows, run Sail commands from WSL or Git Bash. The `queue` and `scheduler` services in `compose.yaml` start automatically with `sail up`.

## API

The API lives under `/api/v1`. Authenticate with a Sanctum bearer token:

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ledgerly.test","password":"password"}'

# Use the returned token
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
```

### Endpoints

| Method | URI | Description |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Register and receive a token |
| `POST` | `/api/v1/auth/login` | Authenticate and receive a token |
| `GET` | `/api/v1/auth/me` | Current user |
| `POST` | `/api/v1/auth/logout` | Revoke the current token |
| `GET/POST` | `/api/v1/accounts` | List / create accounts |
| `GET/PUT/PATCH/DELETE` | `/api/v1/accounts/{id}` | Manage an account |
| `GET/POST` | `/api/v1/contacts` | List / create contacts |
| `GET/PUT/PATCH/DELETE` | `/api/v1/contacts/{id}` | Manage a contact |
| `GET/POST` | `/api/v1/invoices` | List / create invoices |
| `GET/DELETE` | `/api/v1/invoices/{id}` | Show / delete a draft invoice |
| `POST` | `/api/v1/invoices/{id}/payments` | Record a payment |
| `POST` | `/api/v1/invoices/{id}/send` | Mark an invoice as sent |
| `POST` | `/api/v1/invoices/{id}/reminders` | Queue a reminder |
| `GET/POST` | `/api/v1/journal-entries` | List / create journal entries |
| `GET` | `/api/v1/journal-entries/{id}` | Show a journal entry |
| `POST` | `/api/v1/journal-entries/{id}/post` | Post a journal entry |
| `GET` | `/api/v1/reports/dashboard` | Dashboard metrics |
| `GET` | `/api/v1/reports/trial-balance` | Trial balance |
| `GET` | `/api/v1/reports/profit-loss` | Profit & loss |

API routes are rate limited to 120 requests/minute per user or IP; auth endpoints to 6/minute.

## Testing

Tests run against SQLite `:memory:` and require no external services.

```bash
./vendor/bin/pest          # run the suite
./vendor/bin/pint          # format PHP
npm run build              # verify the frontend compiles
```

The suite covers API auth, accounting resources, invoice/payment lifecycle, journal validation, reports, web screens, seeders, and ledger calculations.

## Project Layout

```
app/
  Enums/                 Account, contact, invoice, journal statuses
  Http/Controllers/      Web (Inertia) and Api controllers
  Http/Requests/         Form request validation
  Http/Resources/        API resource transformations
  Jobs/                  SendInvoiceReminder queue job
  Models/                Accounting domain models
  Observers/             Dashboard cache invalidation
  Services/Accounting/   Ledger, invoice, journal, dashboard services
database/
  factories/ migrations/ seeders/
resources/js/
  Components/ Layouts/ Pages/ lib/
routes/
  api.php web.php console.php
tests/
  Feature/ Unit/
compose.yaml             Sail services (app, queue, scheduler, MySQL, Redis, Mailpit)
```

## Notes

- The local `.env` uses database-backed sessions/cache/queues so it works without Redis. `.env.example` is Sail-first and uses Redis.
- `predis` is used instead of the PHP `redis` extension so the app runs anywhere PHP does.
- The dashboard cache is invalidated automatically whenever accounts, invoices, payments, or journal lines change.
- Overdue invoice reminders are queued daily at 09:00 by the scheduler.
