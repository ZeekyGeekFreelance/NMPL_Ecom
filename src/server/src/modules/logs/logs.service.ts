import { LogsRepository } from "./logs.repository";
import { LogEntry } from "./logs.types";
import { bootState } from "@/bootstrap/state";

const PERSISTED_INFO_MESSAGES = new Set([
  "Register",
  "Sign in",
  "Sign out",
  "First-login password change",
  "Self password change",
  "SuperAdmin out-of-band password reset",
  "Forgot password request",
  "Password reset via token",
  "Billing supervisor flag updated",
  "Admin password updated by SuperAdmin",
  "Order placed from checkout",
  "Pay-later order confirmed without payment",
  "Mock payment flow confirmed order",
  "Admin payment recorded",
  "Admin payment recorded successfully",
  "Webhook - Payment confirmed order",
]);

export class LogsService {
  constructor(private logsRepository: LogsRepository) {}

  async getLogs(): Promise<any> {
    return this.logsRepository.getLogs();
  }

  async getLogById(id: string): Promise<any> {
    return this.logsRepository.getLogById(id);
  }

  async getLogByLevel(level: string): Promise<any> {
    return this.logsRepository.getLogsByLevel(level);
  }

  async deleteLog(id: string): Promise<any> {
    return this.logsRepository.deleteLog(id);
  }

  async clearLogs(): Promise<any> {
    return this.logsRepository.clearLogs();
  }

  private shouldPersistEntry(entry: LogEntry): boolean {
    switch (entry.level) {
      case "error":
      case "warn":
        return true;
      case "info":
        return PERSISTED_INFO_MESSAGES.has(entry.message);
      case "debug":
      default:
        return false;
    }
  }

  async log(entry: LogEntry): Promise<void> {
    console.log(
      `[${entry.level.toUpperCase()}] ${entry.message}`,
      entry.context || ""
    );

    if (!bootState.serverReady || !this.shouldPersistEntry(entry)) {
      return;
    }

    try {
      await this.logsRepository.createLog({
        level: entry.level,
        message: entry.message,
        context: entry.context,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[LOG_PERSIST_FAILED] ${message}`);
    }
  }

  async info(message: string, context?: Record<string, any>): Promise<void> {
    await this.log({ level: "info", message, context });
  }

  async error(message: string, context?: Record<string, any>): Promise<void> {
    await this.log({ level: "error", message, context });
  }

  async warn(message: string, context?: Record<string, any>): Promise<void> {
    await this.log({ level: "warn", message, context });
  }

  async debug(message: string, context?: Record<string, any>): Promise<void> {
    await this.log({ level: "debug", message, context });
  }
}
