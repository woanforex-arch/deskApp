<?php

use App\Models\User;

it('registers a user and returns a bearer token', function () {
    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Pest Tester',
        'email' => 'pest@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'device_name' => 'pest-suite',
    ]);

    $response
        ->assertCreated()
        ->assertJsonPath('token_type', 'Bearer')
        ->assertJsonPath('user.email', 'pest@example.com')
        ->assertJsonStructure([
            'message',
            'user' => ['id', 'name', 'email', 'created_at'],
            'token',
            'token_type',
        ]);

    expect($response->json('token'))->toBeString()->not->toBeEmpty();

    $this->assertDatabaseHas('users', ['email' => 'pest@example.com']);
    $this->assertDatabaseHas('personal_access_tokens', ['name' => 'pest-suite']);
});

it('rejects registration with a duplicate email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Duplicate',
        'email' => 'taken@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('authenticates with valid credentials and returns a token', function () {
    $user = User::factory()->create([
        'email' => 'login@example.com',
        'password' => 'secret-password',
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'login@example.com',
        'password' => 'secret-password',
        'device_name' => 'pest-login',
    ]);

    $response
        ->assertOk()
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonPath('token_type', 'Bearer');

    expect($response->json('token'))->toBeString()->not->toBeEmpty();
});

it('rejects invalid credentials', function () {
    User::factory()->create([
        'email' => 'login@example.com',
        'password' => 'secret-password',
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'login@example.com',
        'password' => 'wrong-password',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('returns the authenticated user for a bearer token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('pest')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.email', $user->email);
});

it('revokes the current token on logout', function () {
    $user = User::factory()->create();
    $token = $user->createToken('pest')->plainTextToken;

    expect($user->tokens()->count())->toBe(1);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/v1/auth/logout')
        ->assertOk();

    expect($user->tokens()->count())->toBe(0);
});

it('protects accounting endpoints from unauthenticated requests', function () {
    $this->getJson('/api/v1/accounts')->assertUnauthorized();
    $this->getJson('/api/v1/invoices')->assertUnauthorized();
    $this->getJson('/api/v1/reports/trial-balance')->assertUnauthorized();
});

it('exposes api metadata without authentication', function () {
    $this->getJson('/api/v1')
        ->assertOk()
        ->assertJsonPath('version', 'v1')
        ->assertJsonPath('authentication', 'Bearer token (Laravel Sanctum)');
});
