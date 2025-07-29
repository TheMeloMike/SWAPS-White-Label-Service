declare module 'kafkajs' {
  export interface KafkaConfig {
    clientId: string;
    brokers: string[];
    ssl?: boolean;
    sasl?: {
      mechanism: string;
      username: string;
      password: string;
    };
    retry?: {
      initialRetryTime?: number;
      retries?: number;
    };
  }

  export interface ProducerConfig {
    createPartitioner?: () => any;
    retry?: {
      initialRetryTime?: number;
      retries?: number;
    };
    metadataMaxAge?: number;
    allowAutoTopicCreation?: boolean;
    transactionalId?: string;
    idempotent?: boolean;
    maxInFlightRequests?: number;
  }

  export interface ConsumerConfig {
    groupId: string;
    partitionAssigners?: any[];
    sessionTimeout?: number;
    rebalanceTimeout?: number;
    heartbeatInterval?: number;
    metadataMaxAge?: number;
    allowAutoTopicCreation?: boolean;
    maxBytesPerPartition?: number;
    minBytes?: number;
    maxBytes?: number;
    maxWaitTimeInMs?: number;
    retry?: {
      initialRetryTime?: number;
      retries?: number;
    };
    readUncommitted?: boolean;
  }

  export interface KafkaMessage {
    key?: Buffer | string | null;
    value: Buffer | string | null;
    timestamp?: string;
    headers?: Record<string, string | Buffer>;
  }

  export interface TopicMessages {
    topic: string;
    messages: KafkaMessage[];
  }

  export interface EachMessagePayload {
    topic: string;
    partition: number;
    message: KafkaMessage;
  }

  export interface ConsumerRunConfig {
    eachMessage: (payload: EachMessagePayload) => Promise<void>;
  }

  export interface ConsumerSubscribeTopics {
    topics: string | RegExp | Array<string | RegExp>;
    fromBeginning?: boolean;
  }

  export class Producer {
    constructor(config?: ProducerConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(record: TopicMessages): Promise<void>;
  }

  export class Consumer {
    constructor(config: ConsumerConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    subscribe(subscription: ConsumerSubscribeTopics): Promise<void>;
    run(config: ConsumerRunConfig): Promise<void>;
  }

  export class Kafka {
    constructor(config: KafkaConfig);
    producer(config?: ProducerConfig): Producer;
    consumer(config: ConsumerConfig): Consumer;
  }
} 