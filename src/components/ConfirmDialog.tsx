import { AlertTriangle } from 'lucide-react';

interface Props {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white w-full max-w-xs border-2 border-brand-blue shadow-[6px_6px_0px_0px_rgba(15,0,227,1)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-brand-red shrink-0 mt-0.5" strokeWidth={2.5} />
            <p className="text-sm font-semibold text-gray-900 leading-snug">{message}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 border-2 border-brand-blue font-bold text-sm uppercase text-gray-900 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 border-2 border-brand-blue bg-brand-red font-bold text-sm uppercase text-white hover:bg-red-700 transition-colors"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
