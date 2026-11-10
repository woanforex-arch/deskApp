<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Bill;
use App\Models\Invoice;
use App\Models\JournalEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    private const ATTACHABLES = [
        'invoice' => Invoice::class,
        'bill' => Bill::class,
        'journal' => JournalEntry::class,
    ];

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'ocr_status' => ['nullable', 'string', 'max:30'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $attachments = Attachment::query()
            ->with('uploader:id,name')
            ->when($request->filled('ocr_status'), fn ($query) => $query->where('ocr_status', $request->string('ocr_status')))
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 50))
            ->through(fn (Attachment $attachment) => $this->present($attachment));

        return response()->json($attachments);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'attachable_type' => ['required', Rule::in(array_keys(self::ATTACHABLES))],
            'attachable_id' => ['required', 'integer'],
            'file' => ['required', 'file', 'max:10240'],
        ]);

        $class = self::ATTACHABLES[$data['attachable_type']];
        abort_unless($class::query()->whereKey($data['attachable_id'])->exists(), 422, 'The selected document does not exist.');

        $file = $data['file'];
        $path = $file->store('attachments', 'local');
        $mime = $file->getClientMimeType();
        $ocrText = null;
        $ocrStatus = 'pending';

        if (str_starts_with((string) $mime, 'text/') || in_array($file->getClientOriginalExtension(), ['txt', 'csv'], true)) {
            $ocrText = mb_substr((string) Storage::disk('local')->get($path), 0, 20000);
            $ocrStatus = 'processed';
        }

        $attachment = Attachment::create([
            'attachable_type' => $class,
            'attachable_id' => $data['attachable_id'],
            'name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $mime,
            'size' => $file->getSize(),
            'ocr_text' => $ocrText,
            'ocr_status' => $ocrStatus,
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->present($attachment->refresh())], 201);
    }

    public function show(Attachment $document): JsonResponse
    {
        $document->load('uploader:id,name');

        return response()->json(['data' => $this->present($document) + [
            'file_path' => $document->file_path,
        ]]);
    }

    public function update(Request $request, Attachment $document): JsonResponse
    {
        $data = $request->validate([
            'ocr_text' => ['nullable', 'string', 'max:20000'],
            'ocr_status' => ['sometimes', 'required', Rule::in(['pending', 'processed', 'failed'])],
        ]);

        $document->forceFill($data)->save();

        return response()->json(['data' => $this->present($document->refresh()), 'message' => 'OCR result saved.']);
    }

    public function destroy(Attachment $document): JsonResponse
    {
        Storage::disk('local')->delete($document->file_path);
        $document->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Attachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'name' => $attachment->name,
            'attachable_type' => class_basename($attachment->attachable_type),
            'attachable_id' => $attachment->attachable_id,
            'mime_type' => $attachment->mime_type,
            'size' => (int) $attachment->size,
            'ocr_status' => $attachment->ocr_status,
            'ocr_text' => $attachment->ocr_text,
            'uploader' => $attachment->uploader?->name,
            'created_at' => $attachment->created_at?->toIso8601String(),
        ];
    }
}
