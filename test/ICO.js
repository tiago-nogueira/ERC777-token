const Token = artifacts.require("Token");
const ICO = artifacts.require("ICO");
const ERC1820 = artifacts.require("ERC1820Registry");
const {decToToken} = require("./myModule.js");
const {tokenToDec} = require("./myModule.js");
const {numberToBytes} = require("./myModule.js");
const {hexCorrection} = require("./myModule.js");

contract("ICO", accounts => {
	const supplyICO = 80000;
	const priceEther = "0.001";
	const tokenPrice = web3.utils.toWei(priceEther);
	const defaultOperators = [accounts[0], accounts[1]];
	let TokenInstance;
	let ICOInstance;
	let ERC1820Instance;

	beforeEach(() => {
		return Token.deployed().then(instance => {
			TokenInstance = instance;
			return ICO.deployed().then(instance => {
				ICOInstance = instance;
			});
		});
	});

	it("initializes with correct values", () => {
		assert.notEqual(ICOInstance.address, 0x0, "has contract address");
		return ERC1820.deployed().then(instance => {
			ERC1820Instance = instance;
			return ERC1820Instance.interfaceHash("ERC777TokensRecipient")
			.then(hash => {
				return ERC1820Instance.getInterfaceImplementer(ICOInstance.address, hash);
			}).then(address => {
				assert.equal(address, ICOInstance.address);
			});
		});
	});

	it("operator tries to transfer to ICO address", () => {
		// trying to transfer
		return TokenInstance.operatorSend(
			accounts[0],
			ICOInstance.address,
			tokenToDec(supplyICO), 
			numberToBytes(tokenPrice),
			web3.utils.hexToBytes(
				web3.utils.toHex("asdf")
			),
			{ from: accounts[1] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Operators can't open the sale") >= 0, "operator can't start the sale");
		});
	});

	it("tries to transfer tokens to ICO address incorrectly", () => {
		// Someone (not the owner) tries to transfer to ICO address
		return TokenInstance.send(
			ICOInstance.address,
			0, 
			numberToBytes(tokenPrice),
			{ from: accounts[5] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Only the owner can open the sale") >= 0,
				"'Only the owner can transfer to ICO address"
			);
		});
	});	

	it("transfers tokens to ICO address", () => {
		// Allocating tokens to sell
		return TokenInstance.send(
			ICOInstance.address,
			tokenToDec(supplyICO), 
			numberToBytes(tokenPrice),
			{ from: accounts[0] }
		).then(receipt => {
			assert.equal(receipt.logs.length, 1, "triggers one event");
			assert.equal(receipt.logs[0].event, "Sent", "'Sent' event");
			assert.equal(receipt.logs[0].args.__length__, 6, "Correct number of arguments");
			assert.equal(receipt.logs[0].args.operator, accounts[0], "Correct operator");
			assert.equal(receipt.logs[0].args.from, accounts[0], "Correct sender");				
			assert.equal(receipt.logs[0].args.to, ICOInstance.address, "Correct recipient");
			assert.equal(decToToken(receipt.logs[0].args.amount), supplyICO, "Correct value transfered");
			assert.equal(receipt.logs[0].args.data,
				hexCorrection(web3.utils.toHex(tokenPrice)),
				"Correct data");
			assert.equal(receipt.logs[0].args.operatorData, null, "Correct operator data");
			return ICOInstance.getPastEvents("SaleStarted", {fromBlock: 0, toBlock: "latest"});
		}).then(result => {
			assert.equal(result.length, 1, "One event emited");
			assert.equal(result[0].event, "SaleStarted", "Correct event");			
			assert.equal(result[0].returnValues.amount, supplyICO, "Correct amount");
			assert.equal(result[0].returnValues.price, tokenPrice, "Correct price");
			return ICOInstance.saleOpen();
		}).then(bool => {
			assert(bool, "sale is open");
			return TokenInstance.balanceOf(ICOInstance.address);
		}).then(balance => {
			assert.equal(decToToken(balance), supplyICO, "Correct number of tokens transfered");
			return ICOInstance.supplyICO();
		}).then(supply => {
			assert.equal(supply.toNumber(), supplyICO, "Correct supply");
			return ICOInstance.tokenPrice();
		}).then(price => {
			assert.equal(price.toNumber(), tokenPrice);
		});
	});

	it("owner tries to transfer tokens to ICO address for the second time", () => {
		// Allocating tokens to sell
		return TokenInstance.send(
			ICOInstance.address,
			tokenToDec(5000), 
			numberToBytes(tokenPrice),
			{ from: accounts[0] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Once sale is open, no more tokens are accepted") >= 0,
				"can't transfer to ICO address twice");
		});
	});

	it("Unauthorized operator tries to buy tokens", () => {
		return ICOInstance.buyTokens(accounts[7], 1, { from: accounts[8], value: tokenPrice })
		.then(assert.fail).catch(error => {
			assert(error.message.indexOf("Message sender must be an operator for the buyer") >= 0,
				"Unauthorized operator"
			);
		});
	});

	it("Tries to buy more tokens than there are available", () => {
		return ICOInstance.buyTokens(
			accounts[1],
			supplyICO + 1,
			{ from: accounts[1],
			value: (supplyICO + 1) * tokenPrice }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Amount must be <= the ICO supply") >= 0, "amount exceeds total available");
		});
	})		

	it("tries to buy with incorrect amount of ether", () => {
		return ICOInstance.buyTokens(accounts[1], 20000, { from: accounts[1], value: 1 })
		.then(assert.fail).catch(error => {
			assert(error.message.indexOf('revert') >= 0, "wrong amount of ether");
		});
	});

	it("buys tokens correctly", () => {
		// Buys tokens correctly
		return ICOInstance.buyTokens(
			accounts[5],
			15000,
			{ from: accounts[5],
			value: tokenPrice * 15000 }
		).then(receipt => {
			return TokenInstance.getPastEvents("Sent", {fromBlock: 0, toBlock: "latest"});
		}).then(result => {
			result = result.filter(log => log.returnValues.to == accounts[5]);

			assert.equal(result.length, 1, "One event emited");
			assert.equal(result[0].event, "Sent", "Correct event");			
			assert.equal(result[0].returnValues.operator, ICOInstance.address, "Correct operator");
			assert.equal(result[0].returnValues.from, ICOInstance.address, "Correct sender");
			assert.equal(result[0].returnValues.to, accounts[5], "Correct recipient");
			assert.equal(decToToken(result[0].returnValues.amount), 15000, "Correct amount");
			assert.equal(result[0].returnValues.data, null, "Correct data");
			assert.equal(result[0].returnValues.operatorData, null, "Correct operator data");

			// Checking the balances
			return TokenInstance.balanceOf(accounts[5]);
		}).then(balance => {
			assert.equal(decToToken(balance), 15000, "correct balance of buyer");
			return TokenInstance.balanceOf(ICOInstance.address);
		}).then(balance => {
			assert.equal(decToToken(balance), supplyICO - 15000, "correct balance of owner");
		});
	});

	it("buys 0 tokens", () => {
		return ICOInstance.buyTokens(
			accounts[6],
			0,
			{ from: accounts[6],
			value: 0 }
		).then(receipt => {
			return TokenInstance.getPastEvents("Sent", {fromBlock: 0, toBlock: "latest"});
		}).then(result => {
			result = result.filter(log => log.returnValues.to == accounts[6]);

			assert.equal(result.length, 1, "One event emited");
			assert.equal(result[0].event, "Sent", "Correct event");			
			assert.equal(result[0].returnValues.operator, ICOInstance.address, "Correct operator");
			assert.equal(result[0].returnValues.from, ICOInstance.address, "Correct sender");
			assert.equal(result[0].returnValues.to, accounts[6], "Correct recipient");
			assert.equal(decToToken(result[0].returnValues.amount), 0, "Correct amount");
			assert.equal(result[0].returnValues.data, null, "Correct data");
			assert.equal(result[0].returnValues.operatorData, null, "Correct operator data");

			// Checking the balances
			return TokenInstance.balanceOf(accounts[6]);
		}).then(balance => {
			assert.equal(decToToken(balance), 0, "correct balance of buyer");
			return TokenInstance.balanceOf(ICOInstance.address);
		}).then(balance => {
			assert.equal(decToToken(balance), supplyICO - 15000, "correct balance of owner");
		});
	});

	it("operator buys tokens correctly", () => {
		return ICOInstance.buyTokens(
			accounts[6],
			10000,
			{ from: defaultOperators[1],
			value: tokenPrice * 10000 }
		).then(receipt => {
			return TokenInstance.getPastEvents("Sent", {fromBlock: 0, toBlock: "latest"});
		}).then(result => {
			result = result.filter(log => log.returnValues.amount == "10000000000000000000000");

			assert.equal(result.length, 1, "One event emited");
			assert.equal(result[0].event, "Sent", "Correct event");			
			assert.equal(result[0].returnValues.operator, ICOInstance.address, "Correct operator");
			assert.equal(result[0].returnValues.from, ICOInstance.address, "Correct sender");
			assert.equal(result[0].returnValues.to, accounts[6], "Correct recipient");
			assert.equal(decToToken(result[0].returnValues.amount), 10000, "Correct amount");
			assert.equal(result[0].returnValues.data, null, "Correct data");
			assert.equal(result[0].returnValues.operatorData, null, "Correct operator data");

			// Checking the balances
			return TokenInstance.balanceOf(accounts[6]);
		}).then(balance => {
			assert.equal(decToToken(balance), 10000, "correct balance of buyer");
			return TokenInstance.balanceOf(ICOInstance.address);
		}).then(balance => {
			assert.equal(decToToken(balance), supplyICO - 25000, "correct balance of owner");
		});
	});

	it("unauthorized account tries to end the sale", () => {
		return ICOInstance.endSale({ from: accounts[9] })
		.then(assert.fail).catch(error => {
			assert(error.message.indexOf("Only the owner can end the sale") >= 0, "can't end the sale");
		});
	});

	it("owner ends the sale", () => {
		return ICOInstance.endSale({ from: accounts[0] })
		.then(receipt => {
			assert.equal(receipt.logs.length, 1, "correct number of events");
			assert.equal(receipt.logs[0].event, "SaleEnded", "correct event name");

			// check if the contract still exists
			return ICOInstance.supplyICO();
		}).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Returned values aren't valid") >= 0,
				"Contract should have been destroyed"
			);
		});
	});
});