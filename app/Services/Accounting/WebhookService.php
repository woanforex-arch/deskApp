<?php

namespace App\Services\Accounting;

use App\Models\Webhook;
use App\Models\WebhookDelivery;
use Illuminate\Support\Facades\Http;
use Throwable;

class WebhookService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function dispatchEvent(string $event, array $payload): void
    {
        $hooks = Webhook::query()
            ->where('is_active', true)
            ->where(fn ($query) => $query->where('event', $event)->orWhere('event', '*'))
            ->get();

        foreach ($hooks as $hook) {
            $body = [
                'event' => $event,
                'occurred_at' => now()->toIso8601String(),
                'data' => $payload,
            ];

            $status = null;
            $response = null;

            try {
                $request = Http::timeout(4)->acceptJson();
                if ($hook->secret) {
                    $request = $request->withHeaders([
                        'X-Ledgerly-Signature' => hash_hmac('sha256', json_encode($body), $hook->secret),
                    ]);
                }

                $result = $request->post($hook->url, $body);
                $status = $result->status();
                $response = mb_substr($result->body(), 0, 1000);
            } catch (Throwable $exception) {
                $response = $exception->getMessage();
            }

            WebhookDelivery::create([
                'webhook_id' => $hook->id,
                'event' => $event,
                'payload' => $body,
                'response_status' => $status,
                'response_body' => $response,
                'delivered_at' => now(),
            ]);

            $hook->forceFill(['last_triggered_at' => now()])->save();
        }
    }
}
