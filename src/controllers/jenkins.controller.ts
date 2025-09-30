import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JenkinsService } from '../services/jenkins.service';
import { RateLimitGuards } from '../guards/rate-limit.guards';
import { BaseController } from '../shared/base.controller';

export interface TriggerBuildDto {
  parameters?: Record<string, any>;
}

@Controller('/api/jenkins/')
@UseGuards(RateLimitGuards)
export class JenkinsController extends BaseController {
  constructor(private readonly jenkinsService: JenkinsService) {
    super();
  }

  /**
   * Get all Jenkins jobs
   */
  @Get('jobs')
  async getJobs() {
    try {
      const jobs = await this.jenkinsService.getJobs();

      // Add status info for each job
      const jobsWithStatus = jobs.map((job) => ({
        ...job,
        statusInfo: this.jenkinsService.getJobStatusInfo(job.color),
        lastBuildFormatted: job.lastBuild
          ? {
              ...job.lastBuild,
              durationFormatted: this.jenkinsService.formatDuration(
                job.lastBuild.duration
              ),
              timestampFormatted: new Date(
                job.lastBuild.timestamp
              ).toISOString(),
            }
          : null,
      }));

      return this.successResponse(
        jobsWithStatus,
        'Jenkins jobs retrieved successfully'
      );
    } catch (error) {
      return this.errorResponse(
        error.message || 'Failed to retrieve Jenkins jobs',
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get detailed information about a specific job
   */
  @Get('jobs/:jobName')
  async getJobDetails(@Param('jobName') jobName: string) {
    try {
      const jobDetails = await this.jenkinsService.getJobDetails(jobName);

      // Add formatted information
      const enhancedJobDetails = {
        ...jobDetails,
        statusInfo: this.jenkinsService.getJobStatusInfo(jobDetails.color),
        lastBuildFormatted: jobDetails.lastBuild
          ? {
              ...jobDetails.lastBuild,
              durationFormatted: this.jenkinsService.formatDuration(
                jobDetails.lastBuild.duration
              ),
              timestampFormatted: new Date(
                jobDetails.lastBuild.timestamp
              ).toISOString(),
            }
          : null,
        buildsFormatted:
          jobDetails.builds?.map((build) => ({
            ...build,
            durationFormatted: this.jenkinsService.formatDuration(
              build.duration
            ),
            timestampFormatted: new Date(build.timestamp).toISOString(),
          })) || [],
      };

      return this.successResponse(
        enhancedJobDetails,
        `Job details for ${jobName} retrieved successfully`
      );
    } catch (error) {
      return this.errorResponse(
        error.message || `Failed to retrieve job details for ${jobName}`,
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get recent builds for a specific job
   */
  @Get('jobs/:jobName/builds')
  async getJobBuilds(
    @Param('jobName') jobName: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    try {
      const builds = await this.jenkinsService.getJobBuilds(jobName, limit);

      // Add formatted information
      const buildsWithFormatting = builds.map((build) => ({
        ...build,
        durationFormatted: this.jenkinsService.formatDuration(build.duration),
        timestampFormatted: new Date(build.timestamp).toISOString(),
        estimatedDurationFormatted: this.jenkinsService.formatDuration(
          build.estimatedDuration
        ),
      }));

      return this.successResponse(
        buildsWithFormatting,
        `Recent builds for ${jobName} retrieved successfully`
      );
    } catch (error) {
      return this.errorResponse(
        error.message || `Failed to retrieve builds for ${jobName}`,
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Trigger a build for a specific job
   */
  @Post('jobs/:jobName/build')
  async triggerBuild(
    @Param('jobName') jobName: string,
    @Body() triggerBuildDto: TriggerBuildDto
  ) {
    try {
      const result = await this.jenkinsService.triggerBuild(
        jobName,
        triggerBuildDto.parameters
      );

      return this.successResponse(result, `Build triggered for ${jobName}`);
    } catch (error) {
      return this.errorResponse(
        error.message || `Failed to trigger build for ${jobName}`,
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get Jenkins system information
   */
  @Get('system/info')
  async getSystemInfo() {
    try {
      const systemInfo = await this.jenkinsService.getSystemInfo();

      // Add summary statistics
      const summary = {
        totalJobs: systemInfo.jobs?.length || 0,
        executors: systemInfo.numExecutors,
        mode: systemInfo.mode,
        useSecurity: systemInfo.useSecurity,
        quietingDown: systemInfo.quietingDown,
      };

      return this.successResponse(
        { ...systemInfo, summary },
        'Jenkins system information retrieved successfully'
      );
    } catch (error) {
      return this.errorResponse(
        error.message || 'Failed to retrieve Jenkins system information',
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get Jenkins build queue
   */
  @Get('queue')
  async getQueue() {
    try {
      const queue = await this.jenkinsService.getQueue();

      // Add formatted timestamps
      const formattedQueue = {
        ...queue,
        items:
          queue.items?.map((item) => ({
            ...item,
            timestampFormatted: new Date(item.timestamp).toISOString(),
          })) || [],
        summary: {
          totalItems: queue.items?.length || 0,
          stuckItems: queue.items?.filter((item) => item.stuck).length || 0,
        },
      };

      return this.successResponse(
        formattedQueue,
        'Jenkins queue retrieved successfully'
      );
    } catch (error) {
      return this.errorResponse(
        error.message || 'Failed to retrieve Jenkins queue',
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get build console output
   */
  @Get('jobs/:jobName/builds/:buildNumber/console')
  async getBuildConsoleOutput(
    @Param('jobName') jobName: string,
    @Param('buildNumber', ParseIntPipe) buildNumber: number
  ) {
    try {
      const consoleOutput = await this.jenkinsService.getBuildConsoleOutput(
        jobName,
        buildNumber
      );

      return this.successResponse(
        { consoleOutput, jobName, buildNumber },
        `Console output for ${jobName} #${buildNumber} retrieved successfully`
      );
    } catch (error) {
      return this.errorResponse(
        error.message ||
          `Failed to retrieve console output for ${jobName} #${buildNumber}`,
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get progressive console output for real-time viewing
   */
  @Get('jobs/:jobName/builds/:buildNumber/progressive-console')
  async getProgressiveConsoleOutput(
    @Param('jobName') jobName: string,
    @Param('buildNumber', ParseIntPipe) buildNumber: number,
    @Query('start', new DefaultValuePipe(0), ParseIntPipe) start: number
  ) {
    try {
      const progressiveOutput =
        await this.jenkinsService.getProgressiveConsoleOutput(
          jobName,
          buildNumber,
          start
        );

      return this.successResponse(
        { ...progressiveOutput, jobName, buildNumber },
        `Progressive console output for ${jobName} #${buildNumber} retrieved successfully`
      );
    } catch (error) {
      return this.errorResponse(
        error.message ||
          `Failed to retrieve progressive console output for ${jobName} #${buildNumber}`,
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Stop a running build
   */
  @Post('jobs/:jobName/builds/:buildNumber/stop')
  async stopBuild(
    @Param('jobName') jobName: string,
    @Param('buildNumber', ParseIntPipe) buildNumber: number
  ) {
    try {
      const result = await this.jenkinsService.stopBuild(jobName, buildNumber);

      return this.successResponse(
        result,
        `Build ${jobName} #${buildNumber} stopped successfully`
      );
    } catch (error) {
      return this.errorResponse(
        error.message || `Failed to stop build ${jobName} #${buildNumber}`,
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get Jenkins health check
   */
  @Get('health')
  async getHealthCheck() {
    try {
      const health = await this.jenkinsService.getHealthCheck();

      return this.successResponse(health, 'Jenkins health check completed');
    } catch (error) {
      return this.errorResponse(
        error.message || 'Failed to perform Jenkins health check',
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get Jenkins server status summary
   */
  @Get('status')
  async getStatus() {
    try {
      const [health, queue, systemInfo] = await Promise.allSettled([
        this.jenkinsService.getHealthCheck(),
        this.jenkinsService.getQueue(),
        this.jenkinsService.getSystemInfo(),
      ]);

      const status = {
        server:
          health.status === 'fulfilled'
            ? health.value
            : {
                status: 'error',
                message: 'Health check failed',
                timestamp: Date.now(),
              },
        queue:
          queue.status === 'fulfilled'
            ? {
                totalItems: queue.value.items?.length || 0,
                stuckItems:
                  queue.value.items?.filter((item) => item.stuck).length || 0,
              }
            : { totalItems: 0, stuckItems: 0 },
        system:
          systemInfo.status === 'fulfilled'
            ? {
                totalJobs: systemInfo.value.jobs?.length || 0,
                executors: systemInfo.value.numExecutors || 0,
                mode: systemInfo.value.mode || 'UNKNOWN',
              }
            : { totalJobs: 0, executors: 0, mode: 'UNKNOWN' },
        timestamp: Date.now(),
      };

      return this.successResponse(
        status,
        'Jenkins status summary retrieved successfully'
      );
    } catch (error) {
      return this.errorResponse(
        error.message || 'Failed to retrieve Jenkins status',
        error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private successResponse(data: any, message: string) {
    return {
      success: true,
      data,
      message,
    };
  }

  private errorResponse(message: string, status: number) {
    return {
      success: false,
      message,
      status,
    };
  }
}
