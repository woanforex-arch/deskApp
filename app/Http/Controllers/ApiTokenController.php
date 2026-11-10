<?php

namespace App\Http\Controllers;

use App\Http\Requests\Web\StoreApiTokenRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ApiTokenController extends Controller
{
    public function index(Request $request): Response
    {
        $tokens = $request->user()
            ->tokens()
            ->latest()
            ->get()
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'abilities' => $token->abilities,
                'last_used_at' => $token->last_used_at?->diffForHumans(),
                'created_at' => $token->created_at?->toFormattedDateString(),
            ]);

        return Inertia::render('ApiTokens/Index', [
            'tokens' => $tokens,
            'apiBaseUrl' => url('/api/v1'),
        ]);
    }

    public function store(StoreApiTokenRequest $request): RedirectResponse
    {
        $token = $request->user()->createToken(
            $request->string('name')->toString(),
            $request->input('abilities'),
        );

        return back()
            ->with('plain_text_token', $token->plainTextToken)
            ->with('success', 'API token created. Copy it now — it will not be shown again.');
    }

    public function destroy(Request $request, int $token): RedirectResponse
    {
        $request->user()->tokens()->findOrFail($token)->delete();

        return back()->with('success', 'API token revoked.');
    }
}
