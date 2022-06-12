pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

import "./CaveatEnforcer.sol";

contract ExpirationEnforcer is CaveatEnforcer {
  function enforceCaveat(
    bytes memory terms,
    Transaction memory _transaction,
    bytes32 _delegationHash
  ) public view override returns (bool) {
    uint256 limit = bytesToUint(terms);
    require(limit > block.timestamp, "Expiration has passed");
    return true;
  }

  function bytesToUint(bytes memory b) internal pure returns (uint256) {
    uint256 number;
    for (uint256 i = 0; i < b.length; i++) {
      number = number + uint256(uint8(b[i])) * (2**(8 * (b.length - (i + 1))));
    }
    return number;
  }
}
