"use client";
import React, { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Wire your error-tracking service (Sentry, Datadog, etc.) here.
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = process.env.NODE_ENV !== "production";

    return (
      <div className="text-center py-12 px-4">
        <p className="text-lg text-red-500 mb-4">
          Something went wrong. Please try again.
        </p>
        {isDev && this.state.error && (
          <pre className="text-xs text-left text-red-400 bg-red-50 rounded p-4 max-w-xl mx-auto overflow-auto mb-4">
            {this.state.error.message}
            {"\n"}
            {this.state.error.stack}
          </pre>
        )}
        <button
          onClick={this.handleReset}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
