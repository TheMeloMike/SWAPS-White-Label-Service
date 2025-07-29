#!/bin/bash
# Create a completely new standalone frontend for SWAPS
# This bypasses all existing dependency issues

# Set colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROOT_DIR=$(pwd)
FRONTEND_NEW="${ROOT_DIR}/frontend_new"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Creating standalone SWAPS frontend${NC}"
echo -e "${GREEN}=========================================${NC}"

# Create new frontend directory 
echo -e "${BLUE}Creating fresh frontend directory...${NC}"
mkdir -p "${FRONTEND_NEW}"
cd "${FRONTEND_NEW}"

# Copy source code but not dependencies
echo -e "${BLUE}Copying source code from original frontend...${NC}"
mkdir -p src public
cp -r "${ROOT_DIR}/frontend/src/"* src/
cp -r "${ROOT_DIR}/frontend/public/"* public/ 2>/dev/null || true

# Create package.json with the latest versions
echo -e "${BLUE}Creating modern package.json...${NC}"
cat > package.json << EOF
{
  "name": "swaps-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@metaplex-foundation/js": "^0.19.4",
    "@solana/wallet-adapter-base": "^0.9.23",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-react-ui": "^0.9.34",
    "@solana/wallet-adapter-wallets": "^0.19.25",
    "@solana/web3.js": "^1.89.1",
    "axios": "^1.6.7",
    "bn.js": "^5.2.1",
    "glob-to-regexp": "^0.4.1",
    "next": "13.5.6",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-icons": "^5.0.1",
    "styled-components": "^6.1.8"
  },
  "devDependencies": {
    "@types/node": "^20.11.16",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "typescript": "^5.3.3"
  }
}
EOF

# Create a tsconfig.json file
echo -e "${BLUE}Creating TypeScript config...${NC}"
cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
EOF

# Create next config
echo -e "${BLUE}Creating Next.js config...${NC}"
cat > next.config.js << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    styledComponents: true
  }
}

module.exports = nextConfig
EOF

# Create .npmrc
echo -e "${BLUE}Creating .npmrc...${NC}"
cat > .npmrc << EOF
legacy-peer-deps=true
fund=false
audit=false
EOF

# Create environment file
echo -e "${BLUE}Creating environment file...${NC}"
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_HELIUS_API_KEY=b9bab9a3-f168-4cdc-9a82-e3509dbc86e7
EOF

# Install dependencies
echo -e "${YELLOW}Installing fresh dependencies (this may take a moment)...${NC}"
npm install > "${ROOT_DIR}/logs/frontend_new_install.log" 2>&1

# Create starter script
echo -e "${BLUE}Creating startup script...${NC}"
cat > "${ROOT_DIR}/run-swaps-frontend-new.sh" << EOF
#!/bin/bash
# Run the new standalone frontend

cd "${FRONTEND_NEW}"
npm run dev
EOF

chmod +x "${ROOT_DIR}/run-swaps-frontend-new.sh"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Standalone frontend setup complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo -e "To start the new frontend:"
echo -e "${BLUE}./run-swaps-frontend-new.sh${NC}"
echo -e "It will connect to the backend running on port 3001" 