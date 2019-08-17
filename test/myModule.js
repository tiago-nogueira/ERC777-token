function tokenToDec(number) {
  for(let i = 1; i <= 18; i++) {
      number += "0";
  }
  return web3.utils.toBN(number);
}

function decToToken(number) {
	return BigInt(number) / BigInt(10 ** 18);
}

function numberToBytes(num) {
	return web3.utils.hexToBytes(
		hexCorrection(
			web3.utils.toHex(num)
		)
	);
}

function hexCorrection(str) {
	if(str.length % 2 == 0) return str;
	return str.substr(0, 2) + "0" + str.substr(2, str.length - 2);
}

module.exports = {
	tokenToDec: tokenToDec,
	decToToken: decToToken,
	numberToBytes: numberToBytes,
	hexCorrection: hexCorrection
}