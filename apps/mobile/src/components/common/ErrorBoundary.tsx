import React, { Component, ReactNode } from 'react';
import EmptyState from './EmptyState';
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <EmptyState
        message="The app encountered a problem."
        onRetry={() => this.setState({ failed: false })}
      />
    ) : (
      this.props.children
    );
  }
}
