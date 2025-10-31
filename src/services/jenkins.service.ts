import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface JenkinsJob {
  name: string;
  url: string;
  color: string;
  buildable: boolean;
  lastBuild?: {
    number: number;
    url: string;
    timestamp: number;
    result: string;
    duration: number;
    displayName: string;
  };
  healthReport?: Array<{
    description: string;
    iconUrl: string;
    score: number;
  }>;
  inQueue: boolean;
  description?: string;
}

export interface JenkinsBuild {
  number: number;
  url: string;
  timestamp: number;
  result: string;
  duration: number;
  displayName: string;
  description?: string;
  estimatedDuration: number;
  building: boolean;
  executor?: any;
  actions: any[];
}

export interface JenkinsJobDetails extends JenkinsJob {
  builds: JenkinsBuild[];
  nextBuildNumber: number;
  property: any[];
  queueItem?: any;
  concurrentBuild: boolean;
  disabled: boolean;
  downstreamProjects: any[];
  upstreamProjects: any[];
}

export interface JenkinsSystemInfo {
  mode: string;
  nodeDescription: string;
  nodeName: string;
  numExecutors: number;
  description: string;
  jobs: JenkinsJob[];
  overallLoad: any;
  primaryView: any;
  quietingDown: boolean;
  slaveAgentPort: number;
  unlabeledLoad: any;
  useCrumbs: boolean;
  useSecurity: boolean;
  views: any[];
}

export interface JenkinsQueue {
  items: Array<{
    id: number;
    task: {
      name: string;
      url: string;
    };
    stuck: boolean;
    actions: any[];
    buildable: boolean;
    params: string;
    why: string;
    timestamp: number;
  }>;
}

@Injectable()
export class JenkinsService {
  private readonly jenkinsUrl: string;
  private readonly jenkinsAuth?: string;

  constructor(private readonly httpService: HttpService) {
    this.jenkinsUrl = process.env.JENKINS_URL || 'https://jenkins.benna.life';

    // Optional: Set up authentication if credentials are provided
    // Prefer API token over password for better security
    const username = process.env.JENKINS_USERNAME;
    const token = process.env.JENKINS_API_TOKEN || process.env.JENKINS_PASSWORD;

    if (username && token) {
      const credentials = Buffer.from(`${username}:${token}`).toString(
        'base64'
      );
      this.jenkinsAuth = `Basic ${credentials}`;
    }
  }

  /**
   * Get all Jenkins jobs with basic information
   */
  async getJobs(): Promise<JenkinsJob[]> {
    const data = await this.makeRequest(
      '/api/json?tree=jobs[name,url,color,buildable,inQueue,description,lastBuild[number,url,timestamp,result,duration,displayName],healthReport[description,iconUrl,score]]'
    );
    return data.jobs || [];
  }

  /**
   * Get detailed information about a specific job
   */
  async getJobDetails(jobName: string): Promise<JenkinsJobDetails> {
    const encodedJobName = encodeURIComponent(jobName);
    const endpoint = `/job/${encodedJobName}/api/json?tree=name,url,color,buildable,inQueue,description,lastBuild[number,url,timestamp,result,duration,displayName],healthReport[description,iconUrl,score],builds[number,url,timestamp,result,duration,displayName,building],nextBuildNumber,property,queueItem,concurrentBuild,disabled,downstreamProjects[name,url],upstreamProjects[name,url]`;

    return await this.makeRequest(endpoint);
  }

  /**
   * Get recent builds for a specific job
   */
  async getJobBuilds(
    jobName: string,
    limit: number = 10
  ): Promise<JenkinsBuild[]> {
    const encodedJobName = encodeURIComponent(jobName);
    const endpoint = `/job/${encodedJobName}/api/json?tree=builds[number,url,timestamp,result,duration,displayName,description,estimatedDuration,building,executor,actions]{0,${limit}}`;

    const data = await this.makeRequest(endpoint);
    return data.builds || [];
  }

