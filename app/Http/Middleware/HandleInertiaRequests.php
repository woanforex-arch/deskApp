<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Services\Accounting\CurrencyService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'appName' => config('app.name'),
            'auth' => [
                'user' => $request->user()
                    ? [
                        'id' => $request->user()->id,
                        'name' => $request->user()->name,
                        'email' => $request->user()->email,
                        'role' => $request->user()->role,
                        'is_admin' => $request->user()->isAdmin(),
                        'can_approve' => $request->user()->canApprove(),
                        'can_write' => $request->user()->canWrite(),
                    ]
                    : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'plain_text_token' => fn () => $request->session()->get('plain_text_token'),
            ],
            'money' => fn () => app(CurrencyService::class)->displayOptions(),
            'company' => fn () => $this->companyIdentity(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function companyIdentity(): array
    {
        $company = Company::primary();

        if ($company === null) {
            return [];
        }

        return [
            'name' => $company->name,
            'code' => $company->code,
            'trading_name' => $company->trading_name,
            'business_type' => $company->business_type,
            'business_email' => $company->business_email,
            'website' => $company->website,
            'address' => $company->physical_address,
            'postal_address' => $company->postal_address,
            'tax_number' => $company->tax_number,
            'registration_number' => $company->registration_number,
            'base_currency' => $company->base_currency,
            'logo_url' => $company->logoUrl(),
        ];
    }
}
