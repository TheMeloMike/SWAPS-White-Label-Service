// Test script to verify AI services can be loaded
const path = require('path');

console.log('Testing AI Services...\n');

// Test 1: Check if files exist
const fs = require('fs');
const aiOrchestratorPath = path.join(__dirname, 'src/services/ai/SwapsAIOrchestrator.ts');
const dataContextPath = path.join(__dirname, 'src/services/ai/DataContextService.ts');
const aiRoutesPath = path.join(__dirname, 'src/routes/ai.routes.ts');

console.log('File existence check:');
console.log('- SwapsAIOrchestrator.ts:', fs.existsSync(aiOrchestratorPath) ? '✓' : '✗');
console.log('- DataContextService.ts:', fs.existsSync(dataContextPath) ? '✓' : '✗');
console.log('- ai.routes.ts:', fs.existsSync(aiRoutesPath) ? '✓' : '✗');

// Test 2: Try to require the compiled JS files
console.log('\nCompiled file check:');
try {
  const compiledOrchestrator = path.join(__dirname, 'dist/services/ai/SwapsAIOrchestrator.js');
  const compiledDataContext = path.join(__dirname, 'dist/services/ai/DataContextService.js');
  const compiledRoutes = path.join(__dirname, 'dist/routes/ai.routes.js');
  
  console.log('- SwapsAIOrchestrator.js:', fs.existsSync(compiledOrchestrator) ? '✓' : '✗ (needs compilation)');
  console.log('- DataContextService.js:', fs.existsSync(compiledDataContext) ? '✓' : '✗ (needs compilation)');
  console.log('- ai.routes.js:', fs.existsSync(compiledRoutes) ? '✓' : '✗ (needs compilation)');
} catch (error) {
  console.log('Error checking compiled files:', error.message);
}

console.log('\nRecommendation:');
console.log('If compiled files are missing, run: npm run build');
console.log('Or ensure the backend is running with: npm run dev'); 