  /**
   * Trigger a build for a specific job
   */
  async triggerBuild(
    jobName: string,
    parameters?: Record<string, any>
  ): Promise<{ message: string; queueId?: number }> {
    // First try simple method with API token (most reliable)
    try {
      console.log(`Triggering build for job: ${jobName}`);
      return await this.triggerBuildSimple(jobName, parameters);
    } catch (simpleError) {
      console.log(
        'Simple build trigger failed, trying CSRF method:',
        simpleError.message
      );
      // Fall back to CSRF method
      return await this.triggerBuildWithCSRF(jobName, parameters);
    }
  }

  /**
   * Get Jenkins system information
   */
  async getSystemInfo(): Promise<JenkinsSystemInfo> {
    return await this.makeRequest('/api/json');
  }

  /**
   * Get Jenkins build queue
   */
  async getQueue(): Promise<JenkinsQueue> {
    return await this.makeRequest('/queue/api/json');
  }

  /**
   * Get build console output
   */
  async getBuildConsoleOutput(
    jobName: string,
    buildNumber: number
  ): Promise<string> {
    const encodedJobName = encodeURIComponent(jobName);
    const endpoint = `/job/${encodedJobName}/${buildNumber}/consoleText`;

    return await this.makeRequest(endpoint);
  }

  /**
   * Get progressive console output for real-time viewing
   */
  async getProgressiveConsoleOutput(
    jobName: string,
    buildNumber: number,
    start: number = 0
  ): Promise<{ content: string; hasMore: boolean; nextStart: number }> {
    const encodedJobName = encodeURIComponent(jobName);
    const endpoint = `/job/${encodedJobName}/${buildNumber}/logText/progressiveText?start=${start}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.jenkinsUrl}${endpoint}`, {
          headers: this.getHeaders(),
          timeout: 30000,
        })
      );

      const hasMore = response.headers['x-more-data'] === 'true';
      const nextStart = parseInt(response.headers['x-text-size'] || '0');

      return {
        content: response.data || '',
        hasMore,
        nextStart,
      };
    } catch (error) {
      console.error(
        `Jenkins Progressive Log Error (${endpoint}):`,
        error.message
      );
      throw new HttpException(
        'Unable to fetch progressive console output',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Stop/cancel a running build
   */
  async stopBuild(
    jobName: string,
    buildNumber: number
  ): Promise<{ message: string }> {
    const encodedJobName = encodeURIComponent(jobName);
    const endpoint = `/job/${encodedJobName}/${buildNumber}/stop`;

    await this.makeRequest(endpoint, 'POST');

    return {
      message: `Build #${buildNumber} for job ${jobName} has been stopped`,
    };
  }

  /**
   * Check Jenkins server health
   */
  async getHealthCheck(): Promise<{
    status: string;
    message: string;
    timestamp: number;
  }> {
    try {
      const data = await this.makeRequest('/api/json?tree=mode,quietingDown');

      const isHealthy = data.mode === 'NORMAL' && !data.quietingDown;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy
          ? 'Jenkins server is running normally'
          : `Jenkins status: ${data.mode}, Quieting down: ${data.quietingDown}`,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Unable to connect to Jenkins server',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Utility method to get job status color meaning
   */
  getJobStatusInfo(color: string): {
    status: string;
    description: string;
    severity: 'success' | 'warning' | 'danger' | 'info';
  } {
    const colorMap: Record<
      string,
      {
        status: string;
        description: string;
        severity: 'success' | 'warning' | 'danger' | 'info';
      }
    > = {
      blue: {
        status: 'Success',
        description: 'Last build was successful',
        severity: 'success',
      },
      red: {
        status: 'Failed',
        description: 'Last build failed',
        severity: 'danger',
      },
      yellow: {
        status: 'Unstable',
        description: 'Last build was unstable',
        severity: 'warning',
      },
      grey: {
        status: 'Pending',
        description: 'Never been built',
        severity: 'info',
      },
      disabled: {
        status: 'Disabled',
        description: 'Job is disabled',
        severity: 'info',
      },
      aborted: {
        status: 'Aborted',
        description: 'Last build was aborted',
        severity: 'warning',
      },
      notbuilt: {
        status: 'Not Built',
        description: 'Never been built',
        severity: 'info',
      },
    };

    // Handle animated colors (building states)
    const baseColor = color.replace('_anime', '');
    const isBuilding = color.includes('_anime');

    const info = colorMap[baseColor] || {
      status: 'Unknown',
      description: 'Unknown status',
      severity: 'info',
    };

    if (isBuilding) {
      info.status = `${info.status} (Building)`;
      info.description = `Currently building - ${info.description}`;
    }

    return info;
  }

  /**
   * Format duration from milliseconds to human readable format
   */
  formatDuration(milliseconds: number): string {
    if (!milliseconds) return 'N/A';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private getHeaders(_includeCrumb: boolean = false) {
    const headers: any = {
      'Content-Type': 'application/json',
    };

    if (this.jenkinsAuth) {
      headers['Authorization'] = this.jenkinsAuth;
    }

    return headers;
  }

  private async getCrumb(): Promise<{
    crumb: string;
    crumbRequestField: string;
  } | null> {
    try {
      const crumbData = await this.makeRequest('/crumbIssuer/api/json', 'GET');
      console.log(
        `Got Jenkins crumb: ${crumbData.crumbRequestField} = ${crumbData.crumb}`
      );
      return {
        crumb: crumbData.crumb,
        crumbRequestField: crumbData.crumbRequestField,
      };
    } catch (error) {
      console.log(
        'CSRF crumb not available, continuing without it:',
        error.message
      );
      return null;
    }
  }

  private async triggerBuildAlternative(
    jobName: string,
    parameters?: Record<string, any>
  ): Promise<{ message: string; queueId?: number }> {
    const encodedJobName = encodeURIComponent(jobName);

    try {
      // Try method 1: Direct API call with token (often bypasses CSRF)
      const endpoint =
        parameters && Object.keys(parameters).length > 0
          ? `/job/${encodedJobName}/buildWithParameters`
          : `/job/${encodedJobName}/build`;

      const url = `${this.jenkinsUrl}${endpoint}`;

      // Prepare form data if needed
      let formData = '';
      if (parameters && Object.keys(parameters).length > 0) {
        formData = new URLSearchParams(parameters).toString();
      }

      const config = {
        method: 'POST' as const,
        url,
        headers: this.getHeaders(),
        timeout: 30000,
        data: formData,
      };

      const response = await firstValueFrom(this.httpService.request(config));

      return {
        message: `Build triggered successfully for job: ${jobName}`,
      };
    } catch (error) {
      console.log('Alternative method failed, trying original approach');
      throw error;
    }
  }

  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any
  ) {
    try {
      const url = `${this.jenkinsUrl}${endpoint}`;
      const headers = this.getHeaders();

      // For POST requests, try to add CSRF crumb token
      if (method === 'POST') {
        const crumb = await this.getCrumb();
        if (crumb) {
          headers[crumb.crumbRequestField] = crumb.crumb;
        }
      }

      const config = {
        method,
        url,
        headers,
        timeout: 30000, // 30 second timeout
        data,
      };

      const response = await firstValueFrom(this.httpService.request(config));
      return response.data;
    } catch (error) {
      console.error(`Jenkins API Error (${endpoint}):`, error.message);

      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message;

        switch (status) {
          case 401:
            throw new HttpException(
              'Jenkins authentication failed',
              HttpStatus.UNAUTHORIZED
            );
          case 403:
            throw new HttpException(
              'Jenkins access forbidden',
              HttpStatus.FORBIDDEN
            );
          case 404:
            throw new HttpException(
              'Jenkins resource not found',
              HttpStatus.NOT_FOUND
            );
          case 500:
            throw new HttpException(
              'Jenkins server error',
              HttpStatus.INTERNAL_SERVER_ERROR
            );
          default:
            throw new HttpException(
              `Jenkins error: ${message}`,
              HttpStatus.BAD_GATEWAY
            );
        }
      }

      throw new HttpException(
        'Unable to connect to Jenkins server',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  private async triggerBuildSimple(
    jobName: string,
    parameters?: Record<string, any>
  ): Promise<{ message: string; queueId?: number }> {
    const encodedJobName = encodeURIComponent(jobName);
    const endpoint =
      parameters && Object.keys(parameters).length > 0
        ? `/job/${encodedJobName}/buildWithParameters`
        : `/job/${encodedJobName}/build`;

    let formData = '';
    if (parameters && Object.keys(parameters).length > 0) {
      formData = new URLSearchParams(parameters).toString();
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.jenkinsUrl}${endpoint}`, formData, {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 30000,
          validateStatus: (status) => status < 400,
        })
      );

      return {
        message: `Build triggered successfully for job: ${jobName}`,
        queueId: this.extractQueueId(response.headers?.location),
      };
    } catch (error) {
      if (error.response?.status === 201) {
        // 201 is success for Jenkins
        return {
          message: `Build triggered successfully for job: ${jobName}`,
          queueId: this.extractQueueId(error.response.headers?.location),
        };
      }
      throw error;
    }
  }

  private extractQueueId(location?: string): number | undefined {
    if (location) {
      const queueMatch = location.match(/\/queue\/item\/(\d+)/);
      if (queueMatch) {
        return parseInt(queueMatch[1]);
      }
    }
    return undefined;
  }

  private async triggerBuildWithCSRF(
    jobName: string,
    parameters?: Record<string, any>
  ): Promise<{ message: string; queueId?: number }> {
    const encodedJobName = encodeURIComponent(jobName);
    let endpoint = `/job/${encodedJobName}/build`;

    let postData = null;

    if (parameters && Object.keys(parameters).length > 0) {
      endpoint = `/job/${encodedJobName}/buildWithParameters`;

      // Convert parameters to form data
      const formData = new URLSearchParams();
      Object.entries(parameters).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      postData = formData.toString();
    }

    // Jenkins build trigger returns 201 status code and Location header with queue URL
    try {
      // Get CSRF crumb if available
      const crumb = await this.getCrumb();

      // Prepare headers
      const headers: any = {
        ...this.getHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      };

      // Add CSRF token if available (Jenkins expects it as a form parameter, not header)
      if (crumb) {
        // Add crumb to form data
        if (postData) {
          postData += `&${crumb.crumbRequestField}=${encodeURIComponent(crumb.crumb)}`;
        } else {
          postData = `${crumb.crumbRequestField}=${encodeURIComponent(crumb.crumb)}`;
        }
      }

      const response = await firstValueFrom(
        this.httpService.post(`${this.jenkinsUrl}${endpoint}`, postData, {
          headers,
          timeout: 30000,
        })
      );

      // Extract queue ID from Location header if available
      const location = response.headers?.location;
      let queueId: number | undefined;

      if (location) {
        const queueMatch = location.match(/\/queue\/item\/(\d+)/);
        if (queueMatch) {
          queueId = parseInt(queueMatch[1]);
        }
      }

      return {
        message: `Build triggered successfully for job: ${jobName}`,
        queueId,
      };
    } catch (error) {
      if (error.response?.status === 201) {
        // 201 is actually success for Jenkins build trigger
        const location = error.response.headers?.location;
        let queueId: number | undefined;

        if (location) {
          const queueMatch = location.match(/\/queue\/item\/(\d+)/);
          if (queueMatch) {
            queueId = parseInt(queueMatch[1]);
          }
        }

        return {
          message: `Build triggered successfully for job: ${jobName}`,
          queueId,
        };
      }

      // Handle specific error cases
      console.error(`Failed to trigger build for ${jobName}:`, error.message);

      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message;

        switch (status) {
          case 401:
            throw new HttpException(
              'Jenkins authentication failed. Please check your credentials.',
              HttpStatus.UNAUTHORIZED
            );
          case 403:
            throw new HttpException(
              `Jenkins access forbidden. This could be due to:\n1. Invalid credentials\n2. CSRF protection enabled (try enabling crumb issuer)\n3. Insufficient permissions for job: ${jobName}`,
              HttpStatus.FORBIDDEN
            );
          case 404:
            throw new HttpException(
              `Job '${jobName}' not found in Jenkins`,
              HttpStatus.NOT_FOUND
            );
          default:
            throw new HttpException(
              `Jenkins error (${status}): ${message}`,
              HttpStatus.BAD_GATEWAY
            );
        }
      }

      throw new HttpException(
        'Unable to connect to Jenkins server',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
