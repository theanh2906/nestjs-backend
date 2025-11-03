export enum MessageType {
  NOTE_SYNC = 'note-sync',
}

export type RabbitMessage = {
  type: MessageType;
  data: any;
  timestamp: number;
};

export enum SseEvent {
  MonitorReport = 'monitor-report',
  BuildLog = 'build-log',
  JenkinsMonitoring = 'jenkins-monitoring',
}
