// Endereço e ABI do contrato SeguroChain na rede Sepolia.
// A cada deploy no Remix, atualizar o endereço (e a ABI, se o contrato mudar).

// Endereço zerado = contrato ainda não configurado
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

// ABI copiada do Remix (Solidity Compiler > ABI)
const ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "placa",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "apoliceId",
        "type": "uint256"
      }
    ],
    "name": "PlacaJaSegurada",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "esperado",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "recebido",
        "type": "uint256"
      }
    ],
    "name": "PremioIncorreto",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "disponivel",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "solicitado",
        "type": "uint256"
      }
    ],
    "name": "SaldoInsuficiente",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "destino",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "valor",
        "type": "uint256"
      }
    ],
    "name": "TransferenciaFalhou",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proprietario",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "premioPago",
        "type": "uint256"
      }
    ],
    "name": "ApoliceAtivada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "ApoliceCancelada",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proprietario",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "modelo",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "placa",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "ano",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valorSegurado",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "franquia",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "dataInicio",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "dataFim",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool[3]",
        "name": "coberturas",
        "type": "bool[3]"
      }
    ],
    "name": "ApoliceEmitida",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "de",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valor",
        "type": "uint256"
      }
    ],
    "name": "FundosDepositados",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "para",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valor",
        "type": "uint256"
      }
    ],
    "name": "FundosSacados",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "apoliceId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "aprovado",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "franquiaAplicada",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valorIndenizacao",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "motivo",
        "type": "string"
      }
    ],
    "name": "SinistroAnalisado",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "apoliceId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valorPago",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "proprietario",
        "type": "address"
      }
    ],
    "name": "SinistroPago",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "apoliceId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "enum SeguroChain.TipoCobertura",
        "name": "tipo",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "valorSolicitado",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "data",
        "type": "uint256"
      }
    ],
    "name": "SinistroRegistrado",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_SINISTROS_POR_APOLICE",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PERCENTUAL_MAXIMO_FRANQUIA",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PERCENTUAL_PERDA_TOTAL",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PERCENTUAL_PREMIO",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "analisarSinistro",
    "outputs": [
      {
        "internalType": "bool",
        "name": "aprovado",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "franquiaAplicada",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "valorIndenizacao",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "motivo",
        "type": "string"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "apoliceAtivaDaPlaca",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "apolices",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "address payable",
        "name": "proprietario",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "modelo",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "placa",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "ano",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "valorSegurado",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "franquia",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "dataInicio",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "dataFim",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "valorComprometido",
        "type": "uint256"
      },
      {
        "internalType": "enum SeguroChain.StatusApolice",
        "name": "status",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "apolicesDoProprietario",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "cancelarApolice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "consultarApolice",
    "outputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "id",
            "type": "uint256"
          },
          {
            "internalType": "address payable",
            "name": "proprietario",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "modelo",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "placa",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "ano",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "valorSegurado",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "franquia",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "dataInicio",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "dataFim",
            "type": "uint256"
          },
          {
            "internalType": "bool[3]",
            "name": "coberturas",
            "type": "bool[3]"
          },
          {
            "internalType": "uint256",
            "name": "valorComprometido",
            "type": "uint256"
          },
          {
            "internalType": "enum SeguroChain.StatusApolice",
            "name": "status",
            "type": "uint8"
          }
        ],
        "internalType": "struct SeguroChain.Apolice",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_apoliceId",
        "type": "uint256"
      },
      {
        "internalType": "enum SeguroChain.StatusSinistro",
        "name": "_status",
        "type": "uint8"
      }
    ],
    "name": "contarSinistrosPorStatus",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "quantidade",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "depositarFundos",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address payable",
        "name": "_proprietario",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "_modelo",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_placa",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "_ano",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_valorSegurado",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_franquia",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_dataInicio",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_dataFim",
        "type": "uint256"
      },
      {
        "internalType": "bool[3]",
        "name": "_coberturas",
        "type": "bool[3]"
      }
    ],
    "name": "emitirApolice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_data",
        "type": "uint256"
      }
    ],
    "name": "estaVigente",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_wallet",
        "type": "address"
      }
    ],
    "name": "listarApolicesProprietario",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_apoliceId",
        "type": "uint256"
      }
    ],
    "name": "listarSinistrosApolice",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address payable",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "pagarPremio",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "pagarSinistro",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_apoliceId",
        "type": "uint256"
      },
      {
        "internalType": "enum SeguroChain.TipoCobertura",
        "name": "_tipo",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "_valorSolicitado",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_data",
        "type": "uint256"
      }
    ],
    "name": "registrarSinistro",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_valor",
        "type": "uint256"
      }
    ],
    "name": "sacarFundos",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "saldoContrato",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "saldoDisponivel",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "saldoLivre",
    "outputs": [
      {
        "internalType": "int256",
        "name": "",
        "type": "int256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "sinistros",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "apoliceId",
        "type": "uint256"
      },
      {
        "internalType": "enum SeguroChain.TipoCobertura",
        "name": "tipo",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "valorSolicitado",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "data",
        "type": "uint256"
      },
      {
        "internalType": "enum SeguroChain.StatusSinistro",
        "name": "status",
        "type": "uint8"
      },
      {
        "internalType": "string",
        "name": "motivo",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "franquiaAplicada",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "valorIndenizacao",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "sinistrosDaApolice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalAPagar",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalApolices",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSinistros",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      }
    ],
    "name": "valorPremio",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
