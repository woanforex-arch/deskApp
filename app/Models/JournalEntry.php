<?php

namespace App\Models;

use App\Enums\JournalEntryStatus;
use Carbon\CarbonInterface;
use Database\Factories\JournalEntryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

class JournalEntry extends Model
{
    /** @use HasFactory<JournalEntryFactory> */
    use HasFactory;

    protected $fillable = [
        'reference',
        'entry_date',
        'memo',
        'status',
        'posted_at',
        'created_by',
        'source_type',
        'source_id',
        'company_id',
        'branch_id',
        'department_id',
        'cost_center_id',
        'project_id',
        'currency',
        'exchange_rate',
        'approved_by',
        'approved_at',
        'voided_at',
        'reversal_of_id',
        'metadata',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'status' => JournalEntryStatus::class,
            'posted_at' => 'datetime',
            'approved_at' => 'datetime',
            'voided_at' => 'datetime',
            'exchange_rate' => 'decimal:6',
            'metadata' => 'array',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(JournalLine::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function source(): MorphTo
    {
        return $this->morphTo();
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function reversalOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversal_of_id');
    }

    public function approvals()
    {
        return $this->morphMany(ApprovalRequest::class, 'approvable');
    }

    public function scopePosted($query)
    {
        return $query->where('status', JournalEntryStatus::Posted->value);
    }

    public function totalDebit(): float
    {
        return round((float) ($this->attributes['total_debit'] ?? $this->lines()->sum('debit')), 2);
    }

    public function totalCredit(): float
    {
        return round((float) ($this->attributes['total_credit'] ?? $this->lines()->sum('credit')), 2);
    }

    public function isBalanced(): bool
    {
        return $this->totalDebit() > 0
            && abs($this->totalDebit() - $this->totalCredit()) < 0.005;
    }

    public static function generateReference(CarbonInterface|string|null $date = null): string
    {
        $date = $date ? Carbon::parse($date) : now();
        $prefix = 'JE-'.$date->format('Ym').'-';
        $latest = static::query()
            ->where('reference', 'like', $prefix.'%')
            ->orderByDesc('reference')
            ->value('reference');

        $sequence = $latest ? ((int) substr($latest, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    protected static function booted(): void
    {
        static::saving(function (self $entry): void {
            if ($entry->status === JournalEntryStatus::Posted) {
                $entry->posted_at ??= now();
            } else {
                $entry->posted_at = null;
            }
        });
    }
}
