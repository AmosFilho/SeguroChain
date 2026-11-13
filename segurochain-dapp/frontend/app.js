/**
 * SeguroChain dApp — app.js (v2)
 * Web3.js 4.x + MetaMask + Ethereum Sepolia
 *
 * Padrões Web3.js v4:
 *  - new Web3(window.ethereum)          → conecta ao provider do MetaMask
 *  - contract.methods.fn().call()       → leitura (view/pure), sem gas
 *  - contract.methods.fn().send({from}) → escrita, abre popup MetaMask
 *  - web3.utils.toWei(valor, 'ether')   → ETH → wei
 *  - web3.utils.fromWei(wei, 'ether')   → wei → ETH
 */

"use strict";

// CONFIGURAÇÃO

const CONTRACT_ADDRESS = "0xB8949d90b7A59bFB81efcC9E18A6AB36A32e7aA1";

const ABI = [];

const SEPOLIA_CHAIN_ID = 11155111;

// ESTADO GLOBAL

let web3;
let contract;
let conta;

// INICIALIZAÇÃO

window.addEventListener("load", () => {
  if (typeof window.ethereum === "undefined") {
    log("❌ MetaMask não detectado. Instale a extensão para usar este dApp.", "error");
    return;
  }

  web3 = new Web3(window.ethereum);
  contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
  log("✅ Contrato carregado: " + CONTRACT_ADDRESS, "success");

  window.ethereum.on("accountsChanged", () => {
    log("🔄 Conta alterada — recarregando…", "info");
    window.location.reload();
  });

  // TODO: fazer o mesmo pro chainChanged, senão o usuário troca de rede
  // e a página continua achando que está na Sepolia.
});

// CONEXÃO COM METAMASK

async function conectar() {
  try {
    const contas = await window.ethereum.request({ method: "eth_requestAccounts" });
    conta = contas[0];

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);

    document.getElementById("txt-conta").textContent = conta;
    document.getElementById("txt-rede").textContent = `${chainId}`;
    document.getElementById("info-conexao").classList.remove("hidden");

    const avisoRede = document.getElementById("aviso-rede");
    if (chainId !== SEPOLIA_CHAIN_ID) {
      avisoRede.classList.remove("hidden");
      log(`⚠️ Rede Chain ID ${chainId}. Troque para Sepolia (11155111).`, "warn");
    } else {
      avisoRede.classList.add("hidden");
      log(`✅ Conectado como ${conta} na Sepolia.`, "success");
    }
  } catch (err) {
    log("❌ Erro ao conectar: " + (err.message || err), "error");
  }
}

// EMITIR APÓLICE (apenas owner)

/**
 * TODO: validar se pelo menos uma cobertura foi marcada antes de enviar
 * e trocar o hash da transação por link do Etherscan.
 */
