<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PlatformController extends Controller
{
    public function __construct(private readonly AuditService $audit) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => [
                'integrations' => Integration::query()->orderBy('name')->get()
                    ->map(fn (Integration $integration) => $this->presentIntegration($integration)),
                'webhooks' => Webhook::query()->withCount('deliveries')->orderBy('name')->get()
                    ->map(fn (Webhook $webhook) => $this->presentWebhook($webhook)),
                'deliveries' => WebhookDelivery::query()->with('webhook:id,name')->orderByDesc('id')->limit(50)->get()
                    ->map(fn (WebhookDelivery $delivery) => [
                        'id' => $delivery->id,
                        'webhook' => $delivery->webhook?->name,
                        'event' => $delivery->event,
                        'response_status' => $delivery->response_status,
                        'delivered_at' => $delivery->delivered_at?->toIso8601String(),
                    ]),
                'scheduled_reports' => ScheduledReport::query()->orderBy('name')->get()
                    ->map(fn (ScheduledReport $report) => $this->presentScheduledReport($report)),
                'imports' => DataImport::query()->with('importer:id,name')->orderByDesc('id')->limit(50)->get()
                    ->map(fn (DataImport $import) => $this->presentImport($import)),
                'backups' => Backup::query()->with('creator:id,name')->orderByDesc('id')->limit(50)->get()
                    ->map(fn (Backup $backup) => $this->presentBackup($backup)),
                'checklists' => ClosingChecklist::query()->with(['period:id,name', 'tasks'])->orderByDesc('id')->limit(50)->get()
                    ->map(fn (ClosingChecklist $checklist) => $this->presentChecklist($checklist)),
                'stats' => [
                    'integrations' => Integration::query()->where('status', 'connected')->count(),
                    'webhooks' => Webhook::query()->where('is_active', true)->count(),
                    'scheduled' => ScheduledReport::query()->where('is_active', true)->count(),
                    'imports' => DataImport::query()->count(),
                    'backups' => Backup::query()->count(),
                    'checklists' => ClosingChecklist::query()->where('status', 'in_progress')->count(),
                ],
            ],
        ]);
    }

    // --- Integrations ---

    public function storeIntegration(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in(['erp', 'crm', 'bank', 'payroll', 'tax', 'ecommerce', 'custom'])],
            'provider' => ['nullable', 'string', 'max:80'],
            'endpoint' => ['nullable', 'url', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:255'],
        ]);

        $integration = Integration::create([
            'name' => $data['name'],
            'type' => $data['type'],
            'provider' => $data['provider'] ?? null,
            'config' => array_filter([
                'endpoint' => $data['endpoint'] ?? null,
                'api_key' => $data['api_key'] ?? null,
            ]),
            'status' => 'disconnected',
        ]);

        return response()->json(['data' => $this->presentIntegration($integration->refresh())], 201);
    }

    public function syncIntegration(Request $request, Integration $integration): JsonResponse
    {
        $integration->forceFill([
            'status' => 'connected',
            'last_synced_at' => now(),
        ])->save();

        $this->audit->log('integration.synced', $integration, [], ['status' => 'connected'], "Synced {$integration->name}");

        return response()->json(['data' => $this->presentIntegration($integration->refresh()), 'message' => 'Integration synced.']);
    }

    // --- Webhooks ---

    public function storeWebhook(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'event' => ['required', 'string', 'max:60'],
            'url' => ['required', 'url', 'max:255'],
            'secret' => ['nullable', 'string', 'max:255'],
        ]);

        $webhook = Webhook::create([...$data, 'is_active' => true]);

        return response()->json(['data' => $this->presentWebhook($webhook->refresh())], 201);
    }

    public function testWebhook(Request $request, Webhook $webhook): JsonResponse
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

        $delivery = WebhookDelivery::create([
            'webhook_id' => $webhook->id,
            'event' => $webhook->event,
            'payload' => $payload,
            'response_status' => $status,
            'response_body' => $body,
            'delivered_at' => now(),
        ]);

        $webhook->forceFill(['last_triggered_at' => now()])->save();

        return response()->json([
            'data' => [
                'delivery_id' => $delivery->id,
                'response_status' => $status,
                'last_triggered_at' => $webhook->refresh()->last_triggered_at?->toIso8601String(),
            ],
            'message' => 'Webhook test delivered and logged.',
        ]);
    }

    // --- Scheduled reports ---

    public function storeScheduledReport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'report' => ['required', 'string', 'max:60'],
            'recipients' => ['required', 'string', 'max:255'],
            'frequency' => ['required', Rule::in(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])],
        ]);

        $report = ScheduledReport::create([
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

        return response()->json(['data' => $this->presentScheduledReport($report->refresh())], 201);
    }

    // --- Imports ---

    public function storeImport(Request $request): JsonResponse
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
            'imported_by' => $request->user()->id,
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

        return response()->json(['data' => $this->presentImport($import->refresh()), 'message' => "Import processed {$rows} row(s)."]);
    }

    // --- Backups ---

    public function storeBackup(Request $request): JsonResponse
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

        $backup = Backup::create([
            'name' => $name,
            'disk' => 'local',
            'path' => $path,
            'size' => strlen($contents),
            'status' => 'completed',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->presentBackup($backup->refresh()), 'message' => "Backup {$name} created."], 201);
    }

    // --- Closing checklists ---

    public function storeChecklist(Request $request): JsonResponse
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
            'assigned_to' => $request->user()->id,
        ]);

        $titles = $data['tasks'] ?? [
            'Reconcile all bank accounts',
            'Review AR and AP ageing',
            'Post payroll and accruals',
            'Review trial balance',
            'Lock the accounting period',
        ];

        foreach ($titles as $title) {
            $checklist->tasks()->create(['title' => $title, 'status' => 'pending']);
        }

        return response()->json(['data' => $this->presentChecklist($checklist->refresh()->load(['period:id,name', 'tasks']))], 201);
    }

    public function storeChecklistTask(Request $request, ClosingChecklist $closingChecklist): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:180'],
            'owner' => ['nullable', 'string', 'max:120'],
        ]);

        $closingChecklist->tasks()->create([...$data, 'status' => 'pending']);

        return response()->json([
            'data' => $this->presentChecklist($closingChecklist->refresh()->load(['period:id,name', 'tasks'])),
            'message' => 'Closing task added.',
        ], 201);
    }

    public function completeChecklistTask(ClosingChecklist $closingChecklist, ClosingTask $closingTask): JsonResponse
    {
        $done = $closingTask->status !== 'done';

        $closingTask->forceFill([
            'status' => $done ? 'done' : 'pending',
            'completed_at' => $done ? now() : null,
        ])->save();

        if ($closingChecklist->tasks()->where('status', '!=', 'done')->count() === 0) {
            $closingChecklist->forceFill(['status' => 'completed', 'completed_at' => now()])->save();
        }

        return response()->json([
            'data' => [
                'task' => [
                    'id' => $closingTask->id,
                    'title' => $closingTask->title,
                    'status' => $closingTask->status,
                    'completed_at' => $closingTask->completed_at?->toIso8601String(),
                ],
                'checklist' => $this->presentChecklist($closingChecklist->refresh()->load(['period:id,name', 'tasks'])),
            ],
            'message' => 'Closing task updated.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function presentIntegration(Integration $integration): array
    {
        return [
            'id' => $integration->id,
            'name' => $integration->name,
            'type' => $integration->type,
            'provider' => $integration->provider,
            'status' => $integration->status,
            'last_synced_at' => $integration->last_synced_at?->toIso8601String(),
            'config' => $integration->config,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentWebhook(Webhook $webhook): array
    {
        return [
            'id' => $webhook->id,
            'name' => $webhook->name,
            'event' => $webhook->event,
            'url' => $webhook->url,
            'is_active' => $webhook->is_active,
            'last_triggered_at' => $webhook->last_triggered_at?->toIso8601String(),
            'deliveries_count' => $webhook->deliveries_count ?? $webhook->deliveries()->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentScheduledReport(ScheduledReport $report): array
    {
        return [
            'id' => $report->id,
            'name' => $report->name,
            'report' => $report->report,
            'recipients' => $report->recipients,
            'frequency' => $report->frequency,
            'next_run_at' => $report->next_run_at?->toIso8601String(),
            'last_sent_at' => $report->last_sent_at?->toIso8601String(),
            'is_active' => $report->is_active,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentImport(DataImport $import): array
    {
        return [
            'id' => $import->id,
            'type' => $import->type,
            'file_name' => $import->file_name,
            'status' => $import->status,
            'rows_processed' => $import->rows_processed,
            'errors' => $import->errors,
            'importer' => $import->importer?->name,
            'created_at' => $import->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentBackup(Backup $backup): array
    {
        return [
            'id' => $backup->id,
            'name' => $backup->name,
            'disk' => $backup->disk,
            'path' => $backup->path,
            'size' => (int) $backup->size,
            'status' => $backup->status,
            'creator' => $backup->creator?->name,
            'created_at' => $backup->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentChecklist(ClosingChecklist $checklist): array
    {
        return [
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
        ];
    }
}
