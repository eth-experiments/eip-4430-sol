const sigUtil = require("eth-sig-util");
import { fromHexString } from "../utils/fromHexString";
import createTypedMessage from "../utils/createTypedMessage";
import { Contract } from "@ethersproject/contracts";

type SignedDelegation = {
  signature: any;
  delegation: any;
};

export function signDelegation(
  to: string,
  contract: Contract,
  contractName: string,
  pk: string
): SignedDelegation {
  const delegation = {
    delegate: to,
    authority: "0x0000000000000000000000000000000000000000000000000000000000000000",
    caveats: [],
  };
  const typedMessage = createTypedMessage(contract, delegation, "Delegation", contractName);
  const privateKey = fromHexString(pk);
  const signature = sigUtil.signTypedData_v4(privateKey as Buffer, typedMessage);

  const signedDelegation = {
    signature,
    delegation,
  };
  return signedDelegation;
}

type SignedInvocation = {
  signature: any;
  invocations: any;
};

export function signInvocation(
  signedDelegation: any,
  transaction: any,
  contract: Contract,
  contractName: string,
  pk: string
): SignedInvocation {
  const delegatePrivateKey = fromHexString(pk);
  const invocationMessage = {
    replayProtection: {
      nonce: "0x01",
      queue: "0x00",
    },
    batch: [
      {
        authority: [signedDelegation],
        transaction: {
          to: contract.address,
          gasLimit: "10000000000000000",
          data: transaction.data,
        },
      },
    ],
  };
  const typedInvocationMessage = createTypedMessage(
    contract,
    invocationMessage,
    "Invocations",
    contractName
  );

  const invocationSig = sigUtil.signTypedData_v4(
    delegatePrivateKey as Buffer,
    typedInvocationMessage
  );
  const signedInvocation = {
    signature: invocationSig,
    invocations: invocationMessage,
  };

  return signedInvocation;
}
