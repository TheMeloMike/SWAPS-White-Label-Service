// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC721
 * @dev Mock ERC721 contract for testing SWAPS multi-party NFT swaps
 * 
 * Features:
 * - Standard ERC721 functionality
 * - Owner can mint tokens to any address
 * - Enumerable for easy testing
 * - Simple metadata support
 */
contract MockERC721 is ERC721, ERC721Enumerable, Ownable {
    using Strings for uint256;

    string private _baseTokenURI;
    uint256 private _nextTokenId = 1;

    constructor(
        string memory name,
        string memory symbol
    ) ERC721(name, symbol) {
        _baseTokenURI = "https://api.swaps.com/nft/";
    }

    /**
     * @dev Mint a token to a specific address
     * @param to Address to mint the token to
     * @param tokenId Specific token ID to mint
     */
    function mint(address to, uint256 tokenId) public onlyOwner {
        _safeMint(to, tokenId);
    }

    /**
     * @dev Mint next available token to address
     * @param to Address to mint the token to
     */
    function mintNext(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /**
     * @dev Batch mint tokens to multiple addresses
     * @param recipients Array of addresses to mint to
     */
    function batchMint(address[] calldata recipients) public onlyOwner {
        for (uint256 i = 0; i < recipients.length; i++) {
            mintNext(recipients[i]);
        }
    }

    /**
     * @dev Set base URI for token metadata
     * @param baseURI New base URI
     */
    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    /**
     * @dev Returns the base URI for tokens
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev Returns the token URI for a given token ID
     * @param tokenId Token ID to get URI for
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721: URI query for nonexistent token");
        
        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 
            ? string(abi.encodePacked(baseURI, tokenId.toString()))
            : "";
    }

    /**
     * @dev Get all tokens owned by an address
     * @param owner Address to get tokens for
     */
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokens = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            tokens[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokens;
    }

    /**
     * @dev Check if token exists
     * @param tokenId Token ID to check
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }

    // Override required functions
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**
     * @dev Emergency function to approve SWAPS contract for all tokens
     * Useful for quick testing setup
     */
    function approveSwapsContract(address swapsContract) external onlyOwner {
        setApprovalForAll(swapsContract, true);
    }

    /**
     * @dev Get contract info for testing
     */
    function getContractInfo() external view returns (
        string memory contractName,
        string memory contractSymbol,
        uint256 totalTokens,
        string memory baseURI
    ) {
        return (
            name(),
            symbol(),
            totalSupply(),
            _baseTokenURI
        );
    }
}