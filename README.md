# DIH Token Dashboard

Individual coursework for "Create & Transfer Your Tokens" (Group 3 assignment, Blockchain Lab), completed by sergeyakula. **Ethereum Sepolia testnet only** (chain ID 11155111); the tokens have no real monetary value.

**Live dashboard:** https://sergeyakula.github.io/dih/

The dashboard connects to MetaMask, shows the wallet address and the balances of two ERC-20 tokens, checks the network, and sends the selected token to another address.

## Tokens

| | Token A | Token B |
| --- | --- | --- |
| Name / symbol | DIH Coin / **DIH** | Deeznats / **DN** |
| Owner | mine (sergeyakula) | a classmate's |
| Contract | [`0x05DB1441d06eC94E89d43ee834B216986a476c7B`](https://sepolia.etherscan.io/token/0x05DB1441d06eC94E89d43ee834B216986a476c7B) | [`0x991C9ad3c61281714b16F3713Cf8def01b3133cE`](https://sepolia.etherscan.io/token/0x991C9ad3c61281714b16F3713Cf8def01b3133cE) |
| Decimals | 18 | 18 |
| Total supply | 1,000,000 DIH (fixed) | 100,000 DN |
| Source code | [`contracts/DIHCoin.sol`](contracts/DIHCoin.sol) | held by the classmate |

### DIH Coin design

DIH has a fixed supply of 1,000,000 tokens and no way to mint more. The whole supply goes to the deploying wallet at deployment. The contract is minimal: it inherits `ERC20` from OpenZeppelin Contracts 5.1.0 and mints the supply in the constructor. Compiled with solc 0.8.27.

- Creator: [`0x35C08726b581Bed87319d13714687A9b354e8871`](https://sepolia.etherscan.io/address/0x35C08726b581Bed87319d13714687A9b354e8871)
- Deployment transaction: [0xcf3b54aa…3534](https://sepolia.etherscan.io/tx/0xcf3b54aa4a5461d745d94a5875169e0cd33a4b012635b695ae69c56633b23534)

## Mandatory lecturer transfer

Recipient: `0x5f3046bD5aA3c6d4575AF09B8198d584f130708E`

| Token | Amount | Transaction |
| --- | --- | --- |
| DIH | 10,000 DIH | [0xc46e16f4…867d](https://sepolia.etherscan.io/tx/0xc46e16f46215f53b02f50d9649172c0bf5dd96f8a99c135981b2d459afc1867d) ✅ Success |
| DN | ≥ 1 DN | sent by the DN token owner |

## Other transfers

| Token | Amount | To | Transaction |
| --- | --- | --- | --- |
| DIH | 1,337 DIH | `0x49E3A4D5971C82BCc892ADb17c4129710c55cA77` | [0xa1decd0f…609d](https://sepolia.etherscan.io/tx/0xa1decd0f4af49cd17e82d53f56c2237ceb087f7f19692fca7bda4a1bbb30609d) ✅ Success |

`totalSupply()` stays at 1,000,000 DIH after the transfers. Only the sender's and recipient's balances change.

## How to get the tokens

1. Add the Sepolia network to MetaMask and get some SepoliaETH from a faucet to pay for gas.
2. Ask the owner to send you DIH (or DN). The DIH owner is `0x35C0…8871`.
3. In MetaMask choose Import tokens and paste the contract address, or press "Add to MetaMask" on the dashboard.
4. You can also buy DIH for SepoliaETH in the Uniswap pool (see below).

## Optional extension: Uniswap pool

A **DIH / ETH** pool on Uniswap v4 (Sepolia) with a 0.25% fee tier and a full price range. Initial price: 1 ETH = 1,000,000 DIH. Liquidity added: 0.030 ETH and 29,999.90 DIH.

- Pool creation transaction: _link to be added_
- Test swap ETH → DIH: _link to be added_

## How the dashboard works

| File | Purpose |
| --- | --- |
| `index.html` | markup and styles |
| `app.js` | all logic: ethers.js v6 (`BrowserProvider`, `Contract`), reads `name/symbol/decimals/totalSupply/balanceOf`, sends with `transfer()` |
| `vendor/ethers-6.13.4.umd.min.js` | ethers.js v6 library (local copy, no external CDN) |
| `contracts/DIHCoin.sol` | DIH token source code |

These checks run before any request is sent to MetaMask:

- The recipient address is validated with `ethers.isAddress`. The zero address and your own address are rejected.
- The amount is converted to base units with `ethers.parseUnits(amount, decimals)`. `decimals` is read from the contract, not hard-coded.
- Zero, negative, non-numeric amounts and amounts above the balance are rejected with a clear message.
- The network is checked right before sending. If it is not Sepolia, the transfer is blocked and the page offers to switch networks.

After signing, the dashboard waits for the receipt (`tx.wait()`). It reports success and re-reads balances from the chain only when `status = 1`. A cancellation in MetaMask is shown as "Transaction cancelled" and no success is claimed. The page has no fields for private keys or seed phrases.

## Mandatory tests

| Test | Expected behaviour | Result |
| --- | --- | --- |
| Both deployments | two unique valid Sepolia contract addresses | ✅ see Tokens |
| Initial supply | `totalSupply` = 1,000,000 DIH, all held by the creator | ✅ |
| Transfers | recipient receives the amount, sender is reduced, supply unchanged | ✅ see transfers |
| Lecturer transfer: Token A | ≥ 1 DIH, confirmed transaction | ✅ 10,000 DIH |
| Lecturer transfer: Token B | ≥ 1 DN, separate transaction | DN owner |
| UI balances | correct balances shown in the public UI | ✅ [screenshot](screenshots/1-balances.jpg) |
| Successful transfer in UI | "Done" message and updated balance | ✅ [screenshot](screenshots/2-successful-transfer.jpg) |
| Wrong address | UI rejects before the wallet request | ✅ [screenshot](screenshots/3-invalid-address.jpg) |
| Excess amount | UI rejects with clear feedback | ✅ [screenshot](screenshots/4-insufficient-balance.jpg) |
| Wrong chain | transfer blocked, Sepolia requested | ✅ [screenshot](screenshots/5-wrong-network.jpg) |
| Zero amount | UI rejects with clear feedback | shown in live demo |
| MetaMask cancellation | UI does not claim a successful transfer | shown in live demo |
| Second wallet | correct balances for a different wallet | shown in live demo |
| Reload | balances still match blockchain state | shown in live demo |

Every scenario in this table was also run automatically on a local chain (Hardhat, chain ID 11155111) in Chromium with a simulated wallet.
