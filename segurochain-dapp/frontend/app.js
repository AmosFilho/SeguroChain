/**
 * SeguroChain dApp — app.js
 * Web3.js 4.x + MetaMask + Ethereum Sepolia
 *
 * Padrões Web3.js v4 importantes:
 *  - new Web3(window.ethereum)          → conecta ao provider injetado pelo MetaMask
 *  - contract.methods.fn().call()       → leitura (view/pure), sem gas, sem tx
 *  - contract.methods.fn().send({from}) → escrita, abre popup MetaMask, retorna receipt
 *  - web3.utils.toWei(valor, 'ether')   → converte ETH → wei (BigInt no v4)
 *  - web3.utils.fromWei(wei, 'ether')   → converte wei → ETH (string)
 *
 * O endereço e a ABI do contrato ficam em contrato.js.
 */

"use strict";

// ID da rede Sepolia
const SEPOLIA_CHAIN_ID = 11155111;

// ESTADO GLOBAL

let web3;         // instância Web3
let contract;     // instância do contrato
let conta;        // endereço MetaMask conectado

// INICIALIZAÇÃO

/**
 * Inicializa o Web3 e o contrato assim que a página carrega.
 * Verifica se o MetaMask está instalado.
 */
window.addEventListener("load", () => {
  if (typeof window.ethereum === "undefined") {
    log("❌ MetaMask não detectado. Instale a extensão MetaMask para usar este dApp.", "error");
    return;
  }

  // Web3.js v4: passa o provider do MetaMask diretamente
  web3 = new Web3(window.ethereum);

  // Instancia o contrato (leitura disponível antes de conectar a carteira)
  if (ABI.length > 0 && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
    document.getElementById("footer-address").textContent = CONTRACT_ADDRESS;
    log("✅ Contrato carregado: " + CONTRACT_ADDRESS, "success");
  } else {
    log("⚠️ ABI ou CONTRACT_ADDRESS não configurados. Edite app.js após o deploy.", "warn");
  }

  // Escuta mudanças de conta no MetaMask → recarrega a página
  window.ethereum.on("accountsChanged", () => {
    log("🔄 Conta alterada — recarregando…", "info");
    window.location.reload();
  });

  // Escuta mudanças de rede no MetaMask → recarrega a página
  window.ethereum.on("chainChanged", () => {
    log("🔄 Rede alterada — recarregando…", "info");
    window.location.reload();
  });

  // Se o site já foi autorizado antes, reconecta sem abrir o popup
  // (assim a tela volta preenchida depois do reload de troca de conta/rede)
  window.ethereum.request({ method: "eth_accounts" }).then((contas) => {
    if (contas.length > 0) conectar();
  });
});

// CONEXÃO COM METAMASK

/**
 * Solicita acesso à carteira MetaMask via eth_requestAccounts.
 * Web3.js v4: window.ethereum.request() retorna uma Promise.
 */
async function conectar() {
  try {
    // Abre o popup do MetaMask para o usuário autorizar o acesso
    const contas = await window.ethereum.request({ method: "eth_requestAccounts" });
    conta = contas[0];

    // Lê o Chain ID atual (retorna string hexadecimal)
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);

    // Atualiza a UI
    document.getElementById("txt-conta").textContent = conta;
    document.getElementById("txt-rede").textContent = `${chainId}`;
    document.getElementById("info-conexao").classList.remove("hidden");
    document.getElementById("msg-desconectado").classList.add("hidden");
    document.getElementById("btn-conectar").textContent = "✅ Conectado";
    document.getElementById("btn-conectar").disabled = true;

    // Alerta se não estiver na Sepolia
    const avisoRede = document.getElementById("aviso-rede");
    if (chainId !== SEPOLIA_CHAIN_ID) {
      avisoRede.classList.remove("hidden");
      log(`⚠️ Você está na rede Chain ID ${chainId}. Por favor, troque para Sepolia (11155111).`, "warn");
    } else {
      avisoRede.classList.add("hidden");
      log(`✅ Conectado como ${conta} na Sepolia.`, "success");
    }

    // Saldo da conta em ETH
    const saldo = await web3.eth.getBalance(conta);
    document.getElementById("txt-saldo").textContent = formatarEth(saldo);

    // Só lê o contrato se estiver na rede certa
    if (chainId === SEPOLIA_CHAIN_ID && contract) {
      await configurarPerfil();
      atualizarDados();
    }
  } catch (err) {
    log("❌ Erro ao conectar: " + traduzirErro(err), "error");
  }
}

