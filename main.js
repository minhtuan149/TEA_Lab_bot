require('dotenv').config();
const ethers = require('ethers');
const readline = require('readline');
const chalk = require('chalk');
const cliSpinners = require('cli-spinners');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs').promises;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const network = {
    name: 'Tea Sepolia Testnet 🌐',
    rpc: 'https://tea-sepolia.g.alchemy.com/public',
    chainId: 10218,
    symbol: 'TEA',
    explorer: 'https://sepolia.tea.xyz/'
};

const erc20ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)'
];

const stTeaABI = [
    'function stake() payable',
    'function balanceOf(address owner) view returns (uint256)',
    'function withdraw(uint256 _amount)'
];

const stTeaContractAddress = '0x04290DACdb061C6C9A0B9735556744be49A64012';

// Khai báo provider toàn cục ở đầu file
let provider;

showMainMenu();

function showSpinner(message) {
    const spinner = cliSpinners.dots.frames;
    let i = 0;
    const interval = setInterval(() => {
        process.stdout.write(`\r${chalk.yellow(message)} ${spinner[i++ % spinner.length]}`);
    }, 100);
    return () => {
        clearInterval(interval);
        process.stdout.write('\r');
    };
}

async function showMainMenu() {    
    var keyList = await loadPrivateKeys();
    provider = await connectToNetwork();
    console.log(chalk.white('\n===== MAIN MENU ====='));
    console.log(chalk.white('1. Check info wallet'));
    console.log(chalk.white('2. Stake TEA'));
    console.log(chalk.white('6. Exit'));
    console.log(chalk.white('===================='));

    rl.question(chalk.yellow('\nChoose an option (1-6): '), async (answer) => {
        switch (answer) {
            case '1':
                await processWallet(keyList, provider);
                break;
            case '2':
                await handleStaking(keyList);
                break;
            case '6':
                console.log(chalk.white('\n===== EXITING ====='));
                console.log(chalk.white('Thank you for using TEA BOT! 👋'));
                console.log(chalk.white('===================='));
                rl.close();
                process.exit(0);
                break;
            default:
                console.log(chalk.red('Invalid option. Please try again. ⚠️'));
                await showMainMenu();
                break;
        }
    });
}

rl.on('close', () => {
    console.log(chalk.green('\nThank you for using TEA BOT! 👋'));
    process.exit(0);
});

//#region Connect RPC
async function loadPrivateKeys() {
    try {
        // Đọc nội dung file keys.txt theo định dạng utf8
        console.log('đọc danh sách Key...');
        const data = await fs.readFile('keys.txt', 'utf8');
        // Tách thành mảng, loại bỏ các dòng trống và ký tự trắng
        const keys = data.split('\n').map(line => line.trim()).filter(line => line);
        console.log('pass');
        if (keys.length === 0) {
            throw new Error("Không tìm thấy private key trong file keys.txt!");
        }
        return keys;
    } catch (error) {
        console.error('Lỗi khi đọc keys.txt:', error.message);
        process.exit(1);
    }
}

async function connectToNetwork() {
    try {
        let provider = new ethers.providers.JsonRpcProvider(network.rpc);

        // const wallet = new ethers.Wallet(privateKey, provider);
        return provider;
    } catch (error) {
        console.error(chalk.red('Connection error:', error.message, '❌'));
        process.exit(1);
    }
}
//#endregion

//#region 1. Check info wallet
async function processWallet(keyList, provider) {
    await displayBanner(provider);
    console.log(chalk.white('\n===== WALLET INFORMATION ====='));
    console.log(chalk.white(`Address\t\t\t\t\t\tTEA\t\t\t\tstTEA`));
    var index = 0;
    const walletInfoPromises = keyList.map(key => getWalletInfo(index++, key, provider));
    await Promise.all(walletInfoPromises);
    console.log('success');
    showMainMenu();
}

async function displayBanner(provider) {
    try {
        const blockNumber = await provider.getBlockNumber();
        const gasPrice = await provider.getGasPrice();
        const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');
        const bannerText = `
  ${chalk.white('===============================================')}
  ${chalk.cyan('                TEA SEPOLIA AUTO BOT')}
  ${chalk.yellow('     Join Us: https://t.me/AirdropInsiderID ')}
  ${chalk.yellow(`        Block: ${blockNumber} | Gas: ${parseFloat(gasPriceGwei).toFixed(2)} Gwei `)}
  ${chalk.white('===============================================')}
      `;
        console.log(bannerText);
    } catch (error) {
        console.error(chalk.red('Error fetching network status:', error.message, '❌'));
        const bannerText = `
  ${chalk.white('===============================================')}
  ${chalk.cyan('                TEA SEPOLIA AUTO BOT')}
  ${chalk.yellow('     Join Us: https://t.me/AirdropInsiderID ')}
  ${chalk.yellow('     Network status unavailable')}
  ${chalk.white('===============================================')}
      `;
        console.log(bannerText);
    }
}

