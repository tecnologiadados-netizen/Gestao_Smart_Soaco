import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-8 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <p className="text-slate-800 dark:text-slate-200 font-medium">Algo deu errado ao carregar esta página.</p>
          {this.state.error && (
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg break-all">{this.state.error.message}</p>
          )}
          <Link
            to="/"
            className="rounded-lg bg-primary-600 hover:bg-primary-700 px-4 py-2 text-white text-sm font-medium"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}