async function emitirApolice() {
  if (!verificarPronto("result-emitir")) return;

  try {
    const proprietario  = document.getElementById("e-proprietario").value.trim();
    const modelo        = document.getElementById("e-modelo").value.trim();
    const placa         = document.getElementById("e-placa").value.trim();
    const ano           = parseInt(document.getElementById("e-ano").value);
    const valorEth      = document.getElementById("e-valor-segurado").value.trim();
    const franquiaEth   = document.getElementById("e-franquia").value.trim();
    const dataInicioStr = document.getElementById("e-data-inicio").value;
    const dataFimStr    = document.getElementById("e-data-fim").value;
    const cobColisao    = document.getElementById("cob-colisao").checked;
    const cobRoubo      = document.getElementById("cob-roubo").checked;
    const cobIncendio   = document.getElementById("cob-incendio").checked;

    if (!proprietario || !modelo || !placa || !ano || !valorEth || !dataInicioStr || !dataFimStr) {
      return mostrarResultado("result-emitir", "⚠️ Preencha todos os campos obrigatórios.", "warn");
    }

    const valorWei    = web3.utils.toWei(valorEth, "ether");
    const franquiaWei = web3.utils.toWei(franquiaEth || "0", "ether");

    const dataInicio = Math.floor(new Date(dataInicioStr).getTime() / 1000);
    const dataFim    = Math.floor(new Date(dataFimStr).getTime() / 1000);

    const coberturas = [cobColisao, cobRoubo, cobIncendio];

    log("⏳ Aguardando confirmação no MetaMask para emitir apólice…", "info");

    const receipt = await contract.methods
      .emitirApolice(proprietario, modelo, placa, ano, valorWei, franquiaWei, dataInicio, dataFim, coberturas)
      .send({ from: conta });

    const novoId = receipt.events?.ApoliceEmitida?.returnValues?.id ?? "N/A";

    mostrarResultado(
      "result-emitir",
      `✅ Apólice #${novoId} emitida com sucesso!<br>Tx Hash: ${receipt.transactionHash}`,
      "success"
    );
    log(`✅ Apólice #${novoId} emitida. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = err.message || String(err);
    mostrarResultado("result-emitir", "❌ Erro: " + msg, "error");
    log("❌ Erro ao emitir apólice: " + msg, "error");
  }
}

// CONSULTAR APÓLICE

async function consultarApolice() {
  if (!verificarPronto("result-consultar")) return;

  try {
    const id = parseInt(document.getElementById("c-apolice-id").value);
    if (!id || id < 1) {
      return mostrarResultado("result-consultar", "⚠️ Informe um ID válido.", "warn");
    }

    log(`⏳ Consultando apólice #${id}…`, "info");

    const a = await contract.methods.consultarApolice(id).call();

    document.getElementById("d-id").textContent             = a.id.toString();
    document.getElementById("d-proprietario").textContent   = a.proprietario;
    document.getElementById("d-modelo").textContent         = a.modelo;
    document.getElementById("d-placa").textContent          = a.placa;
    document.getElementById("d-ano").textContent            = a.ano.toString();
    document.getElementById("d-valor-segurado").textContent =
      web3.utils.fromWei(a.valorSegurado.toString(), "ether") + " ETH";
    document.getElementById("d-franquia").textContent =
      web3.utils.fromWei(a.franquia.toString(), "ether") + " ETH";

    const inicio = new Date(Number(a.dataInicio) * 1000).toLocaleDateString("pt-BR");
    const fim    = new Date(Number(a.dataFim)    * 1000).toLocaleDateString("pt-BR");
    document.getElementById("d-vigencia").textContent = `${inicio} → ${fim}`;

    const nomes = ["Colisão", "Roubo", "Incêndio"];
    const cobAtivas = a.coberturas
      .map((c, i) => c ? nomes[i] : null)
      .filter(Boolean)
      .join(", ") || "Nenhuma";
    document.getElementById("d-coberturas").textContent = cobAtivas;

    document.getElementById("d-comprometido").textContent =
      web3.utils.fromWei(a.valorComprometido.toString(), "ether") + " ETH";

    const statusNomes = ["PENDENTE", "ATIVA", "CANCELADA", "EXPIRADA"];
    document.getElementById("d-status").textContent = statusNomes[Number(a.status)];

    document.getElementById("result-consultar").classList.remove("hidden");
    log(`✅ Apólice #${id} carregada.`, "success");

  } catch (err) {
    const msg = err.message || String(err);
    mostrarResultado("result-consultar", "❌ Erro: " + msg, "error");
    log("❌ Erro ao consultar apólice: " + msg, "error");
  }
}

// REGISTRAR SINISTRO (segurado)

async function registrarSinistro() {
  if (!verificarPronto("result-sinistro")) return;

  try {
    const apoliceId = parseInt(document.getElementById("s-apolice-id").value);
    const tipo      = parseInt(document.getElementById("s-tipo").value);
    const valorEth  = document.getElementById("s-valor").value.trim();
    const dataStr   = document.getElementById("s-data").value;

    if (!apoliceId || !valorEth || !dataStr) {
      return mostrarResultado("result-sinistro", "⚠️ Preencha todos os campos.", "warn");
    }

    const valorWei = web3.utils.toWei(valorEth, "ether");
    const dataTs   = Math.floor(new Date(dataStr).getTime() / 1000);

    log("⏳ Aguardando confirmação no MetaMask para registrar sinistro…", "info");

    const receipt = await contract.methods
      .registrarSinistro(apoliceId, tipo, valorWei, dataTs)
      .send({ from: conta });

    const novoId = receipt.events?.SinistroRegistrado?.returnValues?.id ?? "N/A";

    mostrarResultado(
      "result-sinistro",
      `✅ Sinistro #${novoId} registrado com sucesso!<br>Status: EM ANÁLISE<br>Tx: ${receipt.transactionHash}`,
      "success"
    );
    log(`✅ Sinistro #${novoId} registrado. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = err.message || String(err);
    mostrarResultado("result-sinistro", "❌ Erro: " + msg, "error");
    log("❌ Erro ao registrar sinistro: " + msg, "error");
  }
}

// ANALISAR SINISTRO (owner)

async function analisarSinistro() {
  if (!verificarPronto("result-analisar")) return;

  try {
    const id = parseInt(document.getElementById("a-sinistro-id").value);
    if (!id || id < 1) {
      return mostrarResultado("result-analisar", "⚠️ Informe um ID válido.", "warn");
    }

    log(`⏳ Aguardando confirmação no MetaMask para analisar sinistro #${id}…`, "info");

    const receipt = await contract.methods
      .analisarSinistro(id)
      .send({ from: conta });

    const evento = receipt.events?.SinistroAnalisado;
    if (evento) {
      const rv          = evento.returnValues;
      const aprovado    = rv.aprovado;
      const franquia    = web3.utils.fromWei(rv.franquiaAplicada.toString(), "ether");
      const indenizacao = web3.utils.fromWei(rv.valorIndenizacao.toString(), "ether");

      mostrarResultado(
        "result-analisar",
        `<strong>${aprovado ? "APROVADO" : "REJEITADO"}</strong><br>
         Motivo: ${rv.motivo}<br>
         Franquia Aplicada: ${franquia} ETH<br>
         Valor de Indenização: ${indenizacao} ETH<br>
         Tx: ${receipt.transactionHash}`,
        aprovado ? "success" : "error"
      );
      log(`Sinistro #${id} ${aprovado ? "APROVADO" : "REJEITADO"}: ${rv.motivo}`, aprovado ? "success" : "error");
    } else {
      mostrarResultado("result-analisar", "✅ Análise concluída.", "success");
    }

  } catch (err) {
    const msg = err.message || String(err);
    mostrarResultado("result-analisar", "❌ Erro: " + msg, "error");
    log("❌ Erro ao analisar sinistro: " + msg, "error");
  }
}

// PAGAR SINISTRO (owner)

async function pagarSinistro() {
  if (!verificarPronto("result-pagar")) return;

  try {
    const id = parseInt(document.getElementById("p-sinistro-id").value);
    if (!id || id < 1) {
      return mostrarResultado("result-pagar", "⚠️ Informe um ID válido.", "warn");
    }

    log(`⏳ Aguardando confirmação no MetaMask para pagar sinistro #${id}…`, "info");

    const receipt = await contract.methods
      .pagarSinistro(id)
      .send({ from: conta });

    mostrarResultado(
      "result-pagar",
      `✅ Pagamento do sinistro #${id} registrado!<br>Tx: ${receipt.transactionHash}`,
      "success"
    );
    log(`✅ Sinistro #${id} pago. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = err.message || String(err);
    mostrarResultado("result-pagar", "❌ Erro: " + msg, "error");
    log("❌ Erro ao pagar sinistro: " + msg, "error");
  }
}

// UTILITÁRIOS

function verificarPronto(resultElId) {
  if (!web3) {
    mostrarResultado(resultElId, "❌ MetaMask não detectado.", "error");
    return false;
  }
  if (!contract) {
    mostrarResultado(resultElId, "❌ Contrato não configurado.", "error");
    return false;
  }
  if (!conta) {
    mostrarResultado(resultElId, "⚠️ Conecte sua carteira MetaMask primeiro.", "warn");
    return false;
  }
  return true;
}

function mostrarResultado(elId, html, tipo = "info") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = html;
  el.className = `result-box result-${tipo}`;
  el.classList.remove("hidden");
}

function log(msg, tipo = "info") {
  const logEl = document.getElementById("status-log");
  if (!logEl) return;

  const hora    = new Date().toLocaleTimeString("pt-BR");
  const entrada = document.createElement("p");
  entrada.className = `log-entry log-${tipo}`;
  entrada.textContent = `[${hora}] ${msg}`;

  logEl.insertBefore(entrada, logEl.firstChild);
}