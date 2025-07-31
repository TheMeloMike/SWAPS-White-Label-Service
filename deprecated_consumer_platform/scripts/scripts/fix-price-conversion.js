#!/usr/bin/env node

/**
 * Fix Price Conversion - Convert lamports to SOL in collections database
 * This fixes the price display issue by converting existing lamports values to SOL
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const collectionsFile = path.join(dataDir, 'collections.json');
const backupFile = path.join(dataDir, 'collections-backup.json');

// Conversion constant
const LAMPORTS_PER_SOL = 1_000_000_000;

function convertPrices() {
  try {
    console.log('🔧 Starting price conversion from lamports to SOL...');
    
    if (!fs.existsSync(collectionsFile)) {
      console.error('❌ Collections file not found:', collectionsFile);
      return;
    }
    
    // Backup original file
    const originalData = fs.readFileSync(collectionsFile, 'utf8');
    fs.writeFileSync(backupFile, originalData);
    console.log('💾 Created backup at:', backupFile);
    
    // Parse data
    const collections = JSON.parse(originalData);
    let conversions = 0;
    
    // Convert lamports to SOL
    for (const [id, collection] of Object.entries(collections)) {
      let converted = false;
      
      // Convert floorPrice if it's in lamports (> 1000)
      if (collection.floorPrice && collection.floorPrice > 1000) {
        const solPrice = collection.floorPrice / LAMPORTS_PER_SOL;
        console.log(`   ${collection.name}: ${collection.floorPrice} lamports → ${solPrice.toFixed(4)} SOL`);
        collection.floorPrice = solPrice;
        converted = true;
      }
      
      // Convert volume24h if it's in lamports (> 1000)
      if (collection.volume24h && collection.volume24h > 1000) {
        const solVolume = collection.volume24h / LAMPORTS_PER_SOL;
        console.log(`   ${collection.name} volume: ${collection.volume24h} lamports → ${solVolume.toFixed(4)} SOL`);
        collection.volume24h = solVolume;
        converted = true;
      }
      
      if (converted) {
        conversions++;
        // Mark as converted
        if (!collection.metadata) collection.metadata = {};
        collection.metadata.priceConverted = true;
        collection.metadata.conversionDate = Date.now();
      }
    }
    
    // Save converted data
    fs.writeFileSync(collectionsFile, JSON.stringify(collections, null, 2));
    
    console.log(`✅ Conversion complete! Fixed ${conversions} collections`);
    console.log('💾 Updated database saved');
    console.log('🔄 Backend will pick up changes automatically');
    
  } catch (error) {
    console.error('❌ Error during conversion:', error.message);
  }
}

// Run conversion
convertPrices(); 