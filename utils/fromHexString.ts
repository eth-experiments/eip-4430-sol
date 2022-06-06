export function fromHexString(hexString: any) {
  return new Uint8Array(hexString.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));
}
