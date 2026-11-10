<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Bill extends Model
{
    protected $fillable = [
        'contact_id', 'company_id', 'branch_id', 'project_id', 'number', 'bill_date',
        'due_date', 'status', 'currency', 'exchange_rate', 'subtotal', 'tax_total',
        'total', 'amount_paid', 'notes', 'terms', 'approved_by', 'approved_at',
        'created_by', 'journal_entry_id',
    ];

    protected function casts(): array
    {
        return [
            'bill_date' => 'date',
            'due_date' => 'date',
            'exchange_rate' => 'decimal:6',
            'subtotal' => 'decimal:2',
            'tax_total' => 'decimal:2',
            'total' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BillItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(VendorPayment::class);
    }

    public function approvals()
    {
        return $this->morphMany(ApprovalRequest::class, 'approvable');
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', ['approved', 'partial', 'pending_approval']);
    }

    public function balanceDue(): float
    {
        return round((float) $this->total - (float) $this->amount_paid, 2);
    }

    public function isOverdue(): bool
    {
        return $this->due_date !== null && $this->due_date->isBefore(today()) && $this->balanceDue() > 0
            && in_array($this->status, ['approved', 'partial'], true);
    }

    public function recalculateTotals(): void
    {
        $subtotal = round((float) $this->items()->sum('amount'), 2);
        $tax = round((float) $this->items()->sum('tax_amount'), 2);
        $paid = round((float) $this->payments()->sum('amount'), 2);
        $total = round($subtotal + $tax, 2);

        $status = $this->status;
        if (in_array($status, ['approved', 'partial', 'paid'], true)) {
            if ($total > 0 && $paid >= $total - 0.005) {
                $status = 'paid';
            } elseif ($paid > 0) {
                $status = 'partial';
            } else {
                $status = 'approved';
            }
        }

        $this->forceFill([
            'subtotal' => $subtotal,
            'tax_total' => $tax,
            'total' => $total,
            'amount_paid' => $paid,
            'status' => $status,
        ])->saveQuietly();
    }

    public static function generateNumber(CarbonInterface|string|null $date = null): string
    {
        $date = $date ? Carbon::parse($date) : now();
        $prefix = 'BILL-'.$date->format('Y').'-';
        $latest = static::query()
            ->where('number', 'like', $prefix.'%')
            ->orderByDesc('number')
            ->value('number');

        $sequence = $latest ? ((int) substr($latest, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
