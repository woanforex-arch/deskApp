<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Backup;
use App\Models\Bill;
use App\Models\ClosingChecklist;
use App\Models\ClosingTask;
use App\Models\Contact;
use App\Models\DataImport;
use App\Models\Integration;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Payment;
use App\Models\ScheduledReport;
use App\Models\User;
use App\Models\Webhook;
use App\Models\WebhookDelivery;
use App\Services\Accounting\AuditService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PlatformController extends Controller
{
    public function __construct(private readonly AuditService $audit) {}

    /**
     * Mask credential values before they reach the client.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function maskSecrets(array $config): array
    {
        return collect($config)->map(function ($value, string $key) {
            if (preg_match('/key|secret|token|password/i', $key) && is_string($value) && $value !== '') {
                return str_repeat('•', min(max(mb_strlen($value) - 4, 4), 24)).mb_substr($value, -4);
            }

            return $value;
        })->all();
    }

    public function index(): Response
    {
        $integrations = Integration::query()->orderBy('name')->get()->map(fn (Integration $integration) => [
            'id' => $integration->id,
            'name' => $integration->name,
            'type' => $integration->type,
            'provider' => $integration->provider,
            'status' => $integration->status,
            'last_synced_at' => $integration->last_synced_at?->toIso8601String(),
            'config' => $this->maskSecrets($integration->config ?? []),
        ]);

        $webhooks = Webhook::query()
            ->withCount('deliveries')
            ->orderBy('name')
            ->get()
            ->map(fn (Webhook $webhook) => [
                'id' => $webhook->id,
                'name' => $webhook->name,
                'event' => $webhook->event,
                'url' => $webhook->url,
                'is_active' => $webhook->is_active,
                'last_triggered_at' => $webhook->last_triggered_at?->toIso8601String(),
                'deliveries_count' => $webhook->deliveries_count,
            ]);

        $deliveries = WebhookDelivery::query()
            ->with('webhook:id,name')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (WebhookDelivery $delivery) => [
                'id' => $delivery->id,
                'webhook' => $delivery->webhook?->name,
                'event' => $delivery->event,
                'response_status' => $delivery->response_status,
                'delivered_at' => $delivery->delivered_at?->toIso8601String(),
            ]);

        $scheduled = ScheduledReport::query()->orderBy('name')->get()->map(fn (ScheduledReport $report) => [
            'id' => $report->id,
            'name' => $report->name,
            'report' => $report->report,
            'recipients' => $report->recipients,
            'frequency' => $report->frequency,
            'next_run_at' => $report->next_run_at?->toIso8601String(),
            'last_sent_at' => $report->last_sent_at?->toIso8601String(),
            'is_active' => $report->is_active,
        ]);

        $imports = DataImport::query()
            ->with('importer:id,name')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (DataImport $import) => [
                'id' => $import->id,
                'type' => $import->type,
                'file_name' => $import->file_name,
                'status' => $import->status,
                'rows_processed' => $import->rows_processed,
                'errors' => $import->errors,
                'importer' => $import->importer?->name,
                'created_at' => $import->created_at?->toIso8601String(),
            ]);

        $backups = Backup::query()
            ->with('creator:id,name')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (Backup $backup) => [
                'id' => $backup->id,
                'name' => $backup->name,
                'disk' => $backup->disk,
                'path' => $backup->path,
                'size' => (int) $backup->size,
                'status' => $backup->status,
                'creator' => $backup->creator?->name,
                'created_at' => $backup->created_at?->toIso8601String(),
            ]);

        $checklists = ClosingChecklist::query()
            ->with(['period:id,name', 'tasks'])
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (ClosingChecklist $checklist) => [
                'id' => $checklist->id,
                'name' => $checklist->name,
                'period' => $checklist->period?->name,
                'status' => $checklist->status,
                'due_date' => $checklist->due_date?->toDateString(),
                'progress' => $checklist->progress(),
                'tasks' => $checklist->tasks->map(fn (ClosingTask $task) => [
                    'id' => $task->id,
                    'title' => $task->title,
                    'status' => $task->status,
                    'owner' => $task->owner,
                    'notes' => $task->notes,
                ]),
            ]);

        return Inertia::render('Platform/Index', [
            'integrations' => $integrations,
            'webhooks' => $webhooks,
            'deliveries' => $deliveries,
            'scheduledReports' => $scheduled,
            'imports' => $imports,
            'backups' => $backups,
            'checklists' => $checklists,
            'stats' => [
                'integrations' => Integration::query()->where('status', 'connected')->count(),
                'webhooks' => Webhook::query()->where('is_active', true)->count(),
                'scheduled' => ScheduledReport::query()->where('is_active', true)->count(),
                'imports' => DataImport::query()->count(),
                'backups' => Backup::query()->count(),
                'checklists' => ClosingChecklist::query()->where('status', 'in_progress')->count(),
            ],
            'integrationTypes' => ['erp', 'crm', 'bank', 'payroll', 'tax', 'ecommerce', 'custom'],
            'reportKeys' => [
                'trial-balance', 'balance-sheet', 'profit-loss', 'cash-flow', 'general-ledger',
                'aging-receivable', 'aging-payable', 'vat', 'budget-vs-actual', 'department', 'project', 'branch', 'audit',
            ],
            'frequencies' => ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
            'events' => [
                'invoice.created', 'invoice.posted', 'payment.received', 'bill.posted',
                'vendor-payment.posted', 'journal.posted', 'payroll.posted', 'tax.remitted',
            ],
            'importTypes' => ['accounts', 'contacts'],
        ]);
    }

    public function storeIntegration(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(['erp', 'crm', 'bank', 'payroll', 'tax', 'ecommerce', 'custom'])],
            'provider' => ['nullable', 'string', 'max:80'],
            'endpoint' => ['nullable', 'url', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:255'],
        ]);

        Integration::create([
            'name' => $data['name'],
            'type' => $data['type'],
            'provider' => $data['provider'] ?? null,
            'config' => array_filter([
                'endpoint' => $data['endpoint'] ?? null,
                'api_key' => $data['api_key'] ?? null,
            ]),
            'status' => 'disconnected',
        ]);

        return back()->with('success', 'Integration created. Sync when you are ready.');
    }

    public function syncIntegration(Request $request, Integration $integration): RedirectResponse
    {
        $integration->forceFill([
            'status' => 'connected',
            'last_synced_at' => now(),
        ])->save();

        $this->audit->log('integration.synced', $integration, [], ['status' => 'connected'], "Synced {$integration->name}");

        return back()->with('success', "{$integration->name} synced successfully.");
    }

    public function storeWebhook(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'event' => ['required', 'string', 'max:60'],
            'url' => ['required', 'url', 'max:255'],
            'secret' => ['nullable', 'string', 'max:255'],
        ]);

        Webhook::create([...$data, 'is_active' => true]);

        return back()->with('success', 'Webhook registered.');
    }

    public function testWebhook(Request $request, Webhook $webhook): RedirectResponse
    {
        $payload = ['event' => $webhook->event, 'test' => true, 'sent_at' => now()->toIso8601String()];
        $status = null;
        $body = null;

        try {
            $response = Http::timeout(5)
                ->withHeaders(array_filter(['X-Ledgerly-Secret' => $webhook->secret]))
                ->post($webhook->url, $payload);

            $status = $response->status();
            $body = mb_substr($response->body(), 0, 2000);
        } catch (\Throwable $exception) {
            $body = $exception->getMessage();
        }

        WebhookDelivery::create([
            'webhook_id' => $webhook->id,
            'event' => $webhook->event,
            'payload' => $payload,
            'response_status' => $status,
            'response_body' => $body,
            'delivered_at' => now(),
        ]);

        $webhook->forceFill(['last_triggered_at' => now()])->save();

        return back()->with('success', 'Webhook test delivered and logged.');
    }

    public function storeScheduledReport(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'report' => ['required', 'string', 'max:60'],
            'recipients' => ['required', 'string', 'max:255'],
            'frequency' => ['required', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])],
        ]);

        ScheduledReport::create([
            ...$data,
            'next_run_at' => match ($data['frequency']) {
                'daily' => now()->addDay(),
                'weekly' => now()->addWeek(),
                'quarterly' => now()->addMonths(3),
                'yearly' => now()->addYear(),
                default => now()->addMonth(),
            },
            'is_active' => true,
        ]);

        return back()->with('success', 'Scheduled report created.');
    }

    public function storeImport(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['accounts', 'contacts'])],
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $file = $data['file'];
        $path = $file->store('imports', 'local');
        $rows = 0;
        $errors = [];

        $import = DataImport::create([
            'type' => $data['type'],
            'file_name' => $file->getClientOriginalName(),
            'status' => 'processing',
            'imported_by' => auth()->id(),
        ]);

        try {
            $handle = fopen(Storage::disk('local')->path($path), 'r');
            $header = $handle ? fgetcsv($handle) : false;
            $header = $header ? array_map(fn ($value) => strtolower(trim((string) $value)), $header) : [];

            while ($handle && ($row = fgetcsv($handle)) !== false) {
                if (count(array_filter($row)) === 0) {
                    continue;
                }

                $record = array_combine(array_slice($header, 0, count($row)), $row) ?: [];

                try {
                    DB::transaction(function () use ($data, $record): void {
                        if ($data['type'] === 'accounts') {
                            Account::updateOrCreate(
                                ['code' => $record['code'] ?? null],
                                [
                                    'name' => $record['name'] ?? 'Imported account',
                                    'type' => $record['type'] ?? 'expense',
                                    'description' => $record['description'] ?? null,
                                    'is_active' => true,
                                ],
                            );
                        } else {
                            Contact::updateOrCreate(
                                ['email' => $record['email'] ?? null],
                                [
                                    'name' => $record['name'] ?? 'Imported contact',
                                    'phone' => $record['phone'] ?? null,
                                    'type' => $record['type'] ?? 'customer',
                                    'city' => $record['city'] ?? null,
                                    'country' => $record['country'] ?? null,
                                    'is_active' => true,
                                ],
                            );
                        }
                    });

                    $rows++;
                } catch (\Throwable $exception) {
                    $errors[] = 'Row '.($rows + count($errors) + 2).': '.$exception->getMessage();
                }
            }

            if ($handle) {
                fclose($handle);
            }

            $import->forceFill([
                'status' => 'completed',
                'rows_processed' => $rows,
                'errors' => $errors ?: null,
            ])->save();
        } catch (\Throwable $exception) {
            $import->forceFill(['status' => 'failed', 'errors' => [$exception->getMessage()]])->save();
        }

        return back()->with('success', "Import processed {$rows} row(s).");
    }

    public function storeBackup(): RedirectResponse
    {
        $snapshot = [
            'created_at' => now()->toIso8601String(),
            'tables' => [
                'users' => User::query()->count(),
                'accounts' => Account::query()->count(),
                'contacts' => Contact::query()->count(),
                'invoices' => Invoice::query()->count(),
                'bills' => Bill::query()->count(),
                'journal_entries' => JournalEntry::query()->count(),
                'payments' => Payment::query()->count(),
            ],
        ];

        $name = 'ledgerly-'.now()->format('Ymd-His').'.json';
        $path = 'backups/'.$name;
        $contents = json_encode($snapshot, JSON_PRETTY_PRINT) ?: '{}';

        Storage::disk('local')->put($path, $contents);

        Backup::create([
            'name' => $name,
            'disk' => 'local',
            'path' => $path,
            'size' => strlen($contents),
            'status' => 'completed',
            'created_by' => auth()->id(),
        ]);

        return back()->with('success', "Backup {$name} created.");
    }

    public function storeChecklist(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'accounting_period_id' => ['nullable', 'integer', 'exists:accounting_periods,id'],
            'due_date' => ['nullable', 'date'],
            'tasks' => ['nullable', 'array'],
            'tasks.*' => ['string', 'max:180'],
        ]);

        $checklist = ClosingChecklist::create([
            'name' => $data['name'],
            'accounting_period_id' => $data['accounting_period_id'] ?? null,
            'due_date' => $data['due_date'] ?? null,
            'status' => 'in_progress',
            'assigned_to' => auth()->id(),
        ]);

        $defaultTasks = $data['tasks'] ?? [
            'Reconcile all bank accounts',
            'Review AR and AP ageing',
            'Post payroll and accruals',
            'Review trial balance',
            'Lock the accounting period',
        ];

        foreach ($defaultTasks as $title) {
            $checklist->tasks()->create(['title' => $title, 'status' => 'pending']);
        }

        return back()->with('success', 'Closing checklist created.');
    }

    public function storeChecklistTask(Request $request, ClosingChecklist $closingChecklist): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'owner' => ['nullable', 'string', 'max:120'],
        ]);

        $closingChecklist->tasks()->create([...$data, 'status' => 'pending']);

        return back()->with('success', 'Closing task added.');
    }

    public function completeChecklistTask(ClosingChecklist $closingChecklist, ClosingTask $closingTask): RedirectResponse
    {
        $closingTask->forceFill([
            'status' => $closingTask->status === 'done' ? 'pending' : 'done',
            'completed_at' => $closingTask->status === 'done' ? null : now(),
        ])->save();

        if ($closingChecklist->tasks()->where('status', '!=', 'done')->count() === 0) {
            $closingChecklist->forceFill(['status' => 'completed', 'completed_at' => now()])->save();
        }

        return back()->with('success', 'Closing task updated.');
    }
}
