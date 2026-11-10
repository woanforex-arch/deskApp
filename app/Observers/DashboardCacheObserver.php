<?php

namespace App\Observers;

use Illuminate\Support\Facades\Cache;

class DashboardCacheObserver
{
    public function saved(): void
    {
        $this->forget();
    }

    public function deleted(): void
    {
        $this->forget();
    }

    private function forget(): void
    {
        Cache::forget('dashboard.metrics');
    }
}
