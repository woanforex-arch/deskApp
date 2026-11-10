import { InboxIcon } from '@heroicons/react/24/outline';

export default function EmptyState({ title = 'Nothing here yet', description, icon: Icon = InboxIcon, action }) {
    return (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200">
                <Icon className="h-7 w-7" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-slate-900">{title}</h3>
            {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
