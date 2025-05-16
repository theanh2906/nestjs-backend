import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { Request } from 'express';

@Controller('/api/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  // These should be in environment variables in production
  private readonly githubSecret = 'your-github-webhook-secret';
  private readonly gitlabSecret = 'your-gitlab-webhook-secret';
  private readonly bitbucketSecret = 'your-bitbucket-webhook-secret';

  @Post('github')
  async handleGithubWebhook(
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Body() payload: any,
    @Req() request: Request
  ) {
    // Verify webhook signature
    this.verifyGithubSignature(request.body, signature);

    this.logger.log(`Received GitHub webhook: ${event}`);

    // Handle different event types
    switch (event) {
      case 'push':
        return this.handleGithubPush(payload);
      case 'pull_request':
        return this.handleGithubPullRequest(payload);
      default:
        this.logger.log(`Unhandled GitHub event: ${event}`);
        return { status: 'received', event };
    }
  }

  @Post('gitlab')
  async handleGitlabWebhook(
    @Headers('x-gitlab-token') token: string,
    @Headers('x-gitlab-event') event: string,
    @Body() payload: any
  ) {
    // Verify webhook token
    if (token !== this.gitlabSecret) {
      throw new UnauthorizedException('Invalid GitLab webhook token');
    }

    this.logger.log(`Received GitLab webhook: ${event}`);

    // Handle different event types
    switch (payload.object_kind) {
      case 'push':
        return this.handleGitlabPush(payload);
      case 'merge_request':
        return this.handleGitlabMergeRequest(payload);
      default:
        this.logger.log(`Unhandled GitLab event: ${payload.object_kind}`);
        return { status: 'received', event: payload.object_kind };
    }
  }

  @Post('bitbucket')
  async handleBitbucketWebhook(
    @Headers('x-hub-signature') signature: string,
    @Headers('x-event-key') event: string,
    @Body() payload: any,
    @Req() request: Request
  ) {
    // Verify webhook signature
    this.verifyBitbucketSignature(request.body, signature);

    this.logger.log(`Received Bitbucket webhook: ${event}`);

    // Handle different event types
    switch (event) {
      case 'repo:push':
        return this.handleBitbucketPush(payload);
      case 'pullrequest:created':
      case 'pullrequest:updated':
        return this.handleBitbucketPullRequest(payload);
      default:
        this.logger.log(`Unhandled Bitbucket event: ${event}`);
        return { status: 'received', event };
    }
  }

  // Helper methods for event handling
  private handleGithubPush(payload: any) {
    const repository = payload.repository?.full_name;
    const branch = payload.ref?.replace('refs/heads/', '');
    this.logger.log(`GitHub push event to ${repository}:${branch}`);

    // Implement your logic here
    return { status: 'processed', event: 'push' };
  }

  private handleGithubPullRequest(payload: any) {
    const action = payload.action;
    const prNumber = payload.number;
    const repository = payload.repository?.full_name;
    this.logger.log(`GitHub PR #${prNumber} ${action} on ${repository}`);

    // Implement your logic here
    return { status: 'processed', event: 'pull_request' };
  }

  private handleGitlabPush(payload: any) {
    const repository = payload.project?.path_with_namespace;
    const branch = payload.ref?.replace('refs/heads/', '');
    this.logger.log(`GitLab push event to ${repository}:${branch}`);

    // Implement your logic here
    return { status: 'processed', event: 'push' };
  }

  private handleGitlabMergeRequest(payload: any) {
    const action = payload.object_attributes?.action;
    const mrNumber = payload.object_attributes?.iid;
    const repository = payload.project?.path_with_namespace;
    this.logger.log(`GitLab MR #${mrNumber} ${action} on ${repository}`);

    // Implement your logic here
    return { status: 'processed', event: 'merge_request' };
  }

  private handleBitbucketPush(payload: any) {
    const repository = payload.repository?.full_name;
    const changes = payload.push?.changes || [];
    this.logger.log(
      `Bitbucket push event to ${repository} with ${changes.length} changes`
    );

    // Implement your logic here
    return { status: 'processed', event: 'push' };
  }

  private handleBitbucketPullRequest(payload: any) {
    const action = payload.pullrequest?.state;
    const prNumber = payload.pullrequest?.id;
    const repository = payload.repository?.full_name;
    this.logger.log(`Bitbucket PR #${prNumber} ${action} on ${repository}`);

    // Implement your logic here
    return { status: 'processed', event: 'pull_request' };
  }

  // Signature verification methods
  private verifyGithubSignature(payload: Buffer, signature: string) {
    if (!signature) {
      throw new UnauthorizedException('Missing GitHub signature');
    }

    const hmac = createHmac('sha256', this.githubSecret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    if (signature !== digest) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }
  }

  private verifyBitbucketSignature(payload: Buffer, signature: string) {
    if (!signature) {
      throw new UnauthorizedException('Missing Bitbucket signature');
    }

    const hmac = createHmac('sha256', this.bitbucketSecret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    if (signature !== digest) {
      throw new UnauthorizedException('Invalid Bitbucket webhook signature');
    }
  }
}
