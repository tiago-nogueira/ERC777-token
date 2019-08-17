const Token = artifacts.require("Token");
const ERC1820 = artifacts.require("ERC1820Registry");
const {decToToken} = require("./myModule.js");
const {tokenToDec} = require("./myModule.js");

contract("Token", accounts => {
	const totalSupply = 100000;
	const tokenHolder = accounts[1];
	const operator = accounts[2];
	const defaultOperators = [accounts[0], accounts[1]];
	const zeroAddress = "0x0000000000000000000000000000000000000000";
	let TokenInstance;
	let ERC1820Instance;

	beforeEach(() => {
		return Token.deployed().then(instance => {
			TokenInstance = instance;
		});
	});	

	it("initializes with the correct values", () => {
		return TokenInstance.name()
		.then(name => {
			assert.equal(name, "TucoMoney", "Correct token name");
			return TokenInstance.symbol();
		}).then(symbol => {
			assert.equal(symbol, "TCM", "Correct token symbol");
			return TokenInstance.totalSupply();
		}).then(_totalSupply => {
			assert.equal(decToToken(_totalSupply), totalSupply, "Correct total supply");
			return TokenInstance.granularity();
		}).then(granularity => {
			assert.equal(decToToken(granularity), 1, "Correct token granularity");
			return TokenInstance.defaultOperators();
		}).then(_defaultOperators => {
			assert.equal(_defaultOperators.length, 2, "Two default operators");
			assert.equal(_defaultOperators[0], defaultOperators[0], "Correct operator");
			assert.equal(_defaultOperators[1], defaultOperators[1], "Another correct operator");
			return ERC1820.deployed().then(instance => {
				ERC1820Instance = instance;
				return ERC1820Instance.interfaceHash("ERC777Token");
			}).then(hash => {
				return ERC1820Instance.getInterfaceImplementer(TokenInstance.address, hash);
			}).then(address => {
				assert.equal(address, TokenInstance.address);
			});
		});
	});

	it("checks the authorization of the default operators", () => {
		for (let i = 0; i < defaultOperators.length; i++) {
			TokenInstance.isOperatorFor(defaultOperators[i], accounts[9]
			).then(bool => {
				assert(bool, "Default operator is authorized");
			});
		}
	});

	it("checks if an unauthorized operator can pass for an authorized operator", () => {
		return TokenInstance.isOperatorFor(accounts[4], accounts[9])
		.then(bool => {
			assert(!bool, "unauthorized operator");
		});
	});

	it("gets the balance of an account", () => {
		return TokenInstance.balanceOf(accounts[9])
		.then(balance => {
			assert.equal(balance, 0, "Correct balance");
		});
	});

	it("authorizes an operator", () => {
		// Tries to authorize himself as an operator
		return TokenInstance.authorizeOperator(operator, { from: operator })
		.then(assert.fail).catch(error => {
			assert(error.message.indexOf("Can't authorize yourself") >= 0, "Unexpected error message");
			// authorizes an operator
			return TokenInstance.authorizeOperator(operator, { from: tokenHolder });
		}).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "AuthorizedOperator", "Correct event");
			assert.equal(receipt.logs[0].args.operator, operator, "Correct operator");
			assert.equal(receipt.logs[0].args.tokenHolder, tokenHolder, "Correct token holder");
			return TokenInstance.isOperatorFor(operator, tokenHolder);
 		}).then(bool => {
 			assert(bool, "Operator is authorized");
		});
	});

	it("shows that accounts are operators of themselves", () => {
		return TokenInstance.isOperatorFor(accounts[7], accounts[7])
		.then(bool => {
			assert(bool, "accounts are operators of themselves");
		});
	})

	it("disables an authorized operator", () => {
		// tries to revoke himself
		return TokenInstance.revokeOperator(operator, { from: operator })
		.then(assert.fail).catch(error => {
			assert(error.message.indexOf("Can't revoke yourself") >= 0, "Unexpected error message");
			// revokes an authorized operator
			return TokenInstance.revokeOperator(operator, { from: tokenHolder });
		}).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "RevokedOperator", "Correct event");
			assert.equal(receipt.logs[0].args.operator, operator, "Correct operator");
			assert.equal(receipt.logs[0].args.tokenHolder, tokenHolder, "Correct token holder");			
			return TokenInstance.isOperatorFor(operator, tokenHolder);
		}).then(bool => {
			assert(!bool, "Default operator unauthorized");
		});
	});

	it("disables a default operator", () => {
		// tries to revoke himself
		return TokenInstance.revokeOperator(defaultOperators[0], { from: defaultOperators[0] })
		.then(assert.fail).catch(error => {
			assert(error.message.indexOf("Can't revoke yourself") >= 0, "Unexpected error message");
			// disables a default operator
			return TokenInstance.revokeOperator(defaultOperators[0], { from: tokenHolder });
		}).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "RevokedOperator", "Correct event");
			assert.equal(receipt.logs[0].args.operator, defaultOperators[0], "Correct operator");
			assert.equal(receipt.logs[0].args.tokenHolder, tokenHolder, "Correct token holder");
			return TokenInstance.isOperatorFor(defaultOperators[0], tokenHolder);
		}).then(bool => {
			assert(!bool, "Default operator unauthorized");
		});
	});

	it("enables a previously disabled default operator", () => {
		return TokenInstance.authorizeOperator(defaultOperators[0], { from: tokenHolder })
		.then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "AuthorizedOperator", "Correct event");
			assert.equal(receipt.logs[0].args.operator, defaultOperators[0], "Correct operator");
			assert.equal(receipt.logs[0].args.tokenHolder, tokenHolder, "Correct token holder");
			return TokenInstance.isOperatorFor(defaultOperators[0], tokenHolder);
		}).then(bool => {
			assert(bool, "default operator is authorized again");
		});
	});

	it("Tries to send tokens to 0x0", () => {
		return TokenInstance.send(
			zeroAddress,
			tokenToDec(100),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			{ from: accounts[1] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Can't send tokens to 0x0") >= 0, "Unexpected error message");
		});
	});

	it("Tries to send without funds", () => {
		return TokenInstance.send(
			accounts[0],
			tokenToDec(100),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			{ from: accounts[1] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Insuficient funds") >= 0, "Unexpected error message");
		});
	});

	it("Tries to send an amount not multiple of the granularity", () => {
		return TokenInstance.send(
			accounts[0],
			1,
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			{ from: accounts[0] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Amount must be a multiple of the granularity") >= 0,
				"Unexpected error message (3)"
			);		
		});
	});

	it("check if the balances changed", () => {
		return TokenInstance.balanceOf(zeroAddress)
		.then(balance => {
			assert.equal(balance.toNumber(), 0, "balance must not have changed");	
			return TokenInstance.balanceOf(accounts[1]);
		}).then(balance => {
			assert.equal(balance.toNumber(), 0, "balance must not have changed");
			return TokenInstance.balanceOf(accounts[0]);
		}).then(balance => {
			assert.equal(decToToken(balance), 100000, "balance must not have changed");
		});
	});

	it("sends tokens correctly", () => {
		return TokenInstance.send(
			accounts[9],
			tokenToDec(10000),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			)
		).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "Sent", "Correct event");
			assert.equal(receipt.logs[0].args.operator, accounts[0], "Correct operator");
			assert.equal(receipt.logs[0].args.from, accounts[0], "Correct sender");
			assert.equal(receipt.logs[0].args.to, accounts[9], "Correct recipient");
			assert.equal(decToToken(receipt.logs[0].args.amount), 10000, "Correct amount");
			assert.equal(
				receipt.logs[0].args.data,
				web3.utils.asciiToHex("asdf"),
				"Correct data");		
			assert.equal(receipt.logs[0].args.operatorData, null, "Correct operator data");

			// Checking the balances
			return TokenInstance.balanceOf(accounts[0]);
		}).then(balance => {
			assert.equal(decToToken(balance), 90000, "Correct balance of sender");
			return TokenInstance.balanceOf(accounts[9]);
		}).then(balance => {
			assert.equal(decToToken(balance), 10000, "Correct balance of recipient")
		});
	});

	it("sends 0 tokens", () => {
		return TokenInstance.send(
			accounts[9],
			tokenToDec(0),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			)
		).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "Sent", "Correct event");
			assert.equal(receipt.logs[0].args.operator, accounts[0], "Correct operator");
			assert.equal(receipt.logs[0].args.from, accounts[0], "Correct sender");
			assert.equal(receipt.logs[0].args.to, accounts[9], "Correct recipient");
			assert.equal(decToToken(receipt.logs[0].args.amount), 0, "Correct amount");
			assert.equal(
				receipt.logs[0].args.data,
				web3.utils.asciiToHex("asdf"),
				"Correct data");		
			assert.equal(receipt.logs[0].args.operatorData, null, "Correct operator data");

			// Checking the balances
			return TokenInstance.balanceOf(accounts[0]);
		}).then(balance => {
			assert.equal(decToToken(balance), 90000, "Correct balance of sender");
			return TokenInstance.balanceOf(accounts[9]);
		}).then(balance => {
			assert.equal(decToToken(balance), 10000, "Correct balance of recipient")
		});
	});

	it("unauthorized operator tries to send tokens", () => {
		return TokenInstance.operatorSend(
			accounts[0],
			accounts[1],
			tokenToDec(100),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("1234")
			),				
			{ from: accounts[9] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Operator must be authorized") >= 0, "Unexpected error message");

			// check if the balances changed
			return TokenInstance.balanceOf(accounts[0]);
		}).then(balance => {
			assert.equal(decToToken(balance), 90000, "balance must not have changed");	
			return TokenInstance.balanceOf(accounts[1]);
		}).then(balance => {
			assert.equal(balance, 0, "balance must not have changed");		
		});
	});

	it("operator tries to send from '0x0'", () => {
		return TokenInstance.operatorSend(
			zeroAddress,
			accounts[1],
			tokenToDec(100),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("1234")
			),				
			{ from: accounts[0] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Can't send tokens from 0x0") >= 0, "Unexpected error message");

			// check if the balances changed
			return TokenInstance.balanceOf(zeroAddress);
		}).then(balance => {
			assert.equal(balance.toNumber(), 0, "balance must not have changed");
			return TokenInstance.balanceOf(accounts[1]);
		}).then(balance => {
			assert.equal(balance, 0, "balance must not have changed");			
		});
	});

	it("operator sends tokens correctly", () => {
		return TokenInstance.operatorSend(
			accounts[0],
			accounts[8],
			tokenToDec(5000),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("1234")
			),
			{ from: accounts[1] }
		).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "Sent", "Correct event");
			assert.equal(receipt.logs[0].args.operator, accounts[1], "Correct operator");
			assert.equal(receipt.logs[0].args.from, accounts[0], "Correct sender");
			assert.equal(receipt.logs[0].args.to, accounts[8], "Correct recipient");
			assert.equal(decToToken(receipt.logs[0].args.amount), 5000, "Correct amount");
			assert.equal(
				receipt.logs[0].args.data,
				web3.utils.asciiToHex("asdf"),
				"Correct data");
			assert.equal(
				receipt.logs[0].args.operatorData,
				web3.utils.asciiToHex("1234"),
				"Correct operator data");

			// Checking the balances
			return TokenInstance.balanceOf(accounts[0]);
		}).then(balance => {
			assert.equal(decToToken(balance), 85000, "Correct balance of sender");
			return TokenInstance.balanceOf(accounts[8]);
		}).then(balance => {
			assert.equal(decToToken(balance), 5000, "Correct balance of recipient")
		});
	});

	it("tries to burn tokens incorrectly", () => {
		// Tries to burn more than his balance
		return TokenInstance.burn(
			tokenToDec(200000),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("abcd")
			),
			{ from: accounts[0] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Insuficient funds") >= 0, "Unexpected error message");
		});
	});

	it("Tries to burn an amount not multiple of the granularity", () => {
		return TokenInstance.burn(
			1000,
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("abcd")
			),
			{ from: accounts[0] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Amount must be a multiple of the granularity") >= 0,
				"Unexpected error message"
			);
		});
	});

	it("check if the balance changed", () => {
		return TokenInstance.balanceOf(accounts[0])
		.then(balance => {
			assert.equal(decToToken(balance), 85000, "balance must not have changed");

			// check if the supply changed
			return TokenInstance.totalSupply();
		}).then(supply => {
			assert.equal(decToToken(supply), totalSupply, "supply must not have changed");
		});
	});

	it("unauthorized operator tries to burn tokens", () => {
		return TokenInstance.operatorBurn(
			accounts[0],
			tokenToDec(100),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("1234")
			),				
			{ from: accounts[7] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Operator must be authorized") >= 0, "Unexpected error message");

			// check if the balance changed
			return TokenInstance.balanceOf(accounts[0]);
		}).then(balance => {
			assert.equal(decToToken(balance), 85000, "balance must not have changed");
		});
	});

	it("operator tries to burn from '0x0'", () => {
		return TokenInstance.operatorBurn(
			zeroAddress,
			0,
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("1234")
			),				
			{ from: accounts[0] }
		).then(assert.fail).catch(error => {
			assert(error.message.indexOf("Invalid address") >= 0, "Unexpected error message");

			// check if the balance changed
			return TokenInstance.balanceOf(zeroAddress);
		}).then(balance => {
			assert.equal(balance.toNumber(), 0, "balance must not have changed");
		});
	});

	it("burns tokens", () => {
		return TokenInstance.burn(
			tokenToDec(5000),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			{ from: accounts[0] }
		).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "Burned", "Correct event");
			assert.equal(receipt.logs[0].args.operator, accounts[0], "Correct operator");
			assert.equal(receipt.logs[0].args.from, accounts[0], "Correct holder");
			assert.equal(decToToken(receipt.logs[0].args.amount), 5000, "Correct amount");
			assert.equal(
				receipt.logs[0].args.data,
				web3.utils.asciiToHex("asdf"),
				"Correct data");
			assert.equal(receipt.logs[0].args.operatorData, null, "Correct operator data");

			// Checking the balance
			return TokenInstance.balanceOf(accounts[0]);
		}).then(balance => {
			assert.equal(decToToken(balance), 80000, "correct balance");

			// Checking the total supply
			return TokenInstance.totalSupply();
		}).then(supply => {
			assert.equal(decToToken(supply), 95000, "Correct total supply");
		});
	});

	it("operator burns tokens", () => {
		return TokenInstance.operatorBurn(
			accounts[8],
			tokenToDec(3000),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("asdf")
			),
			web3.utils.hexToBytes(
				web3.utils.asciiToHex("1234")
			),
			{ from: accounts[1] }
		).then(receipt => {
			assert.equal(receipt.logs.length, 1, "Correct number of logs");
			assert.equal(receipt.logs[0].event, "Burned", "Correct event");
			assert.equal(receipt.logs[0].args.operator, accounts[1], "Correct operator");
			assert.equal(receipt.logs[0].args.from, accounts[8], "Correct holder");
			assert.equal(decToToken(receipt.logs[0].args.amount), 3000, "Correct amount");
			assert.equal(
				receipt.logs[0].args.data,
				web3.utils.asciiToHex("asdf"),
				"Correct data");
			assert.equal(
				receipt.logs[0].args.operatorData,
				web3.utils.asciiToHex("1234"),
				"Correct operator data");

			// Checking the balance
			return TokenInstance.balanceOf(accounts[8]);
		}).then(balance => {
			assert.equal(decToToken(balance), 2000, "Correct balance of holder")

			// Checking the total supply
			return TokenInstance.totalSupply();
		}).then(supply => {
			assert.equal(decToToken(supply), 92000, "Correct total supply");
		});
	});
});