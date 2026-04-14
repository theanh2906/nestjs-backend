import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

export interface SchedulerStatus {
  name: string;
  enabled: boolean;
  running: boolean;
  nextRun?: Date | null;
  lastRun?: Date | null;
}

/**
 * Service for managing schedulers.
 */
@Injectable()
export class SchedulerManagerService {
  private readonly logger = new Logger(SchedulerManagerService.name);
  private schedulerStates: Map<string, { enabled: boolean; lastRun?: Date }> =
    new Map();

  constructor(private schedulerRegistry: SchedulerRegistry) {
    // Initialize scheduler states from environment variables
    this.initializeSchedulerStates();
  }

  private initializeSchedulerStates() {
    const globalEnabled =
      process.env.SCHEDULER_ENABLED?.toLowerCase() === 'true';
    const dbBackupEnabled =
      process.env.BACKUP_DATABASE_SCHEDULER_ENABLED?.toLowerCase() === 'true';
    const storageBackupEnabled =
      process.env.BACKUP_STORAGE_SCHEDULER_ENABLED?.toLowerCase() === 'true';

    this.schedulerStates.set('backupFirebaseDatabase', {
      enabled: globalEnabled && dbBackupEnabled,
    });
    this.schedulerStates.set('backupFirebaseStorage', {
      enabled: globalEnabled && storageBackupEnabled,
    });

    this.logger.log('Scheduler states initialized:');
    this.schedulerStates.forEach((state, name) => {
      this.logger.log(`  ${name}: ${state.enabled ? 'ENABLED' : 'DISABLED'}`);
    });
  }

  /**
   * Checks if a scheduler is enabled.
   * @param jobName The name of the scheduler.
   * @returns True if the scheduler is enabled, false otherwise.
   */
  isEnabled(jobName: string): boolean {
    const state = this.schedulerStates.get(jobName);
    return state?.enabled ?? false;
  }

  /**
   * Enables a scheduler.
   * @param jobName The name of the scheduler.
   * @returns True if the scheduler was enabled successfully, false otherwise.
   */
  enableScheduler(jobName: string): boolean {
    try {
      const job = this.schedulerRegistry.getCronJob(jobName);
      const cronJob = job as any;
      if (!cronJob.running) {
        job.start();
      }
      this.schedulerStates.set(jobName, {
        ...(this.schedulerStates.get(jobName) || {}),
        enabled: true,
      });
      this.logger.log(`Scheduler '${jobName}' enabled`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to enable scheduler '${jobName}': ${error.message}`
      );
      return false;
    }
  }

  /**
   * Disables a scheduler.
   * @param jobName The name of the scheduler.
   * @returns True if the scheduler was disabled successfully, false otherwise.
   */
  disableScheduler(jobName: string): boolean {
    try {
      const job = this.schedulerRegistry.getCronJob(jobName);
      const cronJob = job as any;
      if (cronJob.running) {
        job.stop();
      }
      this.schedulerStates.set(jobName, {
        ...(this.schedulerStates.get(jobName) || {}),
        enabled: false,
      });
      this.logger.log(`Scheduler '${jobName}' disabled`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to disable scheduler '${jobName}': ${error.message}`
      );
      return false;
    }
  }

  /**
   * Toggles a scheduler.
   * @param jobName The name of the scheduler.
   * @returns True if the scheduler was toggled successfully, false otherwise.
   */
  toggleScheduler(jobName: string): boolean {
    const isEnabled = this.isEnabled(jobName);
    return isEnabled
      ? this.disableScheduler(jobName)
      : this.enableScheduler(jobName);
  }

  /**
   * Updates the last run time of a scheduler.
   * @param jobName The name of the scheduler.
   */
  updateLastRun(jobName: string) {
    const state = this.schedulerStates.get(jobName);
    if (state) {
      this.schedulerStates.set(jobName, {
        ...state,
        lastRun: new Date(),
      });
    }
  }

  /**
   * Gets the status of all schedulers.
   * @returns A list of scheduler statuses.
   */
  getAllSchedulersStatus(): SchedulerStatus[] {
    const statuses: SchedulerStatus[] = [];

    this.schedulerStates.forEach((state, name) => {
      try {
        const job = this.schedulerRegistry.getCronJob(name);
        const cronJob = job as any;

        statuses.push({
          name,
          enabled: state.enabled,
          running: cronJob.running || false,
          nextRun: cronJob.nextDate()?.toJSDate() || null,
          lastRun: state.lastRun || null,
        });
      } catch (error) {
        statuses.push({
          name,
          enabled: state.enabled,
          running: false,
          nextRun: null,
          lastRun: state.lastRun || null,
        });
      }
    });

    return statuses;
  }

  /**
   * Gets the status of a specific scheduler.
   * @param jobName The name of the scheduler.
   * @returns The status of the scheduler, or null if it doesn't exist.
   */
  getSchedulerStatus(jobName: string): SchedulerStatus | null {
    const state = this.schedulerStates.get(jobName);
    if (!state) {
      return null;
    }

    try {
      const job = this.schedulerRegistry.getCronJob(jobName);
      const cronJob = job as any;

      return {
        name: jobName,
        enabled: state.enabled,
        running: cronJob.running || false,
        nextRun: cronJob.nextDate()?.toJSDate() || null,
        lastRun: state.lastRun || null,
      };
    } catch (error) {
      return {
        name: jobName,
        enabled: state.enabled,
        running: false,
        nextRun: null,
        lastRun: state.lastRun || null,
      };
    }
  }
}
