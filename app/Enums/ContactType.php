<?php

namespace App\Enums;

enum ContactType: string
{
    case Customer = 'customer';
    case Vendor = 'vendor';
    case Both = 'both';

    public function label(): string
    {
        return match ($this) {
            self::Customer => 'Customer',
            self::Vendor => 'Vendor',
            self::Both => 'Customer & vendor',
        };
    }

    public function isCustomer(): bool
    {
        return $this === self::Customer || $this === self::Both;
    }
}
