function f(x: bigint | null) {
  BigInt("1");
  BigInt("2") + BigInt("3") + BigInt("4");
  let y = x!;
  y += BigInt("3");
}
