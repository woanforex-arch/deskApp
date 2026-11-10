<?php

namespace App\Enums;

enum JournalEntryStatus: string
{
    case Draft = 'draft';
    case Posted = 'posted';
    case Void = 'void';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Posted => 'Posted',
            self::Void => 'Void',
        };
    }

    public function isPosted(): bool
    {
        return $this === self::Posted;
    }
}
