const Token = artifacts.require("Token");
const ICO = artifacts.require("ICO");
const ERC1820Registry = artifacts.require("ERC1820Registry");

const tokenDecimals = 18;
const totalSupply = 100000;

let defaultOperators;
web3.eth.getAccounts().then(accounts => {
  defaultOperators = accounts.splice(0, 2);
});

module.exports = function(deployer) {
  // Deploying and setting name of the token, symbol, granularity and default operators list
  deployer.deploy(ERC1820Registry)
  .then(() => {
    return deployer.deploy(
      Token,
      ERC1820Registry.address,      
      "TucoMoney",
      "TCM",
      tokenToDec(totalSupply),
      tokenToDec(1),
      defaultOperators,
    );
  }).then(() => {
    return deployer.deploy(ICO, Token.address, ERC1820Registry.address);
  });
};

function tokenToDec(number) {
  for(let i = 1; i <= 18; i++) {
      number += "0";
  }
  return web3.utils.toBN(number);
}