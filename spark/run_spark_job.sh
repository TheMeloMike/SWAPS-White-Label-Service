#!/bin/bash

# Exit on error
set -e

# Configuration
SPARK_MASTER=${SPARK_MASTER:-"local[*]"}
SPARK_MEMORY=${SPARK_MEMORY:-"4g"}
EXPORT_PATH=${EXPORT_PATH:-"../data/export"}
OUTPUT_PATH=${OUTPUT_PATH:-"../data/spark-output"}

# Check if necessary directories exist
if [ ! -d "$EXPORT_PATH" ]; then
  echo "Creating export directory: $EXPORT_PATH"
  mkdir -p "$EXPORT_PATH"
fi

if [ ! -d "$OUTPUT_PATH" ]; then
  echo "Creating output directory: $OUTPUT_PATH"
  mkdir -p "$OUTPUT_PATH"
fi

# Export data from backend to Parquet format
echo "Exporting data from backend..."
cd ../backend
npm run export:data --wallets="$EXPORT_PATH/wallets.parquet" --nfts="$EXPORT_PATH/nft_ownership.parquet" --wanted="$EXPORT_PATH/wanted_nfts.parquet"
cd -

# Build the Spark application
echo "Building Spark application..."
sbt clean assembly

# Run the Spark job
echo "Running Spark job with master: $SPARK_MASTER"
spark-submit \
  --master $SPARK_MASTER \
  --deploy-mode client \
  --driver-memory $SPARK_MEMORY \
  --executor-memory $SPARK_MEMORY \
  --class com.swaps.spark.TradeLoopSpark \
  target/scala-2.12/swaps-spark-assembly.jar \
  "$EXPORT_PATH/wallets.parquet" \
  "$EXPORT_PATH/nft_ownership.parquet" \
  "$EXPORT_PATH/wanted_nfts.parquet" \
  "$OUTPUT_PATH/trade_loops.parquet"

echo "Spark job completed. Results saved to $OUTPUT_PATH/trade_loops.parquet"

# Import results back to the backend
echo "Importing results back to backend..."
cd ../backend
npm run import:trades --source="$OUTPUT_PATH/trade_loops.parquet"
cd -

echo "Process completed successfully." 