import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export default function DashboardError({ message, onRetry }: Props) {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="card p-8 md:p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-14 h-14 rounded-2xl bg-critical-50 flex items-center justify-center mb-5">
          <AlertCircle size={28} className="text-critical-500" />
        </div>
        <h2 className="text-lg font-semibold text-surface-900 mb-2">
          Unable to load dashboard
        </h2>
        <p className="text-sm text-surface-500 max-w-md mb-6">
          {message || 'Something went wrong while fetching your dashboard data. Please try again.'}
        </p>
        {onRetry && (
          <button onClick={onRetry} className="btn-primary">
            <RefreshCw size={16} />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
