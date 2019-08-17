pragma solidity 0.5.8;

import { ERC777Token } from "./ERC777Token.sol";
import { ERC1820Registry } from "./ERC1820.sol";
import { ERC777TokensRecipient } from "./ERC777TokensRecipient.sol";
import { ERC777TokensSender } from "./ERC777TokensSender.sol";
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

// Token contract following the ERC-777 standard
// All tokens quantities on this contract refer to decimals, i.e.,
//  to portions of a token divided in 10e18 parts
// The total supply of tokens and the granularity are set on deployment
contract Token is ERC777Token{
	using SafeMath for uint;

	ERC1820Registry erc1820;
	string internal tokenName;
	string internal tokenSymbol;
	uint256 internal supply;
	uint256 internal granul; // granularity
	mapping(address => uint256) internal balances;
	address[] internal defaultOperatorsList;
	mapping(address => bool) internal isDefaultOperator;
	mapping(address => mapping(address => bool)) internal operators; // Token holder => Operator
	mapping(address => mapping(address => bool)) internal disabledDefault;	// Token holder => operator

	constructor(ERC1820Registry _erc1820,
		string memory _tokenName, 
		string memory _tokenSymbol, 
		uint256 _supply, 
		uint256 _granularity, 
		address[] memory _defaultOperatorsList
	) public {
		require(_granularity >= 1, "Granularity must be >= 1");
		tokenName = _tokenName;
		tokenSymbol = _tokenSymbol;
		supply = _supply;
		granul = _granularity;
		defaultOperatorsList = _defaultOperatorsList;
		balances[msg.sender] = supply;
		for (uint256 i = 0; i < _defaultOperatorsList.length; i++) {
			isDefaultOperator[_defaultOperatorsList[i]] = true;
		}
		erc1820 = _erc1820;
		bytes32 _interfaceHash = _erc1820.interfaceHash("ERC777Token");
		_erc1820.setInterfaceImplementer(address(this) , _interfaceHash, address(this));		
	}

	// Returns the name of the token
	function name() external view returns (string memory) {
		return tokenName;
	}

	// Returns the symbol of the token
	function symbol() external view returns (string memory) {
		return tokenSymbol;
	}

	// Returns the total supply of tokens
	function totalSupply() external view returns (uint256) {
		return supply;
	}

	// Returns the balance of 'tokenHolder'
	function balanceOf(address tokenHolder) external view returns (uint256) {
		return balances[tokenHolder];
	}

	// Returns the granularity of the token
	function granularity() external view returns (uint256) {
		return granul;
	}

	// Returns the default operators
	function defaultOperators() external view returns (address[] memory) {
		return defaultOperatorsList;
	}

	// Authorizes an address as an operator for the message sender
	function authorizeOperator(address _operator) external {
		require(_operator != msg.sender, "Can't authorize yourself");
		if(isDefaultOperator[_operator])
			disabledDefault[msg.sender][_operator] = false;
		else operators[msg.sender][_operator] = true;
		emit AuthorizedOperator(_operator, msg.sender);
	}

	// Revokes an operator for the message sender
	function revokeOperator(address _operator) external {
		require(_operator != msg.sender, "Can't revoke yourself");
		if (isDefaultOperator[_operator])
			disabledDefault[msg.sender][_operator] = true;
		else operators[msg.sender][_operator] = false;
		emit RevokedOperator(_operator, msg.sender);
	}

	// Returns whether or not"_operator" is an
	//  operator for "_tokenHolder"
	function isOperatorFor(address _operator, address _tokenHolder) public view returns (bool) {
		return (operators[_tokenHolder][_operator]
			|| _operator == _tokenHolder
			|| ( isDefaultOperator[_operator] && !disabledDefault[_tokenHolder][_operator] ));
	}

	// Calls sending function to send tokens from the
	//  message sender's account to the 'to' address
	function send(address to, uint256 amount, bytes calldata data) external {
		doSend(msg.sender, msg.sender, to, amount, data,"");
	}

	// Calls sending function if the message sender is an operator for the address 'from'
	    function operatorSend(
    	address from,
    	address to,
    	uint256 amount,
    	bytes calldata data,
    	bytes calldata operatorData
    ) external {
    	require(isOperatorFor(msg.sender, from), "Operator must be authorized");
  		doSend(msg.sender, from, to, amount, data, operatorData);
  	}

  	// Sends tokens
	function doSend(
		address operator,
		address from,
		address to,
		uint256 amount,
    	bytes memory data,
    	bytes memory operatorData		
	) private {
		require(from != address(0), "Can't send tokens from 0x0");
		require(to != address(0), "Can't send tokens to 0x0");
		require(balances[from] >= amount, "Insuficient funds");
		require(amount % granul == 0, "Amount must be a multiple of the granularity");
		callSenderIfImplements(operator, from, to, amount, data, operatorData);

		balances[from] = balances[from].sub(amount);
		balances[to] = balances[to].add(amount);

		require(callRecipientIfImplements(operator, from, to, amount, data, operatorData) 
			|| !isAContract(to), "Recipient contracts must implement 'tokensToReceive'");
		require(balances[from].mod(granul) == 0 &&
			balances[to].mod(granul) == 0, "Balances must be multiples of the granularity"
		);
		emit Sent(
			operator,
			from,
			to, 
			amount,
			data,
			operatorData
		);		
	}

	// Calls the burning function to burn message sender's tokens
    function burn(uint256 amount, bytes calldata data) external {
		doBurn(msg.sender, msg.sender, amount, data,"");
    }

    // Calls burning function if the message sender is an operator for the address 'from'
    function operatorBurn(address from, uint256 amount, bytes calldata data, bytes calldata operatorData) external {
    	require(isOperatorFor(msg.sender, from), "Operator must be authorized");
  		doBurn(msg.sender, from, amount, data, operatorData);
    }

    // Burns tokens
    function doBurn (address operator, address from, uint256 amount, bytes memory data, bytes memory operatorData) private {
    	require(from != address(0), "Invalid address");
    	require(amount <= balances[from], "Insuficient funds");
		require(amount % granul == 0, "Amount must be a multiple of the granularity");
    	callSenderIfImplements(operator, from, address(0), amount, data, operatorData);

		supply = supply.sub(amount);
		balances[from] = balances[from].sub(amount);

    	require(balances[from].mod(granul) == 0, "Holder balance must be a multiple of the granularity");
		emit Burned(
			operator,
			from,
			amount,
			data,
			operatorData
		);
    }

    // Returns whether an '_addr' is of a regular address or a contract address       !!NOT RELIABLE!!
    //  -- A contract address will be missidentified as a regular address if it calls
    // a sending function from it's constructor --
	function isAContract(address _addr) private view returns (bool) {
	  uint256 size;
	  assembly { size := extcodesize(_addr) }
	  return size > 0;
	}

	// Calls the sender address if it implements the interface "ERC777TokensSender"
	// acording to ERC1820
	function callSenderIfImplements(
		address _operator,
		address _from,
		address _to,
		uint256 _amount,
    	bytes memory _data,
    	bytes memory _operatorData	
	) private {
    	bytes32 _iHash = erc1820.interfaceHash("ERC777TokensSender");
    	address _implementerAddr = erc1820.getInterfaceImplementer(_from, _iHash);
    	if (_implementerAddr == address(0)) return;
    	ERC777TokensSender(_implementerAddr).tokensToSend(
    		_operator, _from, _to, _amount,	_data, _operatorData
    	);
	}

	// Calls the recipient address if it implements the interface "ERC777TokensRecipient"
	//  acording to ERC1820
	// Return whether or not the recipient implements the interface
	function callRecipientIfImplements(
		address _operator,
		address _from,
		address _to,
		uint256 _amount,
    	bytes memory _data,
    	bytes memory _operatorData
    ) private returns (bool) {
    	bytes32 _iHash = erc1820.interfaceHash("ERC777TokensRecipient");
    	address _implementerAddr = erc1820.getInterfaceImplementer(_to, _iHash);		
    	if (_implementerAddr == address(0)) return false;
    	ERC777TokensRecipient(_implementerAddr).tokensReceived(
    		_operator, _from, _to, _amount,	_data, _operatorData
    	);
		return true;
	}
}