async function getWalletInfo(index, privateKey, provider) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const address = wallet.address;
    const teaBalance = await provider.getBalance(address);
    const stTeaContract = new ethers.Contract(
        stTeaContractAddress,
        ['function balanceOf(address owner) view returns (uint256)'],
        wallet
    );
    const stTeaBalance = await stTeaContract.balanceOf(address).catch(() => ethers.BigNumber.from(0));
    console.log(chalk.white(`${index}: ${chalk.cyan(address)}\t${chalk.cyan(ethers.utils.formatEther(teaBalance))} ${network.symbol}\t${chalk.cyan(ethers.utils.formatEther(stTeaBalance))} ${network.symbol}`));
    // console.log(chalk.white(`TEA Balance: ${chalk.cyan(ethers.utils.formatEther(teaBalance))} ${network.symbol} `));
    // console.log(chalk.white(`stTEA Balance: ${chalk.cyan(ethers.utils.formatEther(stTeaBalance))} stTEA `));
    // console.log(chalk.white(`Using proxy: ${chalk.cyan('None')} 🌐`));
}
//#endregion

//#region 2. Stake TEA
async function handleStaking(keyList) {
    console.log(chalk.white('\n===== STAKING ====='));
    rl.question(chalk.yellow('Enter amount of TEA to stake: '), async (amountStr) => {
        var amount = parseFloat(amountStr);

        if (isNaN(amount) || amount <= 0) {
            console.log(chalk.red('Invalid amount. Set to default is 1. ⚠️'));
            amount = 1;
        }

        //   await stakeTea(wallet, amount);

        const walletInfoPromises = keyList.map(key => stakeTea(key, amount));
        await Promise.all(walletInfoPromises);

        rl.question(chalk.yellow('\nPress Enter to return to the main menu...'), async () => {
            process.stdout.write('\x1Bc');
            console.clear();
            await showMainMenu();
        });
    });
}

async function stakeTea(key, amount) {
    try {
        const wallet = new ethers.Wallet(key, provider);
        const amountWei = ethers.utils.parseEther(amount.toString());
        const gasPrice = await wallet.provider.getGasPrice();
        const estimatedGas = 200000;
        const gasCost = ethers.utils.formatEther(gasPrice.mul(estimatedGas));

        const baseGasPrice = await wallet.provider.getGasPrice();
        const multiplier = 1.5; // ví dụ, nhân 1.5 lần giá gốc
        // Để đảm bảo tính toán chính xác với ethers.BigNumber, ta chuyển multiplier thành số nguyên bằng cách nhân 100 (hoặc số bất kỳ) rồi chia lại
        const increasedGasPrice = baseGasPrice.mul(ethers.BigNumber.from(Math.floor(multiplier * 100).toString())).div(ethers.BigNumber.from("100"));


        //   const confirmed = await confirmTransaction({
        //     Action: 'Stake',
        //     Amount: `${amount} TEA`,
        //     'Est. Gas': `${gasCost} TEA`,
        //     'estimatedGas': `${estimatedGas}`,
        //     'increasedGasPrice': `${increasedGasPrice}`
        //   });

        //   if (!confirmed) {
        //     console.log(chalk.red('Transaction canceled. 🚫'));
        //     console.log(chalk.white('===== STAKING CANCELED =====\n'));
        //     return null;
        //   }

        const stTeaContract = new ethers.Contract(
            stTeaContractAddress,
            stTeaABI,
            wallet
        );

        console.log(chalk.white('\n===== STAKING TEA ====='));
        console.log(chalk.yellow(`Staking ${amount} TEA...`));

        const tx = await stTeaContract.stake({
            value: amountWei,
            gasLimit: estimatedGas,
            gasPrice: increasedGasPrice  // Sử dụng giá gas đã tăng nhờ multiplier
        });

        console.log(chalk.white(`Transaction sent! Hash: ${chalk.cyan(tx.hash)} 📤`));
        console.log(chalk.gray(`View on explorer: ${network.explorer}/tx/${tx.hash} 🔗`));

        const stopSpinner = showSpinner('Waiting for confirmation...');
        const receipt = await tx.wait();
        stopSpinner();

        console.log(chalk.green(`Transaction confirmed in block ${receipt.blockNumber} ✅`));
        console.log(chalk.green(`Successfully staked ${amount} TEA! 🎉`));
        console.log(chalk.white('===== STAKING COMPLETED =====\n'));

        return receipt;
    } catch (error) {
        console.error(chalk.red('Error staking TEA:', error.message, '❌'));
        console.log(chalk.white('===== STAKING FAILED =====\n'));
        return null;
    }
}