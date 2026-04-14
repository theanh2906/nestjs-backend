import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { SchedulerManagerService } from '../services/scheduler-manager.service';

/**
 * Controller for managing schedulers.
 */
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerManager: SchedulerManagerService) {}

  /**
   * Gets the status of all schedulers.
   * @returns The status of all schedulers.
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  getAllSchedulersStatus() {
    return {
      success: true,
      data: this.schedulerManager.getAllSchedulersStatus(),
    };
  }

  /**
   * Gets the status of a specific scheduler.
   * @param name The name of the scheduler.
   * @returns The status of the scheduler.
   */
  @Get('status/:name')
  @HttpCode(HttpStatus.OK)
  getSchedulerStatus(@Param('name') name: string) {
    const status = this.schedulerManager.getSchedulerStatus(name);
    if (!status) {
      return {
        success: false,
        message: `Scheduler '${name}' not found`,
      };
    }
    return {
      success: true,
      data: status,
    };
  }

  /**
   * Enables a scheduler.
   * @param name The name of the scheduler to enable.
   * @returns A success message.
   */
  @Post('enable/:name')
  @HttpCode(HttpStatus.OK)
  enableScheduler(@Param('name') name: string) {
    const result = this.schedulerManager.enableScheduler(name);
    return {
      success: result,
      message: result
        ? `Scheduler '${name}' enabled successfully`
        : `Failed to enable scheduler '${name}'`,
    };
  }

  /**
   * Disables a scheduler.
   * @param name The name of the scheduler to disable.
   * @returns A success message.
   */
  @Post('disable/:name')
  @HttpCode(HttpStatus.OK)
  disableScheduler(@Param('name') name: string) {
    const result = this.schedulerManager.disableScheduler(name);
    return {
      success: result,
      message: result
        ? `Scheduler '${name}' disabled successfully`
        : `Failed to disable scheduler '${name}'`,
    };
  }

  /**
   * Toggles a scheduler.
   * @param name The name of the scheduler to toggle.
   * @returns The new state of the scheduler.
   */
  @Post('toggle/:name')
  @HttpCode(HttpStatus.OK)
  toggleScheduler(@Param('name') name: string) {
    const wasEnabled = this.schedulerManager.isEnabled(name);
    const result = this.schedulerManager.toggleScheduler(name);
    const newState = this.schedulerManager.isEnabled(name);

    return {
      success: result,
      message: result
        ? `Scheduler '${name}' ${newState ? 'enabled' : 'disabled'} successfully`
        : `Failed to toggle scheduler '${name}'`,
      previousState: wasEnabled ? 'enabled' : 'disabled',
      currentState: newState ? 'enabled' : 'disabled',
    };
  }

  /**
   * Enables all schedulers.
   * @returns A summary of the operation.
   */
  @Post('enable-all')
  @HttpCode(HttpStatus.OK)
  enableAllSchedulers() {
    const statuses = this.schedulerManager.getAllSchedulersStatus();
    const results = statuses.map((status) => ({
      name: status.name,
      success: this.schedulerManager.enableScheduler(status.name),
    }));

    const allSuccessful = results.every((r) => r.success);
    return {
      success: allSuccessful,
      message: allSuccessful
        ? 'All schedulers enabled successfully'
        : 'Some schedulers failed to enable',
      details: results,
    };
  }

  /**
   * Disables all schedulers.
   * @returns A summary of the operation.
   */
  @Post('disable-all')
  @HttpCode(HttpStatus.OK)
  disableAllSchedulers() {
    const statuses = this.schedulerManager.getAllSchedulersStatus();
    const results = statuses.map((status) => ({
      name: status.name,
      success: this.schedulerManager.disableScheduler(status.name),
    }));

    const allSuccessful = results.every((r) => r.success);
    return {
      success: allSuccessful,
      message: allSuccessful
        ? 'All schedulers disabled successfully'
        : 'Some schedulers failed to disable',
      details: results,
    };
  }
}
