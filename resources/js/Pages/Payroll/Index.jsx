import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { BanknotesIcon, CheckCircleIcon, PlayIcon, PlusIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import AppLayout from '../../Layouts/AppLayout';
import PageHeader from '../../Components/PageHeader';
import StatCard from '../../Components/StatCard';
import Badge from '../../Components/Badge';
import EmptyState from '../../Components/EmptyState';
import Modal from '../../Components/Modal';
import { RichSelect, TextInput } from '../../Components/FormControls';
import { currency, formatDate, formatDateTime } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function PayrollIndex({ employees, runs, items, filters, stats, departments, frequencies, periods }) {
    const page = usePage();
    const canApprove = page.props.auth?.user?.can_approve;
    const canWrite = page.props.auth?.user?.can_write;
    const [tab, setTab] = useState('runs');
    const [modal, setModal] = useState(null);

    const employeeForm = useForm({
        employee_number: '',
        name: '',
        email: '',
        department_id: '',
        position: '',
        hire_date: today(),
        gross_salary: 0,
        pay_frequency: 'monthly',
        tax_number: '',
        bank_account: '',
    });
    const runForm = useForm({ period: currentPeriod(), pay_date: today(), income_tax_rate: 10, social_security_rate: 5 });

    const submitEmployee = (e) => {
        e.preventDefault();
        employeeForm.post('/payroll/employees', { preserveScroll: true, onSuccess: () => { setModal(null); employeeForm.reset(); } });
    };
    const submitRun = (e) => {
        e.preventDefault();
        runForm.post('/payroll/runs', { preserveScroll: true, onSuccess: () => { setModal(null); runForm.reset(); } });
    };
    const process = (run) => {
        if (confirm(`Post payroll for ${run.period} to the ledger?`)) {
            router.post(`/payroll/runs/${run.id}/process`, {}, { preserveScroll: true });
        }
    };
    const filterPeriod = (period) => router.get('/payroll', period ? { period } : {}, { preserveState: true, preserveScroll: true, replace: true });

    const tabs = [
        { key: 'runs', label: 'Payroll runs' },
        { key: 'employees', label: 'Employees' },
        { key: 'payslips', label: 'Payslips' },
    ];

    return (
        <AppLayout>
            <Head title="Payroll" />

            <div className="space-y-6">
                <PageHeader eyebrow="Payroll & tax" title="Payroll" description="Employee register, payroll runs, deductions, and automatic payroll journal posting.">
                    {canWrite && (
                        <button type="button" onClick={() => setModal('employee')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700">
                            <PlusIcon className="h-4 w-4" />
                            Add employee
                        </button>
                    )}
                    {canWrite && (
                        <button type="button" onClick={() => setModal('run')} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
                            <PlayIcon className="h-4 w-4" />
                            New payroll run
                        </button>
                    )}
                </PageHeader>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Active employees" value={stats.employees} hint="On the payroll register" icon={UserGroupIcon} accent="brand" />
                    <StatCard label="Monthly gross" value={currency(stats.monthly_gross)} hint="Current salary commitment" icon={BanknotesIcon} accent="sky" />
                    <StatCard label="Payroll runs" value={stats.runs} hint={`${stats.posted} posted`} icon={PlayIcon} accent="violet" />
                    <StatCard label="Net paid" value={currency(stats.net_paid)} hint="Across posted runs" icon={CheckCircleIcon} accent="emerald" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map((item) => (
                        <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${tab === item.key ? 'bg-slate-900 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}>
                            {item.label}
                        </button>
                    ))}
                    {periods.length > 0 && (
                        <RichSelect
                            value={filters.period ?? ''}
                            onChange={(value) => filterPeriod(value)}
                            placeholder="All periods"
                            options={periods.map((period) => ({
                                value: period,
                                primary: period,
                            }))}
                            className="ml-auto w-full sm:w-auto"
                        />
                    )}
                </div>

                {tab === 'runs' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        {runs.length === 0 ? (
                            <EmptyState title="No payroll runs" description="Draft a payroll run to calculate gross, deductions and net pay." icon={PlayIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Period</th>
                                            <th className="px-5 py-3">Pay date</th>
                                            <th className="px-5 py-3 text-right">Employees</th>
                                            <th className="px-5 py-3 text-right">Gross</th>
                                            <th className="px-5 py-3 text-right">Deductions</th>
                                            <th className="px-5 py-3 text-right">Net</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {runs.map((run) => (
                                            <tr key={run.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-slate-900">{run.period}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(run.pay_date)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{run.items_count}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(run.gross_total)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(run.deductions_total)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(run.net_total)}</td>
                                                <td className="px-5 py-3.5">
                                                    <Badge tone={run.status === 'posted' ? 'emerald' : run.status === 'approved' ? 'sky' : 'amber'} dot>{run.status}</Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                                    {run.status !== 'posted' && canApprove ? (
                                                        <button type="button" onClick={() => process(run)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                                                            Post payroll
                                                        </button>
                                                    ) : run.status === 'posted' ? (
                                                        <span className="text-xs text-slate-400">{run.approved_at ? formatDateTime(run.approved_at) : 'Posted'}</span>
                                                    ) : null}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'employees' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        {employees.length === 0 ? (
                            <EmptyState title="No employees" description="Add employees to the payroll register." icon={UserGroupIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Employee</th>
                                            <th className="px-5 py-3">Department</th>
                                            <th className="px-5 py-3">Position</th>
                                            <th className="px-5 py-3 text-right">Gross salary</th>
                                            <th className="px-5 py-3">Frequency</th>
                                            <th className="px-5 py-3">Tax number</th>
                                            <th className="px-5 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {employees.map((employee) => (
                                            <tr key={employee.id} className="transition hover:bg-slate-50/70">
                                                <td className="px-5 py-3.5">
                                                    <p className="font-semibold text-slate-900">{employee.name}</p>
                                                    <p className="text-xs text-slate-500">{employee.employee_number} · {employee.email ?? '—'}</p>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-600">{employee.department ?? '—'}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{employee.position ?? '—'}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">{currency(employee.gross_salary)}</td>
                                                <td className="px-5 py-3.5 capitalize text-slate-500">{employee.pay_frequency}</td>
                                                <td className="px-5 py-3.5 text-slate-500">{employee.tax_number ?? '—'}</td>
                                                <td className="px-5 py-3.5"><Badge tone={employee.is_active ? 'emerald' : 'slate'} dot>{employee.is_active ? 'Active' : 'Inactive'}</Badge></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'payslips' && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        {items.length === 0 ? (
                            <EmptyState title="No payslips" description="Payslips are generated when a payroll run is drafted." icon={BanknotesIcon} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead>
                                        <tr className="bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-5 py-3">Period</th>
                                            <th className="px-5 py-3">Employee</th>
                                            <th className="px-5 py-3 text-right">Gross</th>
                                            <th className="px-5 py-3 text-right">Income tax</th>
                                            <th className="px-5 py-3 text-right">Social security</th>
                                            <th className="px-5 py-3 text-right">Other</th>
                                            <th className="px-5 py-3 text-right">Net</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((item) => (
                                            <tr key={item.id} className="transition hover:bg-slate-50/70">
                                                <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-900">{item.period}</td>
                                                <td className="px-5 py-3.5">
                                                    <p className="text-slate-700">{item.employee}</p>
                                                    <p className="text-xs text-slate-400">{item.employee_number}</p>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(item.gross)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(item.income_tax)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(item.social_security)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right text-slate-600">{currency(item.other_deductions)}</td>
                                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-slate-900">{currency(item.net)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Modal open={modal === 'employee'} onClose={() => setModal(null)} title="Add employee" size="lg" footer={<Footer label="Add employee" processing={employeeForm.processing} form="employee-form" onCancel={() => setModal(null)} />}>
                <form id="employee-form" onSubmit={submitEmployee} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Employee number" id="employee_number" value={employeeForm.data.employee_number} onChange={(e) => employeeForm.setData('employee_number', e.target.value)} error={employeeForm.errors.employee_number} />
                        <TextInput label="Name" id="name" value={employeeForm.data.name} onChange={(e) => employeeForm.setData('name', e.target.value)} error={employeeForm.errors.name} />
                        <TextInput label="Email" id="email" type="email" value={employeeForm.data.email} onChange={(e) => employeeForm.setData('email', e.target.value)} error={employeeForm.errors.email} />
                        <RichSelect
                            label="Department"
                            id="department_id"
                            value={employeeForm.data.department_id}
                            onChange={(value) => employeeForm.setData('department_id', value)}
                            error={employeeForm.errors.department_id}
                            placeholder="No department"
                            options={departments.map((department) => ({ value: department.id, primary: department.name }))}
                        />
                        <TextInput label="Position" id="position" value={employeeForm.data.position} onChange={(e) => employeeForm.setData('position', e.target.value)} error={employeeForm.errors.position} />
                        <TextInput label="Hire date" id="hire_date" type="date" value={employeeForm.data.hire_date} onChange={(e) => employeeForm.setData('hire_date', e.target.value)} error={employeeForm.errors.hire_date} />
                        <TextInput label="Gross salary" id="gross_salary" type="number" step="0.01" value={employeeForm.data.gross_salary} onChange={(e) => employeeForm.setData('gross_salary', e.target.value)} error={employeeForm.errors.gross_salary} />
                        <RichSelect
                            label="Pay frequency"
                            id="pay_frequency"
                            value={employeeForm.data.pay_frequency}
                            onChange={(value) => employeeForm.setData('pay_frequency', value)}
                            error={employeeForm.errors.pay_frequency}
                            options={frequencies.map((frequency) => ({
                                value: frequency,
                                primary: frequency.charAt(0).toUpperCase() + frequency.slice(1),
                            }))}
                        />
                        <TextInput label="Tax number" id="tax_number" value={employeeForm.data.tax_number} onChange={(e) => employeeForm.setData('tax_number', e.target.value)} error={employeeForm.errors.tax_number} />
                        <TextInput label="Bank account" id="bank_account" value={employeeForm.data.bank_account} onChange={(e) => employeeForm.setData('bank_account', e.target.value)} error={employeeForm.errors.bank_account} />
                    </div>
                </form>
            </Modal>

            <Modal open={modal === 'run'} onClose={() => setModal(null)} title="New payroll run" description="Draft a run for all active employees, then post it to the ledger." footer={<Footer label="Draft run" processing={runForm.processing} form="run-form" onCancel={() => setModal(null)} />}>
                <form id="run-form" onSubmit={submitRun} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput label="Period (YYYY-MM)" id="period" value={runForm.data.period} onChange={(e) => runForm.setData('period', e.target.value)} error={runForm.errors.period} placeholder="2026-11" />
                        <TextInput label="Pay date" id="pay_date" type="date" value={runForm.data.pay_date} onChange={(e) => runForm.setData('pay_date', e.target.value)} error={runForm.errors.pay_date} />
                        <TextInput label="Income tax rate (%)" id="income_tax_rate" type="number" step="0.01" value={runForm.data.income_tax_rate} onChange={(e) => runForm.setData('income_tax_rate', e.target.value)} error={runForm.errors.income_tax_rate} />
                        <TextInput label="Social security rate (%)" id="social_security_rate" type="number" step="0.01" value={runForm.data.social_security_rate} onChange={(e) => runForm.setData('social_security_rate', e.target.value)} error={runForm.errors.social_security_rate} />
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}

function Footer({ label, processing, form, onCancel }) {
    return (
        <>
            <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">Cancel</button>
            <button type="submit" form={form} disabled={processing} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
                {processing ? 'Working…' : label}
            </button>
        </>
    );
}
