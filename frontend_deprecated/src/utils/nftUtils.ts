/**
 * NFT related utility functions
 */

/**
 * Extracts a collection name from various possible NFT metadata formats.
 * 
 * Order of preference:
 * 1. From `collection.name` if `collection` is an object.
 * 2. From the NFT's `symbol` property if available.
 * 3. By parsing the `nftName` (e.g., "Collection Name #123" -> "Collection Name").
 * 4. Defaults to "Unknown Collection".
 * 
 * @param collection - The collection property from NFT metadata (string | object | undefined).
 * @param nftName - The name property from NFT metadata (string | undefined).
 * @param symbol - The symbol property from NFT metadata (string | undefined).
 * @returns The extracted collection name string.
 */
export const getCollectionName = (
    collection: string | { name: string; address?: string } | undefined,
    nftName?: string,
    symbol?: string
): string => {
    // 1. Try object format
    if (typeof collection === 'object' && collection?.name) {
        return collection.name;
    }

    // 2. Use symbol if available (many NFTs use symbol as collection identifier)
    if (symbol) {
        return symbol;
    }

    // 3. Try extracting from NFT name (e.g., "Collection Name #123")
    if (nftName) {
        const parts = nftName.split('#');
        if (parts.length > 1) {
            const extractedName = parts[0].trim();
            // Return extracted name only if it's not empty
            if (extractedName) {
                return extractedName;
            }
        }
    }

    // 4. Default
    return 'Unknown Collection';
}; 