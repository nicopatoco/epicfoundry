import { Injectable } from '@nestjs/common';

@Injectable()
export class AppLogger {
  log(message: string, context = 'App'): void {
    console.log(this.format(context, message));
  }

  warn(message: string, context = 'App'): void {
    console.warn(this.format(context, message));
  }

  error(message: string, trace?: string, context = 'App'): void {
    const payload = trace
      ? `${this.format(context, message)}\n${trace}`
      : this.format(context, message);
    console.error(payload);
  }

  private format(context: string, message: string): string {
    return `[EpicFoundry][${context}] ${message}`;
  }
}
