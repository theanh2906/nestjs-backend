export enum MessageType {
  NOTE_SYNC = 'note-sync',
}

export type RabbitMessage = {
  type: MessageType;
  data: any;
  timestamp: number;
};
