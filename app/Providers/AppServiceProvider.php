<?php

namespace App\Providers;

use App\Models\Account;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\Payment;
use App\Models\User;
use App\Observers\DashboardCacheObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->id ?: $request->ip()));

        Gate::define('write', fn (User $user) => $user->is_active && $user->canWrite());
        Gate::define('approve', fn (User $user) => $user->is_active && $user->canApprove());
        Gate::define('admin', fn (User $user) => $user->is_active && $user->isAdmin());

        Invoice::observe(DashboardCacheObserver::class);
        Payment::observe(DashboardCacheObserver::class);
        JournalEntry::observe(DashboardCacheObserver::class);
        JournalLine::observe(DashboardCacheObserver::class);
        Account::observe(DashboardCacheObserver::class);
    }
}
