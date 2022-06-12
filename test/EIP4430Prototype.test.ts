import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { Contract, ContractFactory } from 'ethers';
import { ethers } from 'hardhat';
import { signDelegation, signInvocation } from '../utils/delegatable-utils';
const { generateUtil } = require('eth-delegatable-utils');
const friendlyTypes = require('../types');
const { getSigners } = ethers;
const sigUtil = require('eth-sig-util');
const { TypedDataUtils } = sigUtil;
const { typedSignatureHash, encodeData } = TypedDataUtils;

const CONTRACT_NAME = 'EIP4430Prototype';
const account0PrivKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const account1PrivKey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const account2PrivKey = '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const types = signTypedDataify(friendlyTypes);

describe(CONTRACT_NAME, function () {
  let wallet0: SignerWithAddress;
  let wallet1: SignerWithAddress;
  let wallet2: SignerWithAddress;
  let wallet3: SignerWithAddress;
  let EIP4430Prototype: Contract;

  let EIP4430PrototypeFactory: ContractFactory;

  before(async () => {
    [wallet0, wallet1, wallet2, wallet3] = await getSigners();
    EIP4430PrototypeFactory = await ethers.getContractFactory(CONTRACT_NAME);
  });

  beforeEach(async () => {
    EIP4430Prototype = await EIP4430PrototypeFactory.deploy();
    await EIP4430Prototype.addPublisher(wallet0.address);
    await EIP4430Prototype.addPublisher(wallet1.address);
  });

  describe('encodeKey(uint16 chainId, address contractAddress, bytes4 method)', () => {
    it('should SUCCEED to encode a lookup key', async () => {
      const key = await EIP4430Prototype.encodeLookupKey(1, wallet1.address, '0x12345678');
      expect(key).to.equal('0xce7a8a69edfee23e');
    });
  });

  /**
   * @test addPublisher(address rootPublisher)
   * -= Expected Behavior =-
   * 1. add `rootPublisher` to the list of publishers
   * 3. emit `RootPublisherAdded` event
   */
  describe('addPublisher(address rootPublisher)', () => {
    it('should SUCCEED to ADD a rootPublisher to AUTHORIZED_ROOT_PUBLISHERS', async () => {
      await expect(EIP4430Prototype.addPublisher(wallet2.address)).to.emit(
        EIP4430Prototype,
        'RootPublisherAdded',
      );
      expect(await EIP4430Prototype.isAuthorizedRootPublisher(wallet2.address)).to.be.true;
    });

    it('should REVERT due to UNAUTHORIZED access', async () => {
      expect(EIP4430Prototype.connect(wallet2).addPublisher(wallet2.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  /**
   * @test removePublisher(address rootPublisher)
   * -= Expected Behavior =-
   * 1. remove `rootPublisher` from the list of publishers
   * 3. emit `RootPublisherRemoved` event
   */
  describe('removePublisher(address rootPublisher)', () => {
    it('should SUCCEED to REMOVE a rootPublisher from AUTHORIZED_ROOT_PUBLISHERS', async () => {
      await EIP4430Prototype.addPublisher(wallet2.address);
      expect(await EIP4430Prototype.isAuthorizedRootPublisher(wallet2.address)).to.be.true;
      await expect(EIP4430Prototype.removePublisher(wallet2.address)).to.emit(
        EIP4430Prototype,
        'RootPublisherRemoved',
      );
      expect(await EIP4430Prototype.isAuthorizedRootPublisher(wallet2.address)).to.be.false;
    });

    it('should REVERT due to UNAUTHORIZED access', async () => {
      expect(EIP4430Prototype.connect(wallet2).removePublisher(wallet2.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });

  /**
   * @test update(address target, bytes4 method, bytes4 language, string calldata description, string[] calldata inputs)
   * -= Expected Behavior =-
   * 1. add `rootPublisher` to the list of publishers
   * 3. emit `RootPublisherAdded` event
   */
  describe('update(address target, bytes4 method, bytes4 language, string calldata description, string[] calldata inputs)', () => {
    // TEST 1
    it('should SUCCEED to EXECUTE from ROOT publisher', async () => {
      const chainId = 1;
      const target = '0x0000000000000000000000000000000000000001';
      const method = '0xa9059cbb';
      const language = '0x01010101';
      const description = 'A public goods API endpoint';
      const inputs = ['test', 'test2'];
      await expect(
        EIP4430Prototype.update(chainId, target, method, language, description, inputs),
      ).to.emit(EIP4430Prototype, 'ContractUpdated');
      const metadata = await EIP4430Prototype.lookupMetadata(chainId, target, method, language);
      expect(metadata.description).to.eql(description);
    });

    // TEST 2
    it('should SUCCEED to INVOKE from a BRANCH publisher', async () => {
      const chainId = 1;
      const target = '0x0000000000000000000000000000000000000001';
      const method = '0xa9059cbb';
      const language = '0x01010101';
      const description = 'A public goods API endpoint';
      const inputs = ['test', 'test2'];

      const utilOpts = {
        chainId,
        verifyingContract: EIP4430Prototype.address,
        name: CONTRACT_NAME,
      };
      const util = generateUtil(utilOpts);
      const delegation = {
        delegate: wallet1.address,
        authority: '0x0000000000000000000000000000000000000000000000000000000000000000',
        caveats: [],
      };
      const signedDelegation = util.signDelegation(delegation, account0PrivKey);
      const desiredTx = await EIP4430Prototype.populateTransaction.update(
        chainId,
        target,
        method,
        language,
        description,
        inputs,
      );

      const invocationMessage = {
        replayProtection: {
          nonce: '0x01',
          queue: '0x00',
        },
        batch: [
          {
            authority: [signedDelegation],
            transaction: {
              to: EIP4430Prototype.address,
              gasLimit: '10000000000000000',
              data: desiredTx.data,
            },
          },
        ],
      };
      const signedInvocation = util.signInvocation(invocationMessage, account1PrivKey);

      // Step 3: Dispatch Invocation from Third-Party Wallet
      await EIP4430Prototype.invoke([signedInvocation]);
      const metadata = await EIP4430Prototype.lookupMetadata(chainId, target, method, language);
      expect(metadata.description).to.eql(description);
    });

    // TEST 3
    it('should REVERT due to REVOKED delegation AUTHORIZATION.', async () => {
      // Step 1: Sign Delegation
      const signedDelegation = signDelegation(
        wallet2.address,
        EIP4430Prototype,
        CONTRACT_NAME,
        account1PrivKey,
      );

      // Step 2: Generate Invocation from Delegation & Desired Transaction
      const chainId = 1;
      const target = '0x0000000000000000000000000000000000000001';
      const method = '0xa9059cbb';
      const language = '0x01010101';
      const description = 'A public goods API endpoint';
      const inputs = ['test', 'test2'];

      // REVOKE
      const utilOpts = {
        chainId,
        verifyingContract: EIP4430Prototype.address,
        name: CONTRACT_NAME,
      };
      const util = generateUtil(utilOpts);
      // Owner revokes outstanding delegation
      const intentionToRevoke = {
        delegationHash: TypedDataUtils.hashStruct(
          'SignedDelegation',
          signedDelegation,
          types,
          true,
        ),
      };
      const SignedIntentionToRevoke = util.signRevocation(intentionToRevoke, account1PrivKey);
      console.log(SignedIntentionToRevoke, 'SignedIntentionToRevoke');
      await EIP4430Prototype.revokeDelegation(signedDelegation, SignedIntentionToRevoke);

      const desiredTx = await EIP4430Prototype.populateTransaction.update(
        chainId,
        target,
        method,
        language,
        description,
        inputs,
      );
      const signedInvocation = signInvocation(
        signedDelegation,
        desiredTx,
        EIP4430Prototype,
        CONTRACT_NAME,
        account2PrivKey,
      );

      // Step 3: Revoke Delegation
      // await EIP4430Prototype.revokeDelegationAuthority(wallet1.address);

      // Step 4: Dispatch Invocation from Third-Party Wallet
      const contract = EIP4430Prototype.connect(wallet2);
      await expect(EIP4430Prototype.invoke([signedInvocation])).to.be.revertedWith(
        'Delegator execution failed',
      );
    });

    // TEST 4
    it('should REVERT due to UNAUTHORIZED access', async () => {
      const contract = EIP4430Prototype.connect(wallet2);
      expect(contract.addPublisher(wallet2.address)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
});

function signTypedDataify(friendlyTypes: any) {
  const types = {};
  Object.keys(friendlyTypes).forEach((typeName: string) => {
    const type = friendlyTypes[typeName];
    // @ts-ignore
    types[typeName] = [];

    Object.keys(friendlyTypes[typeName]).forEach((subTypeName) => {
      const subType = friendlyTypes[typeName][subTypeName];
      // @ts-ignore
      types[typeName].push({
        name: subTypeName,
        type: subType,
      });
    });
  });
  return types;
}
