import fs from 'fs';
import path from 'path';
import solc from 'solc';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escrowSource = fs.readFileSync(path.join(__dirname, '..', 'contracts', 'MisthosEscrow.sol'), 'utf8');
const mockUsdcSource = fs.readFileSync(path.join(__dirname, '..', 'contracts', 'MockUSDC.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'MisthosEscrow.sol': { content: escrowSource },
    'MockUSDC.sol': { content: mockUsdcSource },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

console.log('Compiling MisthosEscrow.sol and MockUSDC.sol...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
  let hasErrors = false;
  output.errors.forEach((err) => {
    if (err.severity === 'error') {
      hasErrors = true;
      console.error('ERROR:', err.formattedMessage);
    } else {
      console.warn('WARNING:', err.formattedMessage);
    }
  });
  if (hasErrors) process.exit(1);
}

const artifactDir = path.join(__dirname, '..', 'src', 'contracts');
if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

const escrowContract = output.contracts['MisthosEscrow.sol']['MisthosEscrow'];
fs.writeFileSync(
  path.join(artifactDir, 'MisthosEscrow.json'),
  JSON.stringify({
    contractName: 'MisthosEscrow',
    abi: escrowContract.abi,
    bytecode: escrowContract.evm.bytecode.object,
  }, null, 2)
);

const mockUsdcContract = output.contracts['MockUSDC.sol']['MockUSDC'];
fs.writeFileSync(
  path.join(artifactDir, 'MockUSDC.json'),
  JSON.stringify({
    contractName: 'MockUSDC',
    abi: mockUsdcContract.abi,
    bytecode: mockUsdcContract.evm.bytecode.object,
  }, null, 2)
);

console.log('Successfully compiled all contracts and generated JSON artifacts!');
