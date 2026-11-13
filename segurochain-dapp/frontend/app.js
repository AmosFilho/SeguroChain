/**
 * SeguroChain dApp — app.js (v1)
 * Web3.js 4.x + MetaMask + Ethereum Sepolia
 *
 * Anotações pra mim:
 *  - contract.methods.fn().call()       → leitura
 *  - contract.methods.fn().send({from}) → escrita (abre o MetaMask)
 */

"use strict";

// CONFIGURAÇÃO

const CONTRACT_ADDRESS = "0xB8949d90b7A59bFB81efcC9E18A6AB36A32e7aA1";

const ABI = [];

// ESTADO GLOBAL

let web3;
let contract;
let conta;

// INICIALIZAÇÃO

window.addEventListener("load", () => {
  if (typeof window.ethereum === "undefined") {
    log("MetaMask não detectado.", "error");
    return;
  }

  web3 = new Web3(window.ethereum);
  contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
  log("Contrato carregado: " + CONTRACT_ADDRESS, "success");
});

// CONEXÃO COM METAMASK

/**
 * TODO: avisar o usuário quando NÃO estiver na Sepolia (chain id 11155111)
 * e recarregar a página quando trocar de conta no MetaMask.
 */
async function conectar() {
  try {
    const contas = await window.ethereum.request({ method: "eth_requestAccounts" });
    conta = contas[0];

    document.getElementById("txt-conta").textContent = conta;
    document.getElementById("info-conexao").classList.remove("hidden");
    document.getElementById("btn-conectar").textContent = "Conectado";

    log("Conectado como " + conta, "success");
  } catch (err) {
    log("Erro ao conectar: " + err.message, "error");
  }
}

// EMITIR APÓLICE (apenas owner)

async function emitirApolice() {
  if (!conta) {
    alert("Conecte a carteira primeiro");
    return;
  }

  try {
    const proprietario  = document.getElementById("e-proprietario").value;
    const modelo        = document.getElementById("e-modelo").value;
    const placa         = document.getElementById("e-placa").value;
    const ano           = parseInt(document.getElementById("e-ano").value);
    const valorEth      = document.getElementById("e-valor-segurado").value;
    const franquiaEth   = document.getElementById("e-franquia").value;
    const dataInicioStr = document.getElementById("e-data-inicio").value;
    const dataFimStr    = document.getElementById("e-data-fim").value;
    const cobColisao    = document.getElementById("cob-colisao").checked;
    const cobRoubo      = document.getElementById("cob-roubo").checked;
    const cobIncendio   = document.getElementById("cob-incendio").checked;

    if (!proprietario || !modelo || !placa || !ano || !valorEth) {
      return mostrarResultado("result-emitir", "Preencha todos os campos.", "warn");
    }

    const valorWei    = web3.utils.toWei(valorEth, "ether");
    const franquiaWei = web3.utils.toWei(franquiaEth, "ether");

    const dataInicio = new Date(dataInicioStr).getTime();
    const dataFim    = new Date(dataFimStr).getTime();

    const coberturas = [cobColisao, cobRoubo, cobIncendio];

    log("Aguardando MetaMask…", "info");

    const receipt = await contract.methods
      .emitirApolice(proprietario, modelo, placa, ano, valorWei, franquiaWei, dataInicio, dataFim, coberturas)
      .send({ from: conta });

    const novoId = receipt.events.ApoliceEmitida.returnValues.id;

    mostrarResultado(
      "result-emitir",
      `Apólice #${novoId} emitida!<br>Tx Hash: ${receipt.transactionHash}`,
      "success"
    );
    log("Apólice #" + novoId + " emitida.", "success");

  } catch (err) {
    mostrarResultado("result-emitir", "Erro: " + err.message, "error");
    log("Erro ao emitir apólice: " + err.message, "error");
  }
}

// CONSULTAR APÓLICE

