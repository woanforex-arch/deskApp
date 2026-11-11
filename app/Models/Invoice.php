<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use Carbon\CarbonInterface;
use Database\Factories\InvoiceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Invoice extends Model
{
    /** @use HasFactory<InvoiceFactory> */
    use HasFactory;

    protected $fillable = [
        'contact_id',
        'company_id',
        'branch_id',
        'project_id',
        'number',
        'issue_date',
        'due_date',
        'ship_to',
        'salesperson',
        'ship_via',
        'promised_date',
        'delivery_status',
        'sales_type',
        'status',
        'currency',
        'exchange_rate',
        'base_total',
        'approval_status',
        'journal_entry_id',
        'recurring_source',
        'subtotal',
        'tax_total',
        'total',
        'amount_paid',
        'notes',
        'terms',
        'sent_at',
        'paid_at',
        'last_reminded_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'due_date' => 'date',
            'promised_date' => 'date',
            'status' => InvoiceStatus::class,
            'exchange_rate' => 'decimal:6',
            'subtotal' => 'decimal:2',
            'tax_total' => 'decimal:2',
            'total' => 'decimal:2',
            'base_total' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'sent_at' => 'datetime',
            'paid_at' => 'datetime',
            'last_reminded_at' => 'datetime',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function creditNotes(): HasMany
    {
        return $this->hasMany(CreditNote::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function approvals()
    {
        return $this->morphMany(ApprovalRequest::class, 'approvable');
    }

    public function revenueSchedule()
    {
        return $this->hasOne(RevenueSchedule::class);
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', [InvoiceStatus::Sent->value, InvoiceStatus::Overdue->value]);
    }

    public function scopeOverdue($query)
    {
        return $query->where(function ($query): void {
            $query->where('status', InvoiceStatus::Overdue->value)
                ->orWhere(function ($query): void {
                    $query->where('status', InvoiceStatus::Sent->value)
                        ->whereDate('due_date', '<', today()->toDateString());
                });
        });
    }

    public function balanceDue(): float
    {
        return round((float) $this->total - (float) $this->amount_paid, 2);
    }

    public function isOverdue(): bool
    {
        if ($this->status === InvoiceStatus::Overdue) {
            return true;
        }

        return $this->status === InvoiceStatus::Sent
            && $this->due_date !== null
            && $this->due_date->isBefore(today())
            && $this->balanceDue() > 0;
    }

    public function markAsSent(): void
    {
        $this->forceFill([
            'status' => InvoiceStatus::Sent,
            'sent_at' => $this->sent_at ?? now(),
        ])->save();
    }

    public function recalculateTotals(): void
    {
        $subtotal = round((float) $this->items()->sum('amount'), 2);
        $taxTotal = round((float) $this->items()->sum('tax_amount'), 2);

        $this->forceFill([
            'subtotal' => $subtotal,
            'tax_total' => $taxTotal,
            'total' => round($subtotal + $taxTotal, 2),
        ])->saveQuietly();

        $this->refreshPaymentTotals();
    }

    public function refreshPaymentTotals(): void
    {
        $paid = round((float) $this->payments()->sum('amount'), 2);
        $total = (float) $this->total;
        $status = $this->status;
        $paidAt = $this->paid_at;

        if (! in_array($status, [InvoiceStatus::Draft, InvoiceStatus::Void], true) && $total > 0 && $paid >= $total) {
            $status = InvoiceStatus::Paid;
            $paidAt ??= now();
        } elseif ($status === InvoiceStatus::Paid && $paid < $total) {
            $status = InvoiceStatus::Sent;
            $paidAt = null;
        }

        $this->forceFill([
            'amount_paid' => $paid,
            'status' => $status,
            'paid_at' => $paidAt,
        ])->saveQuietly();
    }

    public static function generateNumber(CarbonInterface|string|null $date = null): string
    {
        $date = $date ? Carbon::parse($date) : now();
        $prefix = 'INV-'.$date->format('Y').'-';
        $latest = static::query()
            ->where('number', 'like', $prefix.'%')
            ->orderByDesc('number')
            ->value('number');

        $sequence = $latest ? ((int) substr($latest, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
