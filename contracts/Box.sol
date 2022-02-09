//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Box is Ownable {
  uint256 public value = 42;

  function setValue(uint256 _newValue) public onlyOwner {
    value = _newValue;
  }

  function getValue() public view returns(uint256) {
    return value;
  }
}