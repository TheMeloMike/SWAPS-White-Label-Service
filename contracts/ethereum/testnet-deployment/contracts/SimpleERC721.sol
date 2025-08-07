// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title SimpleERC721
 * @dev Simple ERC721 contract for testing SWAPS multi-party NFT swaps
 */
contract SimpleERC721 is ERC721 {
    uint256 private _tokenIdCounter = 1;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function mint(address to, uint256 tokenId) public {
        _mint(to, tokenId);
    }

    function mintNext(address to) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter++;
        _mint(to, tokenId);
        return tokenId;
    }

    function batchMint(address[] calldata recipients) public {
        for (uint256 i = 0; i < recipients.length; i++) {
            mintNext(recipients[i]);
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721: URI query for nonexistent token");
        return string(abi.encodePacked("https://api.swaps.com/nft/", _toString(tokenId)));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}