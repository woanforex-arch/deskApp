<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DataImport extends Model
{
    protected $fillable = ['type', 'file_name', 'status', 'rows_processed', 'errors', 'imported_by'];

    protected function casts(): array
    {
        return ['errors' => 'array'];
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }
}
