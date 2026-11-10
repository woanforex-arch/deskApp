<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Models\Bill;
use App\Models\Invoice;
use App\Models\JournalEntry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AttachmentController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'ocr_status' => ['nullable', 'string', 'max:30'],
        ]);

        $attachments = Attachment::query()
            ->with('uploader:id,name')
            ->when($filters['ocr_status'] ?? null, fn ($query, $status) => $query->where('ocr_status', $status))
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (Attachment $attachment) => [
                'id' => $attachment->id,
                'name' => $attachment->name,
                'attachable' => class_basename($attachment->attachable_type).' #'.$attachment->attachable_id,
                'mime_type' => $attachment->mime_type,
                'size' => (int) $attachment->size,
                'ocr_status' => $attachment->ocr_status,
                'ocr_text' => $attachment->ocr_text,
                'uploader' => $attachment->uploader?->name,
                'created_at' => $attachment->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Documents/Index', [
            'attachments' => $attachments,
            'filters' => ['ocr_status' => $filters['ocr_status'] ?? null],
            'stats' => [
                'total' => Attachment::query()->count(),
                'pending' => Attachment::query()->where('ocr_status', 'pending')->count(),
                'processed' => Attachment::query()->where('ocr_status', 'processed')->count(),
                'size' => (int) Attachment::query()->sum('size'),
            ],
            'statuses' => ['pending', 'processed', 'failed'],
            'attachableTypes' => [
                'invoice' => Invoice::class,
                'bill' => Bill::class,
                'journal' => JournalEntry::class,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'attachable_type' => ['required', Rule::in(['invoice', 'bill', 'journal'])],
            'attachable_id' => ['required', 'integer'],
            'file' => ['required', 'file', 'max:10240'],
        ]);

        $map = [
            'invoice' => Invoice::class,
            'bill' => Bill::class,
            'journal' => JournalEntry::class,
        ];

        $class = $map[$data['attachable_type']];
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

        Attachment::create([
            'attachable_type' => $class,
            'attachable_id' => $data['attachable_id'],
            'name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $mime,
            'size' => $file->getSize(),
            'ocr_text' => $ocrText,
            'ocr_status' => $ocrStatus,
            'uploaded_by' => auth()->id(),
        ]);

        return back()->with('success', 'Document attached.');
    }

    public function updateOcr(Request $request, Attachment $attachment): RedirectResponse
    {
        $data = $request->validate([
            'ocr_text' => ['nullable', 'string', 'max:20000'],
            'ocr_status' => ['required', Rule::in(['pending', 'processed', 'failed'])],
        ]);

        $attachment->forceFill($data)->save();

        return back()->with('success', 'OCR result saved.');
    }

    public function destroy(Attachment $attachment): RedirectResponse
    {
        Storage::disk('local')->delete($attachment->file_path);
        $attachment->delete();

        return back()->with('success', 'Attachment removed.');
    }
}
