pragma solidity 0.5.8;

import { Token } from "./Token.sol";
import { ERC777TokensRecipient } from "./ERC777TokensRecipient.sol";
import { ERC1820Registry } from "./ERC1820.sol";
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';

// Contract for ICO of an ERC777 token
// This contract only allow for sales of whole tokens
contract ICO is ERC777TokensRecipient{
	using SafeMath for uint;

	uint256 public supplyICO;
	uint256 public tokensSold;
	uint256 public tokenPrice;
	address internal owner;
	Token tokenContract;
	bool public saleOpen;

	constructor(Token _tokenContract, ERC1820Registry _erc1820) public {
		tokenContract = _tokenContract;
		owner = msg.sender;
		bytes32 _interfaceHash = _erc1820.interfaceHash("ERC777TokensRecipient");
		_erc1820.setInterfaceImplementer(address(this) , _interfaceHash, address(this));
	}

	event SaleStarted(uint256 indexed amount, uint256 indexed price);
	event SaleEnded();

	// Implementation of the interface "ERC777TokensRecipient" acording to ERC1820
	// It recieves from the token contract the tokens to be sold on the ICO
	//  'amount' is on decimals of tokens
	function tokensReceived(
		address operator,
        address from,
        address to,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) external {
		require(msg.sender == address(tokenContract), "Only accepts tokens from the token contract");
		require(!saleOpen, "Once sale is open, no more tokens are accepted");
		require(from == owner, "Only the owner can open the sale");
		require(operator == owner, "Operators can't open the sale");
		require(to == address(this), "Address must be correct");
		require(amount.mod(tokenContract.granularity()) == 0, "ICO supply must be a multiple of the granularity");

		supplyICO = amount.div(1000000000000000000); // 18 zeros  // From decimals to whole tokens
		tokenPrice = bytesToUint(data);
		saleOpen = true;
		emit SaleStarted(supplyICO, tokenPrice);
    }

	// Buys tokens
	// '_amount' is on whole tokens
	function buyTokens(address _buyer, uint256 _amount) public payable {
		require(tokenContract.isOperatorFor(msg.sender, _buyer), "Message sender must be an operator for the buyer");
		require(_amount <= supplyICO.sub(tokensSold), "Amount must be <= the ICO supply");
		require(msg.value == _amount.mul(tokenPrice), "Check if payment amount is correct");
		tokenContract.send(
			_buyer,
			_amount.mul(1000000000000000000),  // 18 zeros  // From whole tokens to decimals
			""
		);
		tokensSold = tokensSold.add(_amount);		
	}

	// Ends the sale and disables the contract, send the funds to the owner
	function endSale() external {
		require(msg.sender == owner, "Only the owner can end the sale");
		emit SaleEnded();
		selfdestruct(msg.sender);
	}

	// Converts an 'bytes' variable that holds only numbers to an 'uint256' variable
	function bytesToUint(bytes memory b) public pure returns (uint256 number) {
		require(b.length <= 32, "'bytes' variable must be at most 32 bytes long");
        for(uint256 i = 0; i < b.length ; i = i.add(1)) {
            number = number.add(
            	uint256(uint8(b[i])).mul(
            		2**(
            			b.length.sub(i).sub(1).mul(8)
            		)
            	)
            );
        }
	}
}