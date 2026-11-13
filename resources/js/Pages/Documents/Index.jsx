import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowUpTrayIcon, DocumentMagnifyingGlassIcon, DocumentTextIcon, PaperClipIcon, TrashIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput, Textarea } from '../../Components/FormControls';
import { formatDateTime } from '../../lib/format';

function bytes(value) {
    const size = Number(value ?? 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsIndex({ attachments, filters, stats, statuses, attachableTypes }) {
    const page = usePage();
    const canWrite = page.props.auth?.user?.can_write;
    const [open, setOpen] = useState(false);
    const [ocrFor, setOcrFor] = useState(null);

    const form = useForm({ attachable_type: 'invoice', attachable_id: '', file: null });
    const ocrForm = useForm({ ocr_text: '', ocr_status: 'processed' });

    const submit = (event) => {
        event.preventDefault();
        form.post('/documents', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => { setOpen(false); form.reset(); },
        });
    };

    const openOcr = (attachment) => {
        setOcrFor(attachment);
        ocrForm.setData({ ocr_text: attachment.ocr_text ?? '', ocr_status: attachment.ocr_status === 'pending' ? 'processed' : attachment.ocr_status });
    };

    const submitOcr = (event) => {
        event.preventDefault();
        ocrForm.post(`/documents/${ocrFor.id}/ocr`, { preserveScroll: true, onSuccess: () => { setOcrFor(null); ocrForm.reset(); } });
    };

    const remove = (attachment) => {
        if (confirm(`Delete ${attachment.name}?`)) {
            router.delete(`/documents/${attachment.id}`, { preserveScroll: true });
        }
    };

    const applyFilter = (status) => {
        router.get('/documents', status ? { ocr_status: status } : {}, { preserveState: true, preserveScroll: true, replace: true });
    };

    return (
        <AppLayout>
            <Head title="Documents" />

            <div className="space-y-6">
                <PageHeader eyebrow="Controls" title="Documents & OCR" description="Attach source documents to invoices, bills and journals, and capture OCR text for review.">
                    {canWrite && (
                        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                            <ArrowUpTrayIcon className="h-4 w-4" />
                            Upload document
                        </button>
                    )}
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Documents" value={stats.total} hint="Attached to transactions" icon={PaperClipIcon} accent="brand" />
                    <StatCard label="Pending OCR" value={stats.pending} hint="Awaiting processing" icon={DocumentMagnifyingGlassIcon} accent="amber" />
                    <StatCard label="Processed" value={stats.processed} hint="OCR text captured" icon={DocumentTextIcon} accent="emerald" />
                    <StatCard label="Storage" value={bytes(stats.size)} hint="Total attachment size" icon={PaperClipIcon} accent="sky" />
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="font-display text-base font-semibold text-slate-900">Document register</h2>
                            <p className="mt-0.5 text-xs text-slate-500">Text and CSV files are auto-processed; other formats await OCR.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => applyFilter(null)} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${!filters.ocr_status ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}>All</button>
                            {statuses.map((status) => (
                                <button key={status} type="button" onClick={() => applyFilter(status)} className={`rounded-xl px-3 py-2 text-sm font-semibold capitalize transition ${filters.ocr_status === status ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}>{status}</button>
                            ))}
                        </div>
                    </div>

                    {attachments.length === 0 ? (
                        <EmptyState title="No documents" description="Upload a source document to keep an audit trail." icon={PaperClipIcon} />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-sm">
                                <thead>
                                    <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-5 py-3">Document</th>
                                        <th className="px-5 py-3">Attached to</th>
                                        <th className="px-5 py-3">Type</th>
                                        <th className="px-5 py-3 text-right">Size</th>
                                        <th className="px-5 py-3">OCR</th>
                                        <th className="px-5 py-3">Uploaded</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {attachments.map((attachment) => (
                                        <tr key={attachment.id} className="transition hover:bg-slate-50/70">
                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-900">{attachment.name}</p>
                                                <p className="text-xs text-slate-500">{attachment.uploader ? `By ${attachment.uploader}` : 'System'}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">{attachment.attachable}</td>
                                            <td className="px-5 py-3.5 text-xs text-slate-500">{attachment.mime_type ?? '—'}</td>
                                            <td className="px-5 py-3.5 text-right text-slate-500">{bytes(attachment.size)}</td>
                                            <td className="px-5 py-3.5"><Badge tone={attachment.ocr_status === 'processed' ? 'emerald' : attachment.ocr_status === 'failed' ? 'rose' : 'amber'} dot>{attachment.ocr_status}</Badge></td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDateTime(attachment.created_at)}</td>
                                            <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canWrite && (
                                                        <button type="button" onClick={() => openOcr(attachment)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700">OCR</button>
                                                    )}
                                                    {canWrite && (
                                                        <button type="button" onClick={() => remove(attachment)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete">
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <Modal open={open} onClose={() => setOpen(false)} title="Upload document" footer={<ActionFooter label="Upload" processing={form.processing} form="document-form" onCancel={() => setOpen(false)} />}>
                <form id="document-form" onSubmit={submit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <RichSelect
                            label="Attach to"
                            id="attachable_type"
                            value={form.data.attachable_type}
                            onChange={(value) => form.setData('attachable_type', value)}
                            error={form.errors.attachable_type}
                            emptyText="No types found"
                            options={Object.keys(attachableTypes).map((type) => ({
                                value: type,
                                primary: type,
                                secondary: attachableTypes[type].split('\\').pop(),
                            }))}
                        />
                        <TextInput label="Document ID" id="attachable_id" type="number" value={form.data.attachable_id} onChange={(e) => form.setData('attachable_id', e.target.value)} error={form.errors.attachable_id} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="document_file">File</label>
                        <input id="document_file" type="file" onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
                        {form.errors.file && <p className="mt-1.5 text-xs font-medium text-rose-600">{form.errors.file}</p>}
                    </div>
                </form>
            </Modal>

            <Modal open={ocrFor !== null} onClose={() => setOcrFor(null)} title="OCR result" description={ocrFor?.name} size="lg" footer={<ActionFooter label="Save OCR" processing={ocrForm.processing} form="ocr-form" onCancel={() => setOcrFor(null)} />}>
                <form id="ocr-form" onSubmit={submitOcr} className="space-y-4">
                    <RichSelect
                        label="Status"
                        id="ocr_status"
                        value={ocrForm.data.ocr_status}
                        onChange={(value) => ocrForm.setData('ocr_status', value)}
                        error={ocrForm.errors.ocr_status}
                        emptyText="No statuses found"
                        options={statuses.map((status) => ({
                            value: status,
                            primary: status,
                            badge: status === 'processed'
                                ? { label: 'Processed', classes: 'bg-emerald-50 text-emerald-600' }
                                : status === 'pending'
                                    ? { label: 'Pending', classes: 'bg-sky-50 text-sky-600' }
                                    : { label: 'Failed', classes: 'bg-rose-50 text-rose-600' },
                        }))}
                    />
                    <Textarea label="Extracted text" id="ocr_text" value={ocrForm.data.ocr_text} onChange={(e) => ocrForm.setData('ocr_text', e.target.value)} error={ocrForm.errors.ocr_text} rows={10} />
                </form>
            </Modal>
        </AppLayout>
    );
}

function ActionFooter({ label, processing, form, onCancel }) {
    return (
        <>
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">Cancel</button>
            <button type="submit" form={form} disabled={processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                {processing ? 'Saving…' : label}
            </button>
        </>
    );
}
