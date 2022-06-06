const { types } = require("./types");

function createTypedMessage(yourContract: any, message: any, primaryType: any, CONTRACT_NAME: any) {
  const chainId = yourContract.deployTransaction.chainId;
  return {
    data: {
      types,
      primaryType,
      domain: {
        name: CONTRACT_NAME,
        version: "1",
        chainId,
        verifyingContract: yourContract.address,
      },
      message,
    },
  };
}

export default createTypedMessage;
