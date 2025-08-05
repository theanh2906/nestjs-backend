import { Test, TestingModule } from '@nestjs/testing';
import { KafkaService } from './src/services/kafka.service';

// Mock environment variables for testing
process.env.NODE_ENV = 'local';
process.env.KAFKA_CLIENT_ID = 'test-kafka-client';
process.env.KAFKA_BROKERS = 'localhost:9092';
process.env.KAFKA_SSL = 'false';

async function testKafkaService() {
  console.log('[DEBUG_LOG] Starting Kafka service test...');

  try {
    // Create test module
    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaService],
    }).compile();

    const kafkaService = module.get<KafkaService>(KafkaService);
    console.log('[DEBUG_LOG] KafkaService instance created successfully');

    // Test 1: Check initial connection status
    console.log('[DEBUG_LOG] Test 1: Checking initial connection status');
    const initialStatus = kafkaService.isKafkaConnected();
    console.log(`[DEBUG_LOG] Initial connection status: ${initialStatus}`);

    // Test 2: Health check when not connected
    console.log('[DEBUG_LOG] Test 2: Health check when not connected');
    const healthCheck1 = await kafkaService.healthCheck();
    console.log(
      `[DEBUG_LOG] Health check result: ${JSON.stringify(healthCheck1)}`
    );

    // Test 3: Try to connect (this will likely fail without a running Kafka instance)
    console.log('[DEBUG_LOG] Test 3: Attempting to connect to Kafka');
    try {
      await kafkaService.connect();
      console.log('[DEBUG_LOG] Successfully connected to Kafka');

      // Test 4: Check connection status after connect
      const connectedStatus = kafkaService.isKafkaConnected();
      console.log(
        `[DEBUG_LOG] Connection status after connect: ${connectedStatus}`
      );

      // Test 5: Health check when connected
      const healthCheck2 = await kafkaService.healthCheck();
      console.log(
        `[DEBUG_LOG] Health check when connected: ${JSON.stringify(healthCheck2)}`
      );

      // Test 6: List topics
      console.log('[DEBUG_LOG] Test 6: Listing topics');
      const topics = await kafkaService.listTopics();
      console.log(`[DEBUG_LOG] Topics found: ${JSON.stringify(topics)}`);

      // Test 7: Create a test topic
      console.log('[DEBUG_LOG] Test 7: Creating test topic');
      await kafkaService.createTopicIfNotExists({
        topic: 'test-topic',
        numPartitions: 3,
        replicationFactor: 1,
      });
      console.log('[DEBUG_LOG] Test topic created successfully');

      // Test 8: Get topic metadata
      console.log('[DEBUG_LOG] Test 8: Getting topic metadata');
      const metadata = await kafkaService.getTopicMetadata(['test-topic']);
      console.log(
        `[DEBUG_LOG] Topic metadata: ${JSON.stringify(metadata, null, 2)}`
      );

      // Test 9: Publish a message
      console.log('[DEBUG_LOG] Test 9: Publishing a test message');
      await kafkaService.publishSingleMessage(
        'test-topic',
        'Hello Kafka!',
        'test-key'
      );
      console.log('[DEBUG_LOG] Message published successfully');

      // Test 10: List consumer groups
      console.log('[DEBUG_LOG] Test 10: Listing consumer groups');
      const groups = await kafkaService.listConsumerGroups();
      console.log(`[DEBUG_LOG] Consumer groups: ${JSON.stringify(groups)}`);

      // Test 11: Get cluster info
      console.log('[DEBUG_LOG] Test 11: Getting cluster information');
      const clusterInfo = await kafkaService.getClusterInfo();
      console.log(
        `[DEBUG_LOG] Cluster info: ${JSON.stringify(clusterInfo, null, 2)}`
      );

      // Test 12: Start consuming messages (for a short time)
      console.log('[DEBUG_LOG] Test 12: Starting message consumer');
      const messageHandler = async (payload: any) => {
        console.log(
          `[DEBUG_LOG] Received message: ${payload.message.value.toString()}`
        );
      };

      await kafkaService.consumeMessages(
        {
          topic: 'test-topic',
          groupId: 'test-consumer-group',
          fromBeginning: true,
        },
        messageHandler
      );
      console.log('[DEBUG_LOG] Consumer started successfully');

      // Wait a bit to see if we receive any messages
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Test 13: Stop consumer
      console.log('[DEBUG_LOG] Test 13: Stopping consumer');
      await kafkaService.stopConsumer('test-consumer-group');
      console.log('[DEBUG_LOG] Consumer stopped successfully');

      // Test 14: Clean up - delete test topic
      console.log('[DEBUG_LOG] Test 14: Cleaning up - deleting test topic');
      await kafkaService.deleteTopic('test-topic');
      console.log('[DEBUG_LOG] Test topic deleted successfully');

      // Test 15: Disconnect
      console.log('[DEBUG_LOG] Test 15: Disconnecting from Kafka');
      await kafkaService.disconnect();
      console.log('[DEBUG_LOG] Disconnected successfully');
    } catch (connectError) {
      console.log(
        `[DEBUG_LOG] Connection failed (expected if Kafka is not running): ${connectError.message}`
      );

      // Test error handling methods
      console.log('[DEBUG_LOG] Testing error handling for disconnected state');

      try {
        await kafkaService.publishSingleMessage('test-topic', 'test');
      } catch (error) {
        console.log(
          `[DEBUG_LOG] Expected error for publish when disconnected: ${error.message}`
        );
      }

      try {
        await kafkaService.listTopics();
      } catch (error) {
        console.log(
          `[DEBUG_LOG] Expected error for listTopics when disconnected: ${error.message}`
        );
      }
    }

    console.log('[DEBUG_LOG] All tests completed successfully!');
  } catch (error) {
    console.error('[DEBUG_LOG] Test failed:', error);
    throw error;
  }
}

// Run the test
testKafkaService()
  .then(() => {
    console.log('[DEBUG_LOG] Kafka service test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[DEBUG_LOG] Kafka service test failed:', error);
    process.exit(1);
  });