async function consultarApolice() {
  if (!conta) {
    alert("Conecte a carteira primeiro");
    return;
  }

  try {
    const id = parseInt(document.getElementById("c-apolice-id").value);

    const a = await contract.methods.consultarApolice(id).call();

    document.getElementById("d-id").textContent             = a.id.toString();
    document.getElementById("d-proprietario").textContent   = a.proprietario;
    document.getElementById("d-modelo").textContent         = a.modelo;
    document.getElementById("d-placa").textContent          = a.placa;
    document.getElementById("d-ano").textContent            = a.ano.toString();
    document.getElementById("d-valor-segurado").textContent = web3.utils.fromWei(a.valorSegurado, "ether") + " ETH";
    document.getElementById("d-franquia").textContent       = web3.utils.fromWei(a.franquia, "ether") + " ETH";

    const inicio = new Date(a.dataInicio * 1000).toLocaleDateString("pt-BR");
    const fim    = new Date(a.dataFim * 1000).toLocaleDateString("pt-BR");
    document.getElementById("d-vigencia").textContent = inicio + " → " + fim;

    document.getElementById("d-coberturas").textContent = a.coberturas.join(", ");

    document.getElementById("d-comprometido").textContent =
      web3.utils.fromWei(a.valorComprometido, "ether") + " ETH";

    document.getElementById("d-status").textContent = a.status;

    document.getElementById("result-consultar").classList.remove("hidden");
    log("Apólice #" + id + " carregada.", "success");

  } catch (err) {
    mostrarResultado("result-consultar", "Erro: " + err.message, "error");
    log("Erro ao consultar apólice: " + err.message, "error");
  }
}

// REGISTRAR SINISTRO (segurado)

async function registrarSinistro() {
  if (!conta) {
    alert("Conecte a carteira primeiro");
    return;
  }

  try {
    const apoliceId = parseInt(document.getElementById("s-apolice-id").value);
    const tipo      = parseInt(document.getElementById("s-tipo").value);
    const valorEth  = document.getElementById("s-valor").value;
    const dataStr   = document.getElementById("s-data").value;

    if (!apoliceId || !valorEth || !dataStr) {
      return mostrarResultado("result-sinistro", "Preencha todos os campos.", "warn");
    }

    const valorWei = web3.utils.toWei(valorEth, "ether");
    const dataTs   = new Date(dataStr).getTime();

    log("Aguardando MetaMask…", "info");

    const receipt = await contract.methods
      .registrarSinistro(apoliceId, tipo, valorWei, dataTs)
      .send({ from: conta });

    const novoId = receipt.events.SinistroRegistrado.returnValues.id;

    mostrarResultado(
      "result-sinistro",
      `Sinistro #${novoId} registrado!<br>Tx: ${receipt.transactionHash}`,
      "success"
    );
    log("Sinistro #" + novoId + " registrado.", "success");

  } catch (err) {
    mostrarResultado("result-sinistro", "Erro: " + err.message, "error");
    log("Erro ao registrar sinistro: " + err.message, "error");
  }
}

// ANALISAR SINISTRO (owner)

// TODO: o status do sinistro não muda depois de analisar, nem aparece transação
// no MetaMask. Ver se é call ou send — a função altera o estado do contrato.
async function analisarSinistro() {
  if (!conta) {
    alert("Conecte a carteira primeiro");
    return;
  }

  try {
    const id = parseInt(document.getElementById("a-sinistro-id").value);

    const r = await contract.methods.analisarSinistro(id).call({ from: conta });

    mostrarResultado(
      "result-analisar",
      `${r.aprovado ? "APROVADO" : "REJEITADO"}<br>Motivo: ${r.motivo}`,
      r.aprovado ? "success" : "error"
    );
    log("Sinistro #" + id + " analisado.", "info");

  } catch (err) {
    mostrarResultado("result-analisar", "Erro: " + err.message, "error");
    log("Erro ao analisar sinistro: " + err.message, "error");
  }
}

// PAGAR SINISTRO (owner)

async function pagarSinistro() {
  if (!conta) {
    alert("Conecte a carteira primeiro");
    return;
  }

  try {
    const id = parseInt(document.getElementById("p-sinistro-id").value);

    log("Aguardando MetaMask…", "info");

    const receipt = await contract.methods
      .pagarSinistro(id)
      .send({ from: conta });

    mostrarResultado(
      "result-pagar",
      `Pagamento do sinistro #${id} registrado!<br>Tx: ${receipt.transactionHash}`,
      "success"
    );
    log("Sinistro #" + id + " pago.", "success");

  } catch (err) {
    mostrarResultado("result-pagar", "Erro: " + err.message, "error");
    log("Erro ao pagar sinistro: " + err.message, "error");
  }
}

// UTILITÁRIOS

function mostrarResultado(elId, html, tipo = "info") {
  const el = document.getElementById(elId);
  el.innerHTML = html;
  el.className = `result-box result-${tipo}`;
}

function log(msg, tipo = "info") {
  const logEl = document.getElementById("status-log");
  const entrada = document.createElement("p");
  entrada.className = `log-entry log-${tipo}`;
  entrada.textContent = msg;
  logEl.appendChild(entrada);
}