/**
 * Pede para o MetaMask trocar para a Sepolia (wallet_switchEthereumChain).
 * Se a rede não estiver cadastrada na carteira (erro 4902), adiciona antes.
 */
async function trocarParaSepolia() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0xaa36a7",
          chainName: "Sepolia",
          nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    } else {
      log("❌ Não foi possível trocar de rede: " + traduzirErro(err), "error");
    }
  }
}

/**
 * Descobre se a conta conectada é a seguradora (owner) e mostra
 * só as seções do perfil dela: área da seguradora ou área do segurado.
 */
async function configurarPerfil() {
  const owner = await contract.methods.owner().call();
  const ehOwner = owner.toLowerCase() === conta.toLowerCase();

  document.querySelectorAll(".area-owner").forEach((s) => s.classList.toggle("hidden", !ehOwner));
  document.querySelectorAll(".area-segurado").forEach((s) => s.classList.toggle("hidden", ehOwner));

  // Troca as cores da página para o tema do segurado
  document.body.classList.toggle("assegurado-page", !ehOwner);

  const perfil = document.getElementById("txt-perfil");
  perfil.textContent = ehOwner ? "Seguradora" : "Segurado";
  perfil.className = `badge ${ehOwner ? "badge-owner" : "badge-user"}`;
}

// EMITIR APÓLICE (apenas owner)

/**
 * Lê os campos do formulário e chama emitirApolice() no contrato.
 * web3.utils.toWei() converte o valor ETH → wei (string/BigInt no v4).
 * .send({ from }) abre o popup MetaMask para assinar a transação.
 */
