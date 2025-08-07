// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title MockERC1155
 * @dev Mock ERC1155 contract for testing SWAPS multi-party NFT swaps
 * 
 * Features:
 * - Standard ERC1155 functionality
 * - Owner can mint tokens to any address
 * - Supply tracking for testing
 * - Batch operations support
 * - Simple metadata support
 */
contract MockERC1155 is ERC1155, ERC1155Supply, Ownable {
    string public name = "SWAPS Test ERC1155";
    string public symbol = "STE1155";
    
    // Mapping from token ID to token name
    mapping(uint256 => string) private _tokenNames;
    
    // Mapping from token ID to whether it exists
    mapping(uint256 => bool) private _tokenExists;

    constructor(string memory baseURI) ERC1155(baseURI) {}

    /**
     * @dev Mint tokens to a specific address
     * @param to Address to mint tokens to
     * @param id Token ID to mint
     * @param amount Amount of tokens to mint
     * @param data Additional data for the mint
     */
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public onlyOwner {
        _mint(to, id, amount, data);
        _tokenExists[id] = true;
    }

    /**
     * @dev Batch mint tokens to a specific address
     * @param to Address to mint tokens to
     * @param ids Array of token IDs to mint
     * @param amounts Array of amounts to mint
     * @param data Additional data for the mint
     */
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public onlyOwner {
        _mintBatch(to, ids, amounts, data);
        
        for (uint256 i = 0; i < ids.length; i++) {
            _tokenExists[ids[i]] = true;
        }
    }

    /**
     * @dev Mint the same token to multiple addresses
     * @param recipients Array of addresses to mint to
     * @param id Token ID to mint
     * @param amounts Array of amounts to mint to each recipient
     * @param data Additional data for the mint
     */
    function mintToMultiple(
        address[] calldata recipients,
        uint256 id,
        uint256[] calldata amounts,
        bytes memory data
    ) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], id, amounts[i], data);
        }
        
        _tokenExists[id] = true;
    }

    /**
     * @dev Set the name for a specific token ID
     * @param id Token ID
     * @param tokenName Name for the token
     */
    function setTokenName(uint256 id, string calldata tokenName) external onlyOwner {
        _tokenNames[id] = tokenName;
        _tokenExists[id] = true;
    }

    /**
     * @dev Get the name for a specific token ID
     * @param id Token ID
     */
    function getTokenName(uint256 id) external view returns (string memory) {
        return _tokenNames[id];
    }

    /**
     * @dev Check if a token ID exists
     * @param id Token ID to check
     */
    function exists(uint256 id) public view override returns (bool) {
        return _tokenExists[id];
    }

    /**
     * @dev Set URI for all tokens
     * @param newuri New URI to set
     */
    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    /**
     * @dev Get URI for a specific token
     * @param id Token ID
     */
    function uri(uint256 id) public view override returns (string memory) {
        return string(abi.encodePacked(super.uri(id), Strings.toString(id)));
    }

    /**
     * @dev Get balances for multiple tokens for a single owner
     * @param owner Address to check balances for
     * @param ids Array of token IDs to check
     */
    function balanceOfBatch(address owner, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory batchBalances = new uint256[](ids.length);
        
        for (uint256 i = 0; i < ids.length; i++) {
            batchBalances[i] = balanceOf(owner, ids[i]);
        }
        
        return batchBalances;
    }

    /**
     * @dev Get all token IDs that an address owns (with non-zero balance)
     * @param owner Address to check
     * @param maxTokenId Maximum token ID to check (for gas efficiency)
     */
    function getOwnedTokens(address owner, uint256 maxTokenId) 
        external 
        view 
        returns (uint256[] memory tokenIds, uint256[] memory amounts) 
    {
        // First, count how many tokens the owner has
        uint256 ownedCount = 0;
        for (uint256 i = 1; i <= maxTokenId; i++) {
            if (balanceOf(owner, i) > 0) {
                ownedCount++;
            }
        }
        
        // Create arrays with the correct size
        tokenIds = new uint256[](ownedCount);
        amounts = new uint256[](ownedCount);
        
        // Fill the arrays
        uint256 index = 0;
        for (uint256 i = 1; i <= maxTokenId; i++) {
            uint256 balance = balanceOf(owner, i);
            if (balance > 0) {
                tokenIds[index] = i;
                amounts[index] = balance;
                index++;
            }
        }
    }

    /**
     * @dev Emergency function to approve SWAPS contract for all tokens
     * Useful for quick testing setup
     */
    function approveSwapsContract(address swapsContract, address owner) external onlyOwner {
        _setApprovalForAll(owner, swapsContract, true);
    }

    /**
     * @dev Create test tokens with predefined data
     * Useful for quick testing setup
     */
    function createTestTokens() external onlyOwner {
        // Create some test tokens with names
        _tokenNames[1] = "Test Sword";
        _tokenNames[2] = "Test Shield"; 
        _tokenNames[3] = "Test Potion";
        _tokenNames[4] = "Test Armor";
        _tokenNames[5] = "Test Ring";
        
        // Mark them as existing
        for (uint256 i = 1; i <= 5; i++) {
            _tokenExists[i] = true;
        }
    }

    /**
     * @dev Get contract info for testing
     */
    function getContractInfo() external view returns (
        string memory contractName,
        string memory contractSymbol,
        string memory baseURI
    ) {
        return (
            name,
            symbol,
            super.uri(0)
        );
    }

    /**
     * @dev Burn tokens (for testing purposes)
     * @param from Address to burn from
     * @param id Token ID to burn
     * @param amount Amount to burn
     */
    function burn(
        address from,
        uint256 id,
        uint256 amount
    ) external onlyOwner {
        _burn(from, id, amount);
    }

    /**
     * @dev Batch burn tokens (for testing purposes)
     * @param from Address to burn from
     * @param ids Array of token IDs to burn
     * @param amounts Array of amounts to burn
     */
    function burnBatch(
        address from,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external onlyOwner {
        _burnBatch(from, ids, amounts);
    }

    // Override required functions
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}