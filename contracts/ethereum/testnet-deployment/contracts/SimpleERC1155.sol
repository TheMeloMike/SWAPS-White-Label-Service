// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title SimpleERC1155
 * @dev Simple ERC1155 contract for testing SWAPS multi-party NFT swaps
 */
contract SimpleERC1155 is ERC1155 {
    string public name = "SWAPS Test ERC1155";
    string public symbol = "STE1155";

    constructor(string memory baseURI) ERC1155(baseURI) {}

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public {
        _mint(to, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public {
        _mintBatch(to, ids, amounts, data);
    }

    function uri(uint256 id) public view override returns (string memory) {
        return string(abi.encodePacked(super.uri(id), _toString(id)));
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