async function emitirApolice() {
  if (!verificarPronto("result-emitir")) return;

  try {
    const proprietario   = document.getElementById("e-proprietario").value.trim();
    const modelo         = document.getElementById("e-modelo").value.trim();
    const placa          = document.getElementById("e-placa").value.trim();
    const ano            = parseInt(document.getElementById("e-ano").value);
    const valorEth       = document.getElementById("e-valor-segurado").value.trim();
    const franquiaEth    = document.getElementById("e-franquia").value.trim();
    const dataInicioStr  = document.getElementById("e-data-inicio").value;
    const dataFimStr     = document.getElementById("e-data-fim").value;
    const cobColisao     = document.getElementById("cob-colisao").checked;
    const cobRoubo       = document.getElementById("cob-roubo").checked;
    const cobIncendio    = document.getElementById("cob-incendio").checked;

    // Validações básicas no frontend
    if (!proprietario || !modelo || !placa || !ano || !valorEth || !dataInicioStr || !dataFimStr) {
      return mostrarResultado("result-emitir", "⚠️ Preencha todos os campos obrigatórios.", "warn");
    }
    if (!cobColisao && !cobRoubo && !cobIncendio) {
      return mostrarResultado("result-emitir", "⚠️ Selecione ao menos uma cobertura.", "warn");
    }

    // Converte ETH → wei usando Web3.js v4
    // toWei() aceita string; no v4 retorna BigInt
    const valorWei    = web3.utils.toWei(valorEth, "ether");
    const franquiaWei = web3.utils.toWei(franquiaEth || "0", "ether");

    // Converte datas para timestamps Unix (segundos)
    const dataInicio = Math.floor(new Date(dataInicioStr).getTime() / 1000);
    const dataFim    = Math.floor(new Date(dataFimStr).getTime() / 1000);

    // Array de coberturas: [COLISAO, ROUBO, INCENDIO]
    const coberturas = [cobColisao, cobRoubo, cobIncendio];

    log("⏳ Aguardando confirmação no MetaMask para emitir apólice…", "info");

    // .send() → transação — abre popup MetaMask
    const receipt = await enviarTransacao(
      contract.methods.emitirApolice(
        proprietario,
        modelo,
        placa,
        ano,
        valorWei,
        franquiaWei,
        dataInicio,
        dataFim,
        coberturas
      ),
      { from: conta },
      "result-emitir"
    );

    // Extrai o ID da apólice emitido pelo evento ApoliceEmitida
    const evento = receipt.events?.ApoliceEmitida;
    const novoId = evento?.returnValues?.id ?? "N/A";

    mostrarResultado(
      "result-emitir",
      `✅ Apólice #${novoId} emitida com sucesso!<br>
       ${statusConfirmada(receipt)}`,
      "success"
    );
    log(`✅ Apólice #${novoId} emitida. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-emitir", "❌ Erro: " + msg, "error");
    log("❌ Erro ao emitir apólice: " + msg, "error");
  }
}

// CONSULTAR APÓLICE

/**
 * Busca os dados de uma apólice pelo ID.
 * .call() → leitura gratuita (view), sem transação.
 */
async function consultarApolice() {
  // Erros vão para uma caixa separada, para não apagar a tabela de resultado
  if (!verificarPronto("erro-consultar")) return;
  document.getElementById("erro-consultar").classList.add("hidden");

  try {
    const id = parseInt(document.getElementById("c-apolice-id").value);
    if (!id || id < 1) {
      return mostrarResultado("erro-consultar", "⚠️ Informe um ID válido.", "warn");
    }

    log(`⏳ Consultando apólice #${id}…`, "info");

    // .call() → leitura — retorna struct como objeto no Web3.js v4
    const a = await contract.methods.consultarApolice(id).call();

    // Consulta também o saldo disponível
    const saldo = await contract.methods.saldoDisponivel(id).call();

    // Preenche a tabela
    document.getElementById("d-id").textContent           = a.id.toString();
    document.getElementById("d-proprietario").textContent = a.proprietario;
    document.getElementById("d-modelo").textContent       = a.modelo;
    document.getElementById("d-placa").textContent        = a.placa;
    document.getElementById("d-ano").textContent          = a.ano.toString();
    document.getElementById("d-valor-segurado").textContent =
      web3.utils.fromWei(a.valorSegurado.toString(), "ether") + " ETH";
    document.getElementById("d-franquia").textContent =
      web3.utils.fromWei(a.franquia.toString(), "ether") + " ETH";

    const inicio = new Date(Number(a.dataInicio) * 1000).toLocaleDateString("pt-BR");
    const fim    = new Date(Number(a.dataFim)    * 1000).toLocaleDateString("pt-BR");
    document.getElementById("d-vigencia").textContent = `${inicio} → ${fim}`;

    // Coberturas: array bool[3]
    const nomes = ["Colisão", "Roubo", "Incêndio"];
    const cobAtivas = a.coberturas
      .map((c, i) => c ? nomes[i] : null)
      .filter(Boolean)
      .join(", ") || "Nenhuma";
    document.getElementById("d-coberturas").textContent = cobAtivas;

    document.getElementById("d-comprometido").textContent =
      web3.utils.fromWei(a.valorComprometido.toString(), "ether") + " ETH";
    document.getElementById("d-saldo").textContent =
      web3.utils.fromWei(saldo.toString(), "ether") + " ETH";

    const premio = await contract.methods.valorPremio(id).call();
    document.getElementById("d-premio").textContent = formatarEth(premio);

    // Sinistros da apólice
    const idsSinistros = await contract.methods.listarSinistrosApolice(id).call();
    const tbody = document.getElementById("tb-sinistros-apolice");
    tbody.innerHTML = "";
    if (idsSinistros.length === 0) {
      adicionarLinha(tbody, ["Nenhum sinistro registrado."], 6);
    }
    for (const sid of idsSinistros) {
      const s = await contract.methods.sinistros(sid).call();
      const st = Number(s.status);
      const pago = st === 1 || st === 3;
      adicionarLinha(tbody, [
        `#${s.id}`,
        TIPOS[Number(s.tipo)],
        formatarEth(s.valorSolicitado),
        pago ? formatarEth(s.valorIndenizacao) : "—",
        STATUS_SINISTRO[st],
        s.motivo || "—",
      ]);
    }

    // Status com badge colorido
    const statusNomes = ["PENDENTE", "ATIVA", "CANCELADA", "EXPIRADA"];
    const statusClasses = ["badge-yellow", "badge-green", "badge-red", "badge-gray"];
    const statusIdx = Number(a.status);
    document.getElementById("d-status").innerHTML =
      `<span class="badge ${statusClasses[statusIdx]}">${statusNomes[statusIdx]}</span>`;

    document.getElementById("result-consultar").classList.remove("hidden");
    log(`✅ Apólice #${id} carregada.`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    document.getElementById("result-consultar").classList.add("hidden");
    mostrarResultado("erro-consultar", "❌ Erro: " + msg, "error");
    log("❌ Erro ao consultar apólice: " + msg, "error");
  }
}

// SEÇÃO 4 · REGISTRAR SINISTRO (segurado)

/**
 * Registra um novo sinistro para a apólice informada.
 * Apenas o proprietário da apólice pode chamar esta função.
 */
async function registrarSinistro() {
  if (!verificarPronto("result-sinistro")) return;

  try {
    const apoliceId     = parseInt(document.getElementById("s-apolice-id").value);
    const tipo          = parseInt(document.getElementById("s-tipo").value);
    const valorEth      = document.getElementById("s-valor").value.trim();
    const dataStr       = document.getElementById("s-data").value;

    if (!apoliceId || !valorEth || !dataStr) {
      return mostrarResultado("result-sinistro", "⚠️ Preencha todos os campos.", "warn");
    }

    const valorWei = web3.utils.toWei(valorEth, "ether");
    let dataTs     = Math.floor(new Date(dataStr).getTime() / 1000);

    // O campo só guarda minutos: se a data escolhida é o minuto atual, usa o horário exato.
    // Sem isso, um sinistro registrado logo após pagar o prêmio ficaria com horário
    // anterior ao início da cobertura e seria rejeitado.
    const agora = Math.floor(Date.now() / 1000);
    if (dataTs <= agora && agora - dataTs < 60) dataTs = agora;

    log(`⏳ Aguardando confirmação no MetaMask para registrar sinistro…`, "info");

    const receipt = await enviarTransacao(
      contract.methods.registrarSinistro(apoliceId, tipo, valorWei, dataTs),
      { from: conta },
      "result-sinistro"
    );

    const evento  = receipt.events?.SinistroRegistrado;
    const novoId  = evento?.returnValues?.id ?? "N/A";

    mostrarResultado(
      "result-sinistro",
      `✅ Sinistro #${novoId} registrado com sucesso!<br>
       Situação do sinistro: EM ANÁLISE<br>
       ${statusConfirmada(receipt)}`,
      "success"
    );
    log(`✅ Sinistro #${novoId} registrado. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-sinistro", "❌ Erro: " + msg, "error");
    log("❌ Erro ao registrar sinistro: " + msg, "error");
  }
}

// ANALISAR SINISTRO (owner)

/**
 * Aciona a análise automática de um sinistro pelo contrato.
 * As regras de negócio (vigência, cobertura, franquia, saldo) são
 * verificadas on-chain. O resultado é capturado pelo evento SinistroAnalisado.
 */
async function analisarSinistro() {
  if (!verificarPronto("result-analisar")) return;

  try {
    const id = parseInt(document.getElementById("a-sinistro-id").value);
    if (!id || id < 1) {
      return mostrarResultado("result-analisar", "⚠️ Informe um ID válido.", "warn");
    }

    log(`⏳ Aguardando confirmação no MetaMask para analisar sinistro #${id}…`, "info");

    // analisarSinistro() é uma função de escrita (muda estado) que também
    // retorna valores. No Web3.js v4 usamos .send() e capturamos o evento.
    const receipt = await enviarTransacao(
      contract.methods.analisarSinistro(id),
      { from: conta },
      "result-analisar"
    );

    // Captura os dados do evento SinistroAnalisado emitido pelo contrato
    const evento = receipt.events?.SinistroAnalisado;
    if (evento) {
      const rv            = evento.returnValues;
      const aprovado      = rv.aprovado;
      const franquia      = web3.utils.fromWei(rv.franquiaAplicada.toString(), "ether");
      const indenizacao   = web3.utils.fromWei(rv.valorIndenizacao.toString(), "ether");
      const motivo        = rv.motivo;

      const classe = aprovado ? "result-approved" : "result-rejected";
      const icone  = aprovado ? "✅" : "❌";

      mostrarResultado(
        "result-analisar",
        `<div class="${classe}">
          <strong>${icone} ${aprovado ? "APROVADO" : "REJEITADO"}</strong><br>
          Motivo: ${motivo}<br>
          Franquia Aplicada: ${franquia} ETH<br>
          Valor de Indenização: ${indenizacao} ETH
        </div>
        ${statusConfirmada(receipt)}`,
        aprovado ? "success" : "error"
      );
      log(`${icone} Sinistro #${id} ${aprovado ? "APROVADO" : "REJEITADO"}: ${motivo}`, aprovado ? "success" : "error");
    } else {
      mostrarResultado("result-analisar", "✅ Análise concluída. Verifique os eventos na transação.", "success");
    }

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-analisar", "❌ Erro: " + msg, "error");
    log("❌ Erro ao analisar sinistro: " + msg, "error");
  }
}

// PAGAR SINISTRO (owner)

/**
 * Registra o pagamento de um sinistro aprovado.
 * Apenas o owner pode chamar esta função.
 */
async function pagarSinistro() {
  if (!verificarPronto("result-pagar")) return;

  try {
    const id = parseInt(document.getElementById("p-sinistro-id").value);
    if (!id || id < 1) {
      return mostrarResultado("result-pagar", "⚠️ Informe um ID válido.", "warn");
    }

    log(`⏳ Aguardando confirmação no MetaMask para pagar o sinistro #${id}…`, "info");

    const receipt = await enviarTransacao(
      contract.methods.pagarSinistro(id),
      { from: conta },
      "result-pagar"
    );

    const evento = receipt.events?.SinistroPago;
    const valor  = evento
      ? web3.utils.fromWei(evento.returnValues.valorPago.toString(), "ether")
      : "N/A";

    mostrarResultado(
      "result-pagar",
      `✅ Indenização do sinistro #${id} paga ao segurado!<br>
       Valor: ${valor} ETH<br>
       ${statusConfirmada(receipt)}`,
      "success"
    );
    log(`✅ Sinistro #${id} pago (${valor} ETH). Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-pagar", "❌ Erro: " + msg, "error");
    log("❌ Erro ao pagar sinistro: " + msg, "error");
  }
}

// PAGAR PRÊMIO (segurado)

/**
 * O segurado paga o prêmio da apólice em ETH.
 * O valor é lido do contrato (valorPremio) e enviado no campo "value".
 */
async function pagarPremio() {
  if (!verificarPronto("result-premio")) return;

  try {
    const id = parseInt(document.getElementById("pr-apolice-id").value);
    if (!id || id < 1) {
      return mostrarResultado("result-premio", "⚠️ Informe um ID válido.", "warn");
    }

    const premio = await contract.methods.valorPremio(id).call();
    log(`⏳ Aguardando confirmação no MetaMask para pagar ${formatarEth(premio)} de prêmio…`, "info");

    const receipt = await enviarTransacao(
      contract.methods.pagarPremio(id),
      { from: conta, value: premio },
      "result-premio"
    );

    mostrarResultado(
      "result-premio",
      `✅ Prêmio de ${formatarEth(premio)} pago. A apólice #${id} está ATIVA.<br>
       ${statusConfirmada(receipt)}`,
      "success"
    );
    log(`✅ Prêmio da apólice #${id} pago. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-premio", "❌ Erro: " + msg, "error");
    log("❌ Erro ao pagar prêmio: " + msg, "error");
  }
}

// RESERVA DE FUNDOS (owner)

/** A seguradora deposita ETH no contrato para pagar indenizações. */
async function depositarFundos() {
  if (!verificarPronto("result-reserva")) return;

  try {
    const valorEth = document.getElementById("r-deposito").value.trim();
    if (!valorEth || Number(valorEth) <= 0) {
      return mostrarResultado("result-reserva", "⚠️ Informe um valor maior que zero.", "warn");
    }
    const valorWei = web3.utils.toWei(valorEth, "ether");

    const receipt = await enviarTransacao(
      contract.methods.depositarFundos(),
      { from: conta, value: valorWei },
      "result-reserva"
    );

    mostrarResultado("result-reserva", `✅ ${valorEth} ETH depositados na reserva.<br>${statusConfirmada(receipt)}`, "success");
    log(`✅ Depósito de ${valorEth} ETH. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-reserva", "❌ Erro: " + msg, "error");
    log("❌ Erro ao depositar: " + msg, "error");
  }
}

/** A seguradora saca o que sobra na reserva (o contrato não deixa sacar o que já foi aprovado). */
async function sacarFundos() {
  if (!verificarPronto("result-reserva")) return;

  try {
    const valorEth = document.getElementById("r-saque").value.trim();
    if (!valorEth || Number(valorEth) <= 0) {
      return mostrarResultado("result-reserva", "⚠️ Informe um valor maior que zero.", "warn");
    }
    const valorWei = web3.utils.toWei(valorEth, "ether");

    const receipt = await enviarTransacao(
      contract.methods.sacarFundos(valorWei),
      { from: conta },
      "result-reserva"
    );

    mostrarResultado("result-reserva", `✅ ${valorEth} ETH sacados da reserva.<br>${statusConfirmada(receipt)}`, "success");
    log(`✅ Saque de ${valorEth} ETH. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-reserva", "❌ Erro: " + msg, "error");
    log("❌ Erro ao sacar: " + msg, "error");
  }
}

// CANCELAR APÓLICE (owner)

async function cancelarApolice() {
  if (!verificarPronto("result-cancelar")) return;

  try {
    const id = parseInt(document.getElementById("x-apolice-id").value);
    if (!id || id < 1) {
      return mostrarResultado("result-cancelar", "⚠️ Informe um ID válido.", "warn");
    }
    if (!confirm(`Cancelar a apólice #${id}? Essa ação não pode ser desfeita.`)) return;

    const receipt = await enviarTransacao(
      contract.methods.cancelarApolice(id),
      { from: conta },
      "result-cancelar"
    );

    mostrarResultado("result-cancelar", `✅ Apólice #${id} cancelada.<br>${statusConfirmada(receipt)}`, "success");
    log(`✅ Apólice #${id} cancelada. Tx: ${receipt.transactionHash}`, "success");

  } catch (err) {
    const msg = traduzirErro(err);
    mostrarResultado("result-cancelar", "❌ Erro: " + msg, "error");
    log("❌ Erro ao cancelar apólice: " + msg, "error");
  }
}

// LEITURAS: PAINEL, MINHAS APÓLICES E EVENTOS

/** Atualiza painel, lista de apólices e eventos (chamada após cada transação). */
function atualizarDados() {
  carregarPainel();
  carregarMinhasApolices();
  carregarEventos();
}

/** Lê os totais do contrato com .call() e preenche o painel. */
async function carregarPainel() {
  if (!contract) return;
  try {
    const [totalApolices, totalSinistros, saldo, aPagar, livre] = await Promise.all([
      contract.methods.totalApolices().call(),
      contract.methods.totalSinistros().call(),
      contract.methods.saldoContrato().call(),
      contract.methods.totalAPagar().call(),
      contract.methods.saldoLivre().call(),
    ]);

    document.getElementById("p-total-apolices").textContent = totalApolices.toString();
    document.getElementById("p-total-sinistros").textContent = totalSinistros.toString();
    document.getElementById("p-saldo-contrato").textContent = formatarEth(saldo);
    document.getElementById("p-total-apagar").textContent = formatarEth(aPagar);

    // saldoLivre é int256 e pode ser negativo (falta dinheiro para o que já foi aprovado)
    const elLivre = document.getElementById("p-saldo-livre");
    const negativo = BigInt(livre) < 0n;
    elLivre.textContent = (negativo ? "-" : "") + formatarEth(negativo ? -BigInt(livre) : livre);
    elLivre.classList.toggle("valor-negativo", negativo);
  } catch (err) {
    log("❌ Erro ao ler o painel: " + traduzirErro(err), "error");
  }
}

/** Lista as apólices da conta conectada, com o prêmio e o status de cada uma. */
async function carregarMinhasApolices() {
  if (!contract || !conta) return;
  const tbody = document.getElementById("tb-minhas-apolices");
  try {
    const ids = await contract.methods.listarApolicesProprietario(conta).call();
    tbody.innerHTML = "";
    if (ids.length === 0) {
      adicionarLinha(tbody, ["Nenhuma apólice emitida para esta carteira."], 4);
      return;
    }
    for (const id of ids) {
      const a = await contract.methods.consultarApolice(id).call();
      const premio = await contract.methods.valorPremio(id).call();
      adicionarLinha(tbody, [
        `#${a.id}`,
        `${a.modelo} · ${a.placa}`,
        formatarEth(premio),
        STATUS_APOLICE[Number(a.status)],
      ]);
    }
  } catch (err) {
    log("❌ Erro ao listar apólices: " + traduzirErro(err), "error");
  }
}

/**
 * Lê os eventos do contrato com getPastEvents e mostra os mais recentes primeiro.
 * Busca a partir do bloco do deploy (DEPLOY_BLOCK em contrato.js).
 */
async function carregarEventos() {
  if (!contract) return;
  const lista = document.getElementById("lista-eventos");
  try {
    const eventos = await contract.getPastEvents("allEvents", {
      fromBlock: DEPLOY_BLOCK,
      toBlock: "latest",
    });

    lista.innerHTML = "";
    if (eventos.length === 0) {
      lista.innerHTML = "<li>Nenhum evento encontrado.</li>";
      return;
    }

    eventos.reverse().slice(0, 30).forEach((ev) => {
      const li = document.createElement("li");
      li.textContent = descreverEvento(ev);

      const detalhe = document.createElement("small");
      const link = document.createElement("a");
      link.href = `https://sepolia.etherscan.io/tx/${ev.transactionHash}`;
      link.target = "_blank";
      link.textContent = `bloco ${ev.blockNumber}`;
      detalhe.append(`${ev.event} · `, link);
      li.appendChild(detalhe);

      lista.appendChild(li);
    });
  } catch (err) {
    lista.innerHTML = "";
    adicionarItem(lista, "Não foi possível ler os eventos: " + traduzirErro(err));
  }
}

/** Monta um texto legível para cada tipo de evento do contrato. */
function descreverEvento(ev) {
  const r = ev.returnValues;
  switch (ev.event) {
    case "ApoliceEmitida":     return `Apólice #${r.id} emitida para ${encurtar(r.proprietario)} (placa ${r.placa})`;
    case "ApoliceAtivada":     return `Prêmio da apólice #${r.id} pago (${formatarEth(r.premioPago)}), apólice ATIVA`;
    case "ApoliceCancelada":   return `Apólice #${r.id} cancelada`;
    case "SinistroRegistrado": return `Sinistro #${r.id} (${TIPOS[Number(r.tipo)]}) registrado na apólice #${r.apoliceId}: ${formatarEth(r.valorSolicitado)}`;
    case "SinistroAnalisado":  return `Sinistro #${r.id} ${r.aprovado ? "APROVADO" : "REJEITADO"}: ${r.motivo}`;
    case "SinistroPago":       return `Sinistro #${r.id} pago: ${formatarEth(r.valorPago)} para ${encurtar(r.proprietario)}`;
    case "FundosDepositados":  return `Depósito de ${formatarEth(r.valor)} na reserva`;
    case "FundosSacados":      return `Saque de ${formatarEth(r.valor)} da reserva`;
    default:                   return ev.event;
  }
}

// TRANSAÇÕES E ERROS

/**
 * Envia uma transação mostrando o estado na caixa de resultado:
 * pendente (com o hash) → confirmada (quem chamou mostra o recibo) ou falhou (erro vai para o catch).
 *
 * Antes de enviar, simula a chamada com .call(): se o contrato for reverter,
 * o erro aparece já decodificado (ex.: SaldoInsuficiente) e nenhum gas é gasto.
 */
async function enviarTransacao(metodo, opcoes, resultElId) {
  await metodo.call(opcoes);

  mostrarResultado(resultElId, "⏳ Aguardando assinatura no MetaMask…", "info");

  const receipt = await metodo.send(opcoes).on("transactionHash", (hash) => {
    mostrarResultado(resultElId, `⏳ Transação pendente, aguardando confirmação…<br>Tx: ${linkTx(hash)}`, "warn");
    log(`⏳ Transação enviada: ${hash}`, "info");
  });

  log(`✅ Transação confirmada no bloco ${receipt.blockNumber}: ${receipt.transactionHash}`, "success");
  atualizarDados();
  return receipt;
}

/** Linha padrão de transação confirmada: bloco e link para o Etherscan. */
function statusConfirmada(receipt) {
  return `Status: confirmada no bloco ${receipt.blockNumber}<br>Tx: ${linkTx(receipt.transactionHash)}`;
}

/**
 * Converte os erros do MetaMask, do Web3 e do contrato em mensagens claras.
 * Os erros personalizados do contrato chegam decodificados pela ABI (errorName + errorArgs).
 */
function traduzirErro(err) {
  if (!err) return "Erro desconhecido.";

  const codigo = err.code ?? err.cause?.code;
  if (codigo === 4001 || /User denied|rejected/i.test(err.message || "")) {
    return "Transação rejeitada no MetaMask.";
  }

  const detalhe = err.innerError || err.cause || {};
  const a = detalhe.errorArgs || {};
  switch (detalhe.errorName) {
    case "PremioIncorreto":
      return `Valor do prêmio incorreto: esperado ${formatarEth(a.esperado)}, enviado ${formatarEth(a.recebido)}.`;
    case "SaldoInsuficiente":
      return `Saldo insuficiente no contrato: disponível ${formatarEth(a.disponivel)}, necessário ${formatarEth(a.solicitado)}.`;
    case "PlacaJaSegurada":
      return `A placa ${a.placa} já tem a apólice #${a.apoliceId} vigente.`;
    case "TransferenciaFalhou":
      return `A transferência de ${formatarEth(a.valor)} para ${encurtar(a.destino)} falhou.`;
    case "Error":
      return a.message;   // mensagem de um require()
  }

  const texto = `${err.message || ""} ${detalhe.message || ""}`;
  // A simulação (.call) devolve "insufficient balance"; o envio devolve "insufficient funds"
  if (/insufficient (funds|balance)/i.test(texto)) {
    return "Saldo de ETH insuficiente na carteira para pagar o valor e o gas.";
  }
  // Transação minerada mas revertida (o recibo vem com status 0)
  if (/reverted by the EVM/i.test(texto)) {
    return "A transação falhou: foi revertida pelo contrato.";
  }
  return detalhe.message || err.message || String(err);
}

// UTILITÁRIOS

const TIPOS = ["Colisão", "Roubo", "Incêndio"];
const STATUS_APOLICE = ["PENDENTE", "ATIVA", "CANCELADA", "EXPIRADA"];
const STATUS_SINISTRO = ["EM ANÁLISE", "APROVADO", "REJEITADO", "PAGO"];

/** Converte wei (BigInt ou string) para texto em ETH. */
function formatarEth(wei) {
  return web3.utils.fromWei(wei.toString(), "ether") + " ETH";
}

/** Mostra só o começo e o fim de um endereço: 0x1234…abcd */
function encurtar(endereco) {
  return `${endereco.slice(0, 6)}…${endereco.slice(-4)}`;
}

/** Link para a transação no Sepolia Etherscan. */
function linkTx(hash) {
  return `<a href="https://sepolia.etherscan.io/tx/${hash}" target="_blank">${hash}</a>`;
}

/**
 * Adiciona uma linha numa tabela usando textContent
 * (dados vindos da blockchain não são inseridos como HTML).
 */
function adicionarLinha(tbody, valores, colspan) {
  const tr = document.createElement("tr");
  valores.forEach((v) => {
    const td = document.createElement("td");
    td.textContent = v;
    if (colspan) td.colSpan = colspan;
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
}

function adicionarItem(lista, texto) {
  const li = document.createElement("li");
  li.textContent = texto;
  lista.appendChild(li);
}

/**
 * Verifica se o Web3, o contrato e a conta estão prontos para uso.
 * Exibe mensagem de erro no elemento indicado se algo estiver faltando.
 * @param {string} resultElId ID do elemento de resultado para exibir erros
 * @returns {boolean} true se tudo estiver pronto
 */
function verificarPronto(resultElId) {
  if (!web3) {
    mostrarResultado(resultElId, "❌ MetaMask não detectado.", "error");
    return false;
  }
  if (!contract) {
    mostrarResultado(resultElId, "❌ Contrato não configurado. Edite app.js com o CONTRACT_ADDRESS e ABI corretos.", "error");
    return false;
  }
  if (!conta) {
    mostrarResultado(resultElId, "⚠️ Conecte sua carteira MetaMask primeiro.", "warn");
    return false;
  }
  return true;
}

/**
 * Exibe uma mensagem de resultado em um elemento da página.
 * @param {string} elId     ID do elemento
 * @param {string} html     Conteúdo HTML da mensagem
 * @param {string} tipo     "success" | "error" | "warn" | "info"
 */
function mostrarResultado(elId, html, tipo = "info") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = html;
  el.className = `result-box result-${tipo}`;
  el.classList.remove("hidden");
}

/**
 * Adiciona uma entrada ao log de atividade.
 * @param {string} msg  Mensagem
 * @param {string} tipo "success" | "error" | "warn" | "info"
 */
function log(msg, tipo = "info") {
  const logEl = document.getElementById("status-log");
  if (!logEl) return;

  const hora    = new Date().toLocaleTimeString("pt-BR");
  const entrada = document.createElement("p");
  entrada.className = `log-entry log-${tipo}`;
  entrada.textContent = `[${hora}] ${msg}`;

  // Insere no topo (mensagem mais recente primeiro)
  logEl.insertBefore(entrada, logEl.firstChild);
}

/** Limpa todas as entradas do log de atividade. */
function limparLog() {
  const logEl = document.getElementById("status-log");
  if (logEl) logEl.innerHTML = "";
}
