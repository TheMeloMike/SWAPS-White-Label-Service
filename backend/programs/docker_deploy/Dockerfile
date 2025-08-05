# Use Solana's official build environment
FROM ubuntu:20.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libudev-dev \
    llvm \
    libclang-dev \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Rust (specific version for Solana compatibility)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.70.0
ENV PATH="/root/.cargo/bin:$PATH"

# Install Solana CLI (specific version for compatibility)
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.16.8/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy smart contract source
COPY swap/ ./swap/

# Set working directory to smart contract
WORKDIR /app/swap

# Build the smart contract
RUN cargo build-sbf

# Copy deployment script
COPY deploy.sh ./
RUN chmod +x deploy.sh

# Default command
CMD ["./deploy.sh"]