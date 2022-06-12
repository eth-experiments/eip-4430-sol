pragma solidity ^0.8.13;
//SPDX-License-Identifier: MIT

// import "hardhat/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Delegatable/Delegatable.sol";

/**                                                               
_____   ____  __   ___                   _               _      
| __\ \ / /  \/  | | __|_ ___ __  ___ _ _(_)_ __  ___ _ _| |_ ___
| _| \ V /| |\/| | | _|\ \ / '_ \/ -_) '_| | '  \/ -_) ' \  _(_-<
|___| \_/ |_|  |_| |___/_\_\ .__/\___|_| |_|_|_|_\___|_||_\__/__/
                          |_|                                                                   

🗺️ Overview:
The EIP4430Prototype smart contract is designed to store transaction side-effect descriptions as metadata.
Emulating the objectives of EIP-3224 and EIP-4430: human-readable descriptions of transaction and signable data types.

Publisher: Authorized role to publish metadata.
Contract: Smart contract with associated metadata.

Publishers are authorized to publish smart contract method metadata.
Publishers can delegate authority to other signing keys off-chain using Delegatable.sol
Root and parent Branches can revoke child branches publishing

📜 Abstract:
The EIP4430Prototype uses a "Web of Trust" like model to curate metadata.
Allowing off-chain networks to form, in the pursuit of a more decentralized, yet still efficient network.

🏗️ Architecture:
- Publisher (root/branch address)
- Restricted (root/branch address)
- Contract (address)
  - Method ID (bytes4)
    - Signature (string)
    - Description (string)
    - Inputs? ([string, string])

PUBLISHERS have AUTHORITY to write CONTRACT metadata storage.
*/

/**
 * @title EIP4430Prototype
 * @dev EIP4430Prototype is a prototype for the EIP4430 transaction description draft.
 */
contract EIP4430Prototype is Ownable, Delegatable {
  /**
    @notice Root publishers have authority to publish metadata and delegate publishing authority.
    @dev Delegation is done off-chain using Delegatable.sol OCAP-like signing schema.
    -------------------------------
    | Root        	| Authorized 	|
    |-------------	|------------	|
    | 0x000...000 	| FALSE      	|
    | 0x111...111 	| TRUE       	|
    -------------------------------
  */
  mapping(address => bool) private AUTHORIZED_ROOT_PUBLISHERS;

  /**
    @notice OWNERS have authority to restrict BRANCH_PUBLISHERS from delegating.
    -------------------------------
    | Branch      	| Restricted 	|
    |-------------	|------------	|
    | 0x999...999 	| FALSE      	|
    | 0x888...888 	| TRUE       	|
    -------------------------------
  */
  mapping(address => bool) private REVOKED_DELEGATION_AUTHORITY;

  /**
    @notice Languages approved for use by publishers.
    -------------------------------
    | Language    	| Restricted 	|
    |-------------	|------------	|
    | 0x01010101 	  | FALSE      	|
    | 0x02020202 	  | TRUE       	|
    -------------------------------
  */
  mapping(bytes4 => bool) private APPROVED_LANGUAGES;

  /**
   * @notice Smart Contract method metadata
   * @param method Function signature in the form of a string
   * @param description Method description for general audience keyed by language.
   * @param inputs List of method input descriptions for a general audience keyed by language.
   */
  struct Metadata {
    string method; // deposit(uint256 amount, uint256 to)
    mapping(bytes4 => string) description; // language => description
    mapping(bytes4 => string[]) inputs; // language => method input descriptions
  }

  /**
   @notice Metadata is stored on per address-level basis.
   ------------------------------------------
   | Contract    	| Method ID  	| Metadata 	|
   |-------------	|------------	|----------	|
   | 0x000...000 	| 0xe2bbb158 	| {data}   	|
   | 0x000...000 	| 0x00f714ce 	| {data}   	|
   ------------------------------------------
   */
  mapping(bytes8 => Metadata) private metadata;

  mapping(address => bool) private CONTRACTS;

  // -----------------------------------------
  // Events
  // -----------------------------------------
  event RootPublisherAdded(address indexed rootPublisher);
  event RootPublisherRemoved(address indexed rootPublisher);

  event RootPublisherDelegationsRevoked(address indexed rootPublisher);
  event RootPublisherDelegationsUnrevoked(address indexed rootPublisher);

  event ContractUpdated(
    address indexed contractAddress,
    bytes4 methodId,
    bytes4 language,
    string description
  );

  // -----------------------------------------
  // Modifiers
  // -----------------------------------------
  modifier isAuthorized() {
    require(AUTHORIZED_ROOT_PUBLISHERS[_msgSender()], "EIP4430Prototype:not-authorized");
    _;
  }

  // -----------------------------------------
  // Constructor
  // -----------------------------------------
  constructor(address) Delegatable("EIP4430Prototype", "1") {
    APPROVED_LANGUAGES[bytes4("EN")] = true;
    APPROVED_LANGUAGES[0x01010101] = true;
  }

  /* ================================================================================ */
  /* External Functions                                                               */
  /* ================================================================================ */

  // -----------------------------------------
  // Setters
  // -----------------------------------------
  function addPublisher(address rootPublisher) external onlyOwner {
    _addPublisher(rootPublisher);
  }

  function removePublisher(address rootPublisher) external onlyOwner {
    _removePublisher(rootPublisher);
  }

  function revokeDelegationAuthority(address rootPublisher) external onlyOwner {
    _revokeDelegationAuthority(rootPublisher);
  }

  function unrevokeDelegationAuthority(address rootPublisher) external onlyOwner {
    _unrevokeDelegationAuthority(rootPublisher);
  }

  function create(
    uint8 chainId,
    address target,
    bytes4 methodId,
    bytes4 language,
    string calldata method
  ) external isAuthorized {
    require(APPROVED_LANGUAGES[language], "EIP4430Prototype:language-not-supported");
    bytes8 key = _encodeLookupKey(chainId, target, methodId);
    metadata[key].method = method;
  }

  function update(
    uint8 chainId,
    address target,
    bytes4 methodId,
    bytes4 language,
    string calldata description,
    string[] calldata inputs
  ) external isAuthorized {
    require(APPROVED_LANGUAGES[language], "EIP4430Prototype:language-not-supported");
    bytes8 key = _encodeLookupKey(chainId, target, methodId);
    metadata[key].description[language] = description;
    for (uint256 index = 0; index < inputs.length; index++) {
      metadata[key].inputs[language].push(inputs[index]);
    }
    emit ContractUpdated(target, methodId, language, description);
  }

  // -----------------------------------------
  // Getters
  // -----------------------------------------
  function isAuthorizedRootPublisher(address rootPublisher) external view returns (bool) {
    return AUTHORIZED_ROOT_PUBLISHERS[rootPublisher];
  }

  function isAuthorizedToDelegate(address rootPublisher) external view returns (bool) {
    return
      AUTHORIZED_ROOT_PUBLISHERS[rootPublisher] && !REVOKED_DELEGATION_AUTHORITY[rootPublisher];
  }

  function lookupMetadata(
    uint8 chainId,
    address target,
    bytes4 method,
    bytes4 language
  )
    external
    view
    returns (
      string memory name,
      string memory description,
      string[] memory inputs
    )
  {
    bytes8 methodId = _encodeLookupKey(chainId, target, method);
    string memory methodName = metadata[methodId].method;
    string memory description = metadata[methodId].description[language];
    string[] memory inputs = metadata[methodId].inputs[language];
    return (methodName, description, inputs);
  }

  function encodeLookupKey(
    uint8 chainId,
    address contractAddress,
    bytes4 method
  ) external view returns (bytes8) {
    return _encodeLookupKey(chainId, contractAddress, method);
  }

  /* ================================================================================ */
  /* Internal Functions                                                               */
  /* ================================================================================ */

  function _encodeLookupKey(
    uint8 chainId,
    address contractAddress,
    bytes4 method
  ) internal view returns (bytes8) {
    return bytes8(keccak256(abi.encodePacked(chainId, contractAddress, method)));
  }

  function _addPublisher(address _rootPublisher) internal {
    AUTHORIZED_ROOT_PUBLISHERS[_rootPublisher] = true;
    emit RootPublisherAdded(_rootPublisher);
  }

  function _removePublisher(address _rootPublisher) internal {
    AUTHORIZED_ROOT_PUBLISHERS[_rootPublisher] = false;
    emit RootPublisherRemoved(_rootPublisher);
  }

  function _revokeDelegationAuthority(address _rootPublisher) internal {
    REVOKED_DELEGATION_AUTHORITY[_rootPublisher] = true;
    emit RootPublisherDelegationsRevoked(_rootPublisher);
  }

  function _unrevokeDelegationAuthority(address _rootPublisher) internal {
    REVOKED_DELEGATION_AUTHORITY[_rootPublisher] = false;
    emit RootPublisherDelegationsUnrevoked(_rootPublisher);
  }

  /// @inheritdoc Delegatable
  function _msgSender() internal view override(Delegatable, Context) returns (address sender) {
    if (msg.sender == address(this)) {
      bytes memory array = msg.data;
      uint256 index = msg.data.length;
      assembly {
        // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
        sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
      }
    } else {
      sender = msg.sender;
    }
    require(!REVOKED_DELEGATION_AUTHORITY[sender], "EIP4430Prototype:revoked-delegation-authority");
    return sender;
  }
}
