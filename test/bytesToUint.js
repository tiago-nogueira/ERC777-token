const ICO = artifacts.require("ICO");
const {numberToBytes} = require("./myModule.js");

let numbers = [];
for(let i = 0; i < 20; i++) {
	numbers.push(Math.floor(Math.random() * 1000000000000000));
}

contract("ICO-bytesToUint", accounts => {
	let ICOInstance;
	beforeEach(() => {
		return ICO.deployed().then(instance => {
			ICOInstance = instance;
		});
	});
	for(let i = 0; i < 20; i++) {
		it("'bytesToUint', test #" + (i + 1), () => {
			return ICOInstance.bytesToUint(
				numberToBytes(numbers[i])
			).then(value => {
				assert.equal(value.toNumber(), numbers[i], "Test #" + i);
			});
		});
	}
});