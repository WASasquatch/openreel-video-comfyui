export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details?: string;
  stack?: string;
  timestamp: number;
  recoverable: boolean;
  recoveryAction?: () => Promise<void>;
  context?: Record<string, unknown>;
}

export type ErrorType =
  | "render"
  | "playback"
  | "export"
  | "media"
  | "storage"
  | "network"
  | "system"
  | "unknown";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

type ErrorCallback = (error: AppError) => void;

const ERROR_STORAGE_KEY = "openreel-error-log";
const MAX_STORED_ERRORS = 50;

class ErrorHandler {
  private errors: AppError[] = [];
  private listeners: Set<ErrorCallback> = new Set();
  private isInitialized = false;

  initialize(): void {
    if (this.isInitialized) return;

    window.addEventListener("error", this.handleGlobalError);
    window.addEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection,
    );

    this.loadStoredErrors();
    this.isInitialized = true;
  }

  dispose(): void {
    window.removeEventListener("error", this.handleGlobalError);
    window.removeEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection,
    );
    this.isInitialized = false;
  }

  private handleGlobalError = (event: ErrorEvent): void => {
    this.captureError({
      type: "unknown",
      severity: "error",
      message: event.message || "An unexpected error occurred",
      stack: event.error?.stack,
      recoverable: true,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const error = event.reason;
    this.captureError({
      type: "unknown",
      severity: "error",
      message: error?.message || "Unhandled promise rejection",
      stack: error?.stack,
      recoverable: true,
    });
  };

  captureError(options: {
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    details?: string;
    stack?: string;
    recoverable?: boolean;
    recoveryAction?: () => Promise<void>;
    context?: Record<string, unknown>;
  }): AppError {
    const error: AppError = {
      id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: options.type,
      severity: options.severity,
      message: options.message,
      details: options.details,
      stack: options.stack,
      timestamp: Date.now(),
      recoverable: options.recoverable ?? true,
      recoveryAction: options.recoveryAction,
      context: options.context,
    };

    this.errors.push(error);
    if (this.errors.length > MAX_STORED_ERRORS) {
      this.errors.shift();
    }

    this.storeErrors();
    this.notifyListeners(error);

    if (options.severity === "critical") {
      console.error("[ErrorHandler] Critical error:", error);
    } else if (options.severity === "error") {
      console.error("[ErrorHandler] Error:", error.message);
    } else if (options.severity === "warning") {
      console.warn("[ErrorHandler] Warning:", error.message);
    }

    return error;
  }

  captureRenderError(
    message: string,
    context?: Record<string, unknown>,
  ): AppError {
    return this.captureError({
      type: "render",
      severity: "error",
      message,
      context,
      recoverable: true,
      recoveryAction: async () => {
        const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embedded') === 'true';
        if (!isEmbedded) {
          window.location.reload();
        }
      },
    });
  }

  capturePlaybackError(
    message: string,
    context?: Record<string, unknown>,
  ): AppError {
    return this.captureError({
      type: "playback",
      severity: "warning",
      message,
      context,
      recoverable: true,
    });
  }

  captureExportError(
    message: string,
    context?: Record<string, unknown>,
  ): AppError {
    return this.captureError({
      type: "export",
      severity: "error",
      message,
      context,
      recoverable: true,
    });
  }

  captureMediaError(
    message: string,
    context?: Record<string, unknown>,
  ): AppError {
    return this.captureError({
      type: "media",
      severity: "warning",
      message,
      context,
      recoverable: true,
    });
  }

  captureStorageError(
    message: string,
    context?: Record<string, unknown>,
  ): AppError {
    return this.captureError({
      type: "storage",
      severity: "error",
      message,
      context,
      recoverable: true,
    });
  }

  async attemptRecovery(errorId: string): Promise<boolean> {
    const error = this.errors.find((e) => e.id === errorId);
    if (!error || !error.recoveryAction) {
      return false;
    }

    try {
      await error.recoveryAction();
      this.dismissError(errorId);
      return true;
    } catch (e) {
      console.error("[ErrorHandler] Recovery failed:", e);
      return false;
    }
  }

  dismissError(errorId: string): void {
    const index = this.errors.findIndex((e) => e.id === errorId);
    if (index !== -1) {
      this.errors.splice(index, 1);
      this.storeErrors();
    }
  }

  clearAllErrors(): void {
    this.errors = [];
    this.storeErrors();
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  getErrorsByType(type: ErrorType): AppError[] {
    return this.errors.filter((e) => e.type === type);
  }

  getErrorsBySeverity(severity: ErrorSeverity): AppError[] {
    return this.errors.filter((e) => e.severity === severity);
  }

  getRecentErrors(count: number = 10): AppError[] {
    return this.errors.slice(-count);
  }

  hasUnresolvedErrors(): boolean {
    return this.errors.some(
      (e) => e.severity === "error" || e.severity === "critical",
    );
  }

  onError(callback: ErrorCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(error: AppError): void {
    this.listeners.forEach((cb) => {
      try {
        cb(error);
      } catch (e) {
        console.error("[ErrorHandler] Listener error:", e);
      }
    });
  }

  private storeErrors(): void {
    try {
      const storable = this.errors.map(({ recoveryAction, ...rest }) => rest);
      localStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(storable));
    } catch (e) {
      console.warn("[ErrorHandler] Failed to store errors:", e);
    }
  }

  private loadStoredErrors(): void {
    try {
      const stored = localStorage.getItem(ERROR_STORAGE_KEY);
      if (stored) {
        this.errors = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("[ErrorHandler] Failed to load stored errors:", e);
    }
  }

  generateErrorReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errors: this.errors.map(({ recoveryAction, ...rest }) => rest),
    };
    return JSON.stringify(report, null, 2);
  }

  downloadErrorReport(): void {
    const report = this.generateErrorReport();
    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openreel-error-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const errorHandler = new ErrorHandler();
