#!/bin/bash

echo "🚀 Setting up Kafka for SWAPS Local Development"
echo "================================================"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed or not in PATH"
    echo "Please install Docker Compose or use 'docker compose' instead"
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found in current directory"
    echo "Please run this script from the SWAPS project root"
    exit 1
fi

echo "✅ Found docker-compose.yml"

# Start Kafka infrastructure
echo ""
echo "🔧 Starting Kafka infrastructure..."
echo "This will start: Zookeeper, Kafka, and Redis"

# Start only the required services for Kafka
docker-compose up -d zookeeper kafka redis

echo ""
echo "⏳ Waiting for services to be healthy..."

# Wait for Zookeeper
echo "Checking Zookeeper health..."
for i in {1..30}; do
    if docker-compose exec -T zookeeper nc -z localhost 2181 2>/dev/null; then
        echo "✅ Zookeeper is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Zookeeper failed to start"
        docker-compose logs zookeeper
        exit 1
    fi
    echo "  ... waiting (${i}/30)"
    sleep 2
done

# Wait for Kafka
echo "Checking Kafka health..."
for i in {1..30}; do
    if docker-compose exec -T kafka nc -z localhost 9092 2>/dev/null; then
        echo "✅ Kafka is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Kafka failed to start"
        docker-compose logs kafka
        exit 1
    fi
    echo "  ... waiting (${i}/30)"
    sleep 2
done

# Wait for Redis
echo "Checking Redis health..."
for i in {1..30}; do
    if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "✅ Redis is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Redis failed to start"
        docker-compose logs redis
        exit 1
    fi
    echo "  ... waiting (${i}/30)"
    sleep 2
done

echo ""
echo "🎉 Kafka infrastructure is ready!"
echo ""
echo "📋 Service Status:"
docker-compose ps zookeeper kafka redis

echo ""
echo "🔍 Testing Kafka integration..."
node kafka-integration-test.js

echo ""
echo "✅ Kafka Setup Complete!"
echo ""
echo "🔧 Next Steps:"
echo "1. Set environment variable: export ENABLE_KAFKA=true"
echo "2. Start your SWAPS backend with Kafka enabled"
echo "3. Monitor logs for Kafka integration status"
echo ""
echo "📊 Useful Commands:"
echo "- View logs: docker-compose logs -f kafka"
echo "- Stop services: docker-compose down"
echo "- Restart: docker-compose restart kafka"
echo ""
echo "🌐 Access Points:"
echo "- Kafka: localhost:9092"
echo "- Zookeeper: localhost:2181" 
echo "- Redis: localhost:6379" 