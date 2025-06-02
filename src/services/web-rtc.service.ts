import { Injectable } from '@nestjs/common';
import * as wrtc from 'wrtc';

@Injectable()
export class WebRtcService {
  private peerConnections: Map<string, wrtc.RTCPeerConnection> = new Map();
  private dataChannels: Map<string, wrtc.RTCDataChannel> = new Map();
  // In-memory buffer for file chunks per session
  private fileBuffers: Map<string, Buffer[]> = new Map();

  async createPeerConnection(
    sessionId: string
  ): Promise<wrtc.RTCPeerConnection> {
    const peerConnection = new wrtc.RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnection.onicecandidate = (event) => {
      // You should emit this candidate to the client via signaling
      // Example: this.emitIceCandidate(sessionId, event.candidate);
    };

    peerConnection.ondatachannel = (event) => {
      this.dataChannels.set(sessionId, event.channel);
      // Optionally, set up event.channel.onmessage, etc.
    };

    this.peerConnections.set(sessionId, peerConnection);
    return peerConnection;
  }

  async handleOffer(sessionId: string, offer: any): Promise<any> {
    let peerConnection = this.peerConnections.get(sessionId);
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(sessionId);
    }
    await peerConnection.setRemoteDescription(
      new wrtc.RTCSessionDescription(offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(sessionId: string, answer: any): Promise<void> {
    const peerConnection = this.peerConnections.get(sessionId);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(
        new wrtc.RTCSessionDescription(answer)
      );
    }
  }

  async handleIceCandidate(sessionId: string, candidate: any): Promise<void> {
    const peerConnection = this.peerConnections.get(sessionId);
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
    }
  }

  // Called when a chunk is received from the DataChannel
  async handleReceivedChunk(
    sessionId: string,
    chunk: Buffer,
    isLastChunk: boolean
  ): Promise<Buffer | null> {
    if (!this.fileBuffers.has(sessionId)) {
      this.fileBuffers.set(sessionId, []);
    }
    this.fileBuffers.get(sessionId)!.push(chunk);
    if (isLastChunk) {
      const fileBuffer = Buffer.concat(this.fileBuffers.get(sessionId)!);
      this.fileBuffers.delete(sessionId);
      // Here you can save fileBuffer to disk or process it
      return fileBuffer;
    }
    return null;
  }

  async initiateFileSync(sessionId: string, fileMeta: any): Promise<void> {
    let peerConnection = this.peerConnections.get(sessionId);
    if (!peerConnection) {
      peerConnection = await this.createPeerConnection(sessionId);
    }
    const dataChannel = peerConnection.createDataChannel('fileSync');
    this.dataChannels.set(sessionId, dataChannel);
    // Set up DataChannel to receive file chunks
    dataChannel.onmessage = async (event) => {
      // Assume the client sends { chunk: Buffer, isLastChunk: boolean } as JSON string
      const { chunk, isLastChunk } = JSON.parse(event.data);
      const buffer = Buffer.from(chunk.data);
      const file = await this.handleReceivedChunk(
        sessionId,
        buffer,
        isLastChunk
      );
      if (file) {
        // File fully received, handle as needed
        // e.g., save to disk or emit event
      }
    };
    // Optionally, send fileMeta to the client
    if (dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify({ fileMeta }));
    } else {
      dataChannel.onopen = () => {
        dataChannel.send(JSON.stringify({ fileMeta }));
      };
    }
  }

  async sendFileChunk(sessionId: string, chunk: Buffer): Promise<void> {
    const dataChannel = this.dataChannels.get(sessionId);
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(chunk);
    }
  }

  async closeConnection(sessionId: string): Promise<void> {
    const peerConnection = this.peerConnections.get(sessionId);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(sessionId);
    }
    this.dataChannels.delete(sessionId);
  }
}
