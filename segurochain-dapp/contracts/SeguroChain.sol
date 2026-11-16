// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SeguroChain
/// @author Trabalho 2 — ODS III
/// @notice Contrato de seguro veicular descentralizado na rede Ethereum Sepolia.
///         A seguradora é o endereço que faz o deploy (owner). Os segurados
///         interagem por meio de carteiras MetaMask.
/// @dev    Solidity 0.8.24 — sem overflow, sem SafeMath necessário.
contract SeguroChain {

    // ENUMERAÇÕES
    // [Recurso: StructsEEnums]

    /// @notice Tipos de cobertura disponíveis no seguro
    enum TipoCobertura { COLISAO, ROUBO, INCENDIO }

    /// @notice Ciclo de vida de uma apólice
    enum StatusApolice { PENDENTE, ATIVA, CANCELADA, EXPIRADA }

    /// @notice Ciclo de vida de um sinistro
    enum StatusSinistro { EM_ANALISE, APROVADO, REJEITADO, PAGO }

    // STRUCTS
    // [Recurso: StructsEEnums]

    /// @notice Representa uma apólice de seguro veicular
    struct Apolice {
        uint256 id;
        address payable proprietario; // carteira do segurado, recebe a indenização em ETH
        string  modelo;             // modelo/identificação do veículo
        string  placa;              // placa do veículo
        uint256 ano;                // ano de fabricação do veículo
        uint256 valorSegurado;      // valor máximo de indenização (em wei)
        uint256 franquia;           // valor da franquia (em wei)
        uint256 dataInicio;         // timestamp de início da vigência
        uint256 dataFim;            // timestamp de fim   da vigência
        bool[3] coberturas;         // [0]=COLISAO, [1]=ROUBO, [2]=INCENDIO
        uint256 valorComprometido;  // soma das indenizações aprovadas/pagas
        StatusApolice status;
    }

    /// @notice Representa um sinistro registrado contra uma apólice
    struct Sinistro {
        uint256 id;
        uint256 apoliceId;
        TipoCobertura  tipo;
        uint256 valorSolicitado;    // valor bruto pedido pelo segurado (em wei)
        uint256 data;               // timestamp do evento (sinistro)
        StatusSinistro status;
        string  motivo;             // motivo da decisão da análise
        uint256 franquiaAplicada;   // franquia descontada (pode ser 0)
        uint256 valorIndenizacao;   // valor líquido a pagar (valorSolicitado - franquia)
    }

    // VARIÁVEIS DE ESTADO
    // [Recurso: TiposDeDados]

    /// @notice Endereço da seguradora (deployer). Definido no deploy e não muda mais.
    address payable public immutable owner;

    /// @notice Contador de apólices emitidas (também serve de próximo ID)
    uint256 public totalApolices;

    /// @notice Contador de sinistros registrados (também serve de próximo ID)
    uint256 public totalSinistros;

    /// @notice Soma das indenizações aprovadas que ainda não foram pagas (em wei)
    uint256 public totalAPagar;

    // [Recurso: ArraysEMappings]

    /// @notice Mapeamento ID → Apólice
    mapping(uint256 => Apolice) public apolices;

    /// @notice Mapeamento ID → Sinistro
    mapping(uint256 => Sinistro) public sinistros;

    /// @notice IDs de sinistros vinculados a cada apólice
    mapping(uint256 => uint256[]) public sinistrosDaApolice;

    /// @notice IDs de apólices vinculados a cada carteira
    mapping(address => uint256[]) public apolicesDoProprietario;

    /// @notice Hash da placa → apólice vigente (0 = placa livre).
    ///         Impede duas apólices ao mesmo tempo para o mesmo veículo.
    mapping(bytes32 => uint256) public apoliceAtivaDaPlaca;

    // CONSTANTES DE REGRA DE NEGÓCIO

    /// @notice Percentual máximo da franquia em relação ao valor segurado (20%)
    uint256 public constant PERCENTUAL_MAXIMO_FRANQUIA = 20;

    /// @notice Percentual do valor segurado que caracteriza perda total (75%)
    uint256 public constant PERCENTUAL_PERDA_TOTAL = 75;

    /// @notice Prêmio cobrado do segurado: 5% do valor segurado
    uint256 public constant PERCENTUAL_PREMIO = 5;

    /// @notice Limite de sinistros por apólice (mantém o laço de contagem com custo controlado)
    uint256 public constant MAX_SINISTROS_POR_APOLICE = 10;

    // EVENTOS
    // [Recurso: EventosEErros]

    /// @notice Disparado quando uma nova apólice é emitida
    event ApoliceEmitida(
        uint256 indexed id,
        address indexed proprietario,
        string  modelo,
        string  placa,
        uint256 ano,
        uint256 valorSegurado,
        uint256 franquia,
        uint256 dataInicio,
        uint256 dataFim,
        bool[3] coberturas
    );

    /// @notice Disparado quando o segurado paga o prêmio e a apólice muda para ATIVA
    event ApoliceAtivada(uint256 indexed id, address indexed proprietario, uint256 premioPago);

    /// @notice Disparado quando uma apólice é cancelada
    event ApoliceCancelada(uint256 indexed id);

    /// @notice Disparado quando um sinistro é registrado pelo segurado
    event SinistroRegistrado(
        uint256 indexed id,
        uint256 indexed apoliceId,
        TipoCobertura   tipo,
        uint256 valorSolicitado,
        uint256 data
    );

    /// @notice Disparado quando a seguradora conclui a análise de um sinistro
    event SinistroAnalisado(
        uint256 indexed id,
        uint256 indexed apoliceId,
        bool    aprovado,
        uint256 franquiaAplicada,
        uint256 valorIndenizacao,
        string  motivo
    );

    /// @notice Disparado quando a indenização de um sinistro é paga
    event SinistroPago(
        uint256 indexed id,
        uint256 indexed apoliceId,
        uint256 valorPago,
        address indexed proprietario
    );

    /// @notice Disparado quando a seguradora deposita ETH na reserva
    event FundosDepositados(address indexed de, uint256 valor);

    /// @notice Disparado quando a seguradora saca o excedente da reserva
    event FundosSacados(address indexed para, uint256 valor);

    // ERROS PERSONALIZADOS

    /// @notice Valor enviado em pagarPremio diferente do prêmio da apólice
    error PremioIncorreto(uint256 esperado, uint256 recebido);

    /// @notice Saldo do contrato não cobre o valor pedido
    error SaldoInsuficiente(uint256 disponivel, uint256 solicitado);

    /// @notice A placa já tem uma apólice vigente
    error PlacaJaSegurada(string placa, uint256 apoliceId);

    /// @notice A transferência de ETH foi recusada pelo destino
    error TransferenciaFalhou(address destino, uint256 valor);

    // MODIFIERS
    // [Recurso: Modificadores]

    /// @dev Restringe a chamada ao endereço da seguradora (owner)
    modifier apenasOwner() {
        require(msg.sender == owner, "Apenas a seguradora pode executar esta acao");
        _;
    }

    /// @dev Verifica se uma apólice com o ID fornecido existe
    modifier apoliceExiste(uint256 _id) {
        require(_id > 0 && _id <= totalApolices, "Apolice nao existe");
        _;
    }

    /// @dev Verifica se um sinistro com o ID fornecido existe
    modifier sinistroExiste(uint256 _id) {
        require(_id > 0 && _id <= totalSinistros, "Sinistro nao existe");
        _;
    }

    /// @dev Restringe a chamada ao proprietário da apólice informada
    modifier apenasDono(uint256 _apoliceId) {
        require(
            msg.sender == apolices[_apoliceId].proprietario,
            "Apenas o proprietario da apolice pode executar esta acao"
        );
        _;
    }

    // CONSTRUTOR
    // [Recurso: Funcoes]

    /// @notice Inicializa o contrato definindo o deployer como seguradora (owner)
    constructor() {
        owner = payable(msg.sender);
    }

    // FUNÇÕES DA SEGURADORA — APÓLICES

    /// @notice Emite uma nova apólice de seguro veicular.
    ///         Apenas a seguradora (owner) pode chamar esta função.
    /// @param _proprietario  Endereço da carteira do segurado
    /// @param _modelo        Modelo/identificação do veículo
    /// @param _placa         Placa do veículo
    /// @param _ano           Ano de fabricação do veículo
    /// @param _valorSegurado Valor máximo de indenização (em wei)
    /// @param _franquia      Valor da franquia (em wei)
    /// @param _dataInicio    Timestamp de início da vigência
    /// @param _dataFim       Timestamp de fim da vigência
    /// @param _coberturas    Array de coberturas: [COLISAO, ROUBO, INCENDIO]
    /// @return               ID da apólice criada
    function emitirApolice(
        address payable _proprietario,
        string  calldata _modelo,
        string  calldata _placa,
        uint256 _ano,
        uint256 _valorSegurado,
        uint256 _franquia,
        uint256 _dataInicio,
        uint256 _dataFim,
        bool[3] calldata _coberturas
    )
        external
        apenasOwner
        returns (uint256)
    {
        // [Recurso: EstruturasDeControle]
        // --- Validações básicas ---
        require(_proprietario != address(0),          "Proprietario invalido");
        require(bytes(_modelo).length > 0,            "Modelo obrigatorio");
        require(bytes(_placa).length > 0,             "Placa obrigatoria");
        require(_ano > 1900 && _ano <= 2100,          "Ano invalido");
        require(_valorSegurado > 0,                   "Valor segurado deve ser maior que zero");
        require(_dataFim > _dataInicio,               "Data fim deve ser posterior a data inicio");
        // Aceita início no mesmo dia (até 24h atrás), para a apólice poder começar "hoje"
        require(_dataInicio + 1 days >= block.timestamp, "Data inicio nao pode ser no passado");

        // --- Regra: franquia não pode exceder PERCENTUAL_MAXIMO_FRANQUIA% do valor segurado ---
        uint256 franquiaMaxima = (_valorSegurado * PERCENTUAL_MAXIMO_FRANQUIA) / 100;
        require(_franquia <= franquiaMaxima, "Franquia excede o limite de 20% do valor segurado");

        // --- Pelo menos uma cobertura deve ser contratada ---
        require(
            _coberturas[0] || _coberturas[1] || _coberturas[2],
            "Ao menos uma cobertura deve ser selecionada"
        );

        // --- Criação ---
        uint256 novoId = totalApolices + 1;
        totalApolices  = novoId;

        _reservarPlaca(_placa, novoId);

        apolices[novoId] = Apolice({
            id:               novoId,
            proprietario:     _proprietario,
            modelo:           _modelo,
            placa:            _placa,
            ano:              _ano,
            valorSegurado:    _valorSegurado,
            franquia:         _franquia,
            dataInicio:       _dataInicio,
            dataFim:          _dataFim,
            coberturas:       _coberturas,
            valorComprometido: 0,
            status:           StatusApolice.PENDENTE   // fica ATIVA quando o segurado paga o prêmio
        });

        apolicesDoProprietario[_proprietario].push(novoId);

        emit ApoliceEmitida(
            novoId,
            _proprietario,
            _modelo,
            _placa,
            _ano,
            _valorSegurado,
            _franquia,
            _dataInicio,
            _dataFim,
            _coberturas
        );

        return novoId;
    }

    /// @notice O segurado paga o prêmio em ETH e a apólice que estava pendente fica ATIVA.
    ///         O valor enviado precisa ser exatamente o prêmio (ver valorPremio).
    /// @param _id ID da apólice
    // [Recurso: Funcoes] payable
    function pagarPremio(uint256 _id)
        external
        payable
        apoliceExiste(_id)
        apenasDono(_id)
    {
        require(
            apolices[_id].status == StatusApolice.PENDENTE,
            "Apenas apolices PENDENTE podem ser ativadas"
        );
        uint256 premio = valorPremio(_id);
        if (msg.value != premio) revert PremioIncorreto(premio, msg.value);

        apolices[_id].status = StatusApolice.ATIVA;
        emit ApoliceAtivada(_id, msg.sender, msg.value);
    }

    /// @notice Cancela uma apólice ativa ou pendente.
    /// @param _id ID da apólice
    function cancelarApolice(uint256 _id)
        external
        apenasOwner
        apoliceExiste(_id)
    {
        require(
            apolices[_id].status == StatusApolice.ATIVA ||
            apolices[_id].status == StatusApolice.PENDENTE,
            "Apolice nao pode ser cancelada neste estado"
        );
        apolices[_id].status = StatusApolice.CANCELADA;
        _liberarPlaca(_id);
        emit ApoliceCancelada(_id);
    }

    // FUNÇÕES DE CONSULTA — APÓLICES

    /// @notice Retorna todos os dados de uma apólice.
    /// @param _id ID da apólice
    /// @return Struct Apolice completa
    function consultarApolice(uint256 _id)
        external
        view
        apoliceExiste(_id)
        returns (Apolice memory)
    {
        return apolices[_id];
    }

    /// @notice Retorna o saldo disponível para novas indenizações na apólice.
    ///         saldo = valorSegurado - valorComprometido
    /// @param _id ID da apólice
    /// @return Saldo em wei (0 se esgotado)
    function saldoDisponivel(uint256 _id)
        external
        view
        apoliceExiste(_id)
        returns (uint256)
    {
        Apolice storage a = apolices[_id];
        if (a.valorComprometido >= a.valorSegurado) {
            return 0;
        }
        return a.valorSegurado - a.valorComprometido;
    }

    /// @notice Retorna o prêmio que o segurado precisa pagar para ativar a apólice.
    ///         prêmio = PERCENTUAL_PREMIO% do valor segurado
    /// @param _id ID da apólice
    /// @return Prêmio em wei
    function valorPremio(uint256 _id)
        public
        view
        apoliceExiste(_id)
        returns (uint256)
    {
        return (apolices[_id].valorSegurado * PERCENTUAL_PREMIO) / 100;
    }

    /// @notice Verifica se uma apólice está vigente em determinada data.
    ///         Vigente = status ATIVA e data dentro do intervalo [dataInicio, dataFim].
    /// @param _id   ID da apólice
    /// @param _data Timestamp a verificar
    /// @return true se vigente, false caso contrário
    function estaVigente(uint256 _id, uint256 _data)
        public
        view
        apoliceExiste(_id)
        returns (bool)
    {
        Apolice storage a = apolices[_id];
        return (
            a.status == StatusApolice.ATIVA &&
            _data >= a.dataInicio &&
            _data <= a.dataFim
        );
    }

    /// @notice Lista os IDs de todas as apólices de um proprietário.
    /// @param _wallet Endereço da carteira do segurado
    /// @return Array de IDs
    function listarApolicesProprietario(address _wallet)
        external
        view
        returns (uint256[] memory)
    {
        return apolicesDoProprietario[_wallet];
    }

    // FUNÇÕES DO SEGURADO — SINISTROS

    /// @notice Registra um sinistro contra uma apólice.
    ///         Apenas o proprietário da apólice pode chamar esta função.
    /// @param _apoliceId       ID da apólice
    /// @param _tipo            Tipo de cobertura (TipoCobertura)
    /// @param _valorSolicitado Valor bruto do dano alegado (em wei)
    /// @param _data            Timestamp do evento/sinistro
    /// @return                 ID do sinistro criado
    function registrarSinistro(
        uint256 _apoliceId,
        TipoCobertura _tipo,
        uint256 _valorSolicitado,
        uint256 _data
    )
        external
        apoliceExiste(_apoliceId)
        apenasDono(_apoliceId)
        returns (uint256)
    {
        require(_valorSolicitado > 0, "Valor solicitado deve ser maior que zero");
        require(_data > 0,            "Data do sinistro invalida");
        require(
            sinistrosDaApolice[_apoliceId].length < MAX_SINISTROS_POR_APOLICE,
            "Limite de sinistros da apolice atingido"
        );

        uint256 novoId     = totalSinistros + 1;
        totalSinistros     = novoId;

        sinistros[novoId] = Sinistro({
            id:               novoId,
            apoliceId:        _apoliceId,
            tipo:             _tipo,
            valorSolicitado:  _valorSolicitado,
            data:             _data,
            status:           StatusSinistro.EM_ANALISE,
            motivo:           "",
            franquiaAplicada: 0,
            valorIndenizacao: 0
        });

        sinistrosDaApolice[_apoliceId].push(novoId);

        emit SinistroRegistrado(novoId, _apoliceId, _tipo, _valorSolicitado, _data);

        return novoId;
    }

    // FUNÇÕES DA SEGURADORA — SINISTROS

    /// @notice Analisa um sinistro aplicando as regras de negócio.
    ///         Apenas a seguradora (owner) pode chamar esta função.
    ///
    ///         Regras de negócio:
    ///         1. A apólice deve estar vigente na data do sinistro.
    ///         2. O tipo de sinistro deve ter cobertura contratada.
    ///         3. Franquia é ZERO nos casos:
    ///            a) Tipo ROUBO
    ///            b) Perda total (valorSolicitado >= 75% do valorSegurado)
    ///            Nos demais casos aplica-se a franquia contratada.
    ///         4. O valor solicitado deve ser superior à franquia (quando > 0).
    ///         5. O valor da indenização não pode exceder o saldo disponível.
    ///
    /// @param _id ID do sinistro
    /// @return aprovado          true se aprovado
    /// @return franquiaAplicada  Valor da franquia descontada
    /// @return valorIndenizacao  Valor líquido a ser pago
    /// @return motivo            Descrição textual da decisão
    function analisarSinistro(uint256 _id)
        external
        apenasOwner
        sinistroExiste(_id)
        returns (
            bool    aprovado,
            uint256 franquiaAplicada,
            uint256 valorIndenizacao,
            string memory motivo
        )
    {
        Sinistro storage s = sinistros[_id];
        require(s.status == StatusSinistro.EM_ANALISE, "Sinistro ja foi analisado");

        Apolice storage a = apolices[s.apoliceId];

        // --- Regra 1: vigência ---
        if (!estaVigente(s.apoliceId, s.data)) {
            motivo            = "Apolice nao estava vigente na data do sinistro";
            aprovado          = false;
            franquiaAplicada  = 0;
            valorIndenizacao  = 0;
            s.status          = StatusSinistro.REJEITADO;
            s.motivo          = motivo;
            emit SinistroAnalisado(_id, s.apoliceId, false, 0, 0, motivo);
            return (aprovado, franquiaAplicada, valorIndenizacao, motivo);
        }

        // --- Regra 2: cobertura ---
        uint256 tipoIdx = uint256(s.tipo);
        if (!a.coberturas[tipoIdx]) {
            motivo            = string(abi.encodePacked(
                "Cobertura do tipo ", _toString(tipoIdx), " nao contratada"
            ));
            aprovado          = false;
            franquiaAplicada  = 0;
            valorIndenizacao  = 0;
            s.status          = StatusSinistro.REJEITADO;
            s.motivo          = motivo;
            emit SinistroAnalisado(_id, s.apoliceId, false, 0, 0, motivo);
            return (aprovado, franquiaAplicada, valorIndenizacao, motivo);
        }

        // --- Regra 3: calcular franquia ---
        bool perdaTotal = (s.valorSolicitado * 100) >= (a.valorSegurado * PERCENTUAL_PERDA_TOTAL);
        bool isRoubo    = (s.tipo == TipoCobertura.ROUBO);

        if (isRoubo || perdaTotal) {
            franquiaAplicada = 0;   // sem franquia para roubo ou perda total
        } else {
            franquiaAplicada = a.franquia;
        }

        // --- Regra 4: valor solicitado deve superar a franquia ---
        if (franquiaAplicada > 0 && s.valorSolicitado <= franquiaAplicada) {
            motivo = string(abi.encodePacked(
                "Valor solicitado (",
                _toString(s.valorSolicitado),
                " wei) nao supera a franquia (",
                _toString(franquiaAplicada),
                " wei)"
            ));
            aprovado         = false;
            valorIndenizacao = 0;
            s.status         = StatusSinistro.REJEITADO;
            s.motivo         = motivo;
            s.franquiaAplicada = franquiaAplicada;
            emit SinistroAnalisado(_id, s.apoliceId, false, franquiaAplicada, 0, motivo);
            return (aprovado, franquiaAplicada, valorIndenizacao, motivo);
        }

        // --- Calcular indenização líquida ---
        valorIndenizacao = s.valorSolicitado - franquiaAplicada;

        // --- Regra 5: saldo disponível ---
        uint256 saldo = a.valorSegurado > a.valorComprometido
            ? a.valorSegurado - a.valorComprometido
            : 0;

        if (valorIndenizacao > saldo) {
            motivo = string(abi.encodePacked(
                "Indenizacao (",
                _toString(valorIndenizacao),
                " wei) excede o saldo disponivel (",
                _toString(saldo),
                " wei)"
            ));
            aprovado         = false;
            valorIndenizacao = 0;
            s.status         = StatusSinistro.REJEITADO;
            s.motivo         = motivo;
            s.franquiaAplicada = franquiaAplicada;
            emit SinistroAnalisado(_id, s.apoliceId, false, franquiaAplicada, 0, motivo);
            return (aprovado, franquiaAplicada, valorIndenizacao, motivo);
        }

        // --- Aprovado ---
        aprovado = true;
        motivo = perdaTotal
            ? "Aprovado - perda total (franquia zerada)"
            : isRoubo
                ? "Aprovado - roubo (franquia zerada)"
                : "Aprovado";

        s.status            = StatusSinistro.APROVADO;
        s.motivo            = motivo;
        s.franquiaAplicada  = franquiaAplicada;
        s.valorIndenizacao  = valorIndenizacao;
        a.valorComprometido += valorIndenizacao;
        totalAPagar         += valorIndenizacao;

        emit SinistroAnalisado(_id, s.apoliceId, true, franquiaAplicada, valorIndenizacao, motivo);
        return (aprovado, franquiaAplicada, valorIndenizacao, motivo);
    }

    /// @notice Paga a indenização de um sinistro aprovado, transferindo ETH do
    ///         contrato para a carteira do segurado.
    ///         Apenas a seguradora (owner) pode chamar esta função.
    /// @param _id ID do sinistro
    function pagarSinistro(uint256 _id)
        external
        apenasOwner
        sinistroExiste(_id)
    {
        Sinistro storage s = sinistros[_id];
        require(s.status == StatusSinistro.APROVADO, "Sinistro deve estar APROVADO para ser pago");

        uint256 valor = s.valorIndenizacao;
        if (address(this).balance < valor) {
            revert SaldoInsuficiente(address(this).balance, valor);
        }

        // Atualiza o estado antes de transferir (checks-effects-interactions):
        // se a chamada voltar para cá, o sinistro já está como PAGO
        s.status     = StatusSinistro.PAGO;
        totalAPagar -= valor;

        address payable proprietario = apolices[s.apoliceId].proprietario;

        (bool ok, ) = proprietario.call{value: valor}("");
        if (!ok) revert TransferenciaFalhou(proprietario, valor);

        emit SinistroPago(_id, s.apoliceId, valor, proprietario);
    }

    // FUNÇÕES DA SEGURADORA — RESERVA DE FUNDOS

    /// @notice A seguradora deposita ETH no contrato para pagar as indenizações.
    // [Recurso: Funcoes] payable
    function depositarFundos() external payable apenasOwner {
        require(msg.value > 0, "Envie algum valor em ETH");
        emit FundosDepositados(msg.sender, msg.value);
    }

    /// @notice A seguradora saca o que sobra na reserva. Não é possível sacar
    ///         o valor das indenizações já aprovadas e ainda não pagas.
    /// @param _valor Valor a sacar (em wei)
    function sacarFundos(uint256 _valor) external apenasOwner {
        int256 livre = saldoLivre();
        if (livre < 0 || uint256(livre) < _valor) {
            revert SaldoInsuficiente(livre < 0 ? 0 : uint256(livre), _valor);
        }

        emit FundosSacados(owner, _valor);

        (bool ok, ) = owner.call{value: _valor}("");
        if (!ok) revert TransferenciaFalhou(owner, _valor);
    }

    /// @notice Saldo de ETH guardado no contrato.
    function saldoContrato() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Saldo do contrato menos as indenizações aprovadas e ainda não pagas.
    ///         Fica negativo quando falta dinheiro para pagar o que já foi aprovado.
    // [Recurso: TiposDeDados] int256, pois o resultado pode ser negativo
    function saldoLivre() public view returns (int256) {
        return int256(address(this).balance) - int256(totalAPagar);
    }

    // FUNÇÕES DE CONSULTA — SINISTROS

    /// @notice Lista os IDs de todos os sinistros de uma apólice.
    /// @param _apoliceId ID da apólice
    /// @return Array de IDs de sinistros
    function listarSinistrosApolice(uint256 _apoliceId)
        external
        view
        apoliceExiste(_apoliceId)
        returns (uint256[] memory)
    {
        return sinistrosDaApolice[_apoliceId];
    }

    /// @notice Conta quantos sinistros de uma apólice estão em determinado status.
    /// @param _apoliceId ID da apólice
    /// @param _status    Status a contar
    /// @return quantidade Número de sinistros nesse status
    function contarSinistrosPorStatus(uint256 _apoliceId, StatusSinistro _status)
        external
        view
        apoliceExiste(_apoliceId)
        returns (uint256 quantidade)
    {
        uint256[] storage ids = sinistrosDaApolice[_apoliceId];
        // [Recurso: EstruturasDeControle]
        // O laço é limitado: cada apólice tem no máximo MAX_SINISTROS_POR_APOLICE sinistros
        for (uint256 i = 0; i < ids.length; i++) {
            if (sinistros[ids[i]].status == _status) {
                quantidade++;
            }
        }
    }

    // FUNÇÕES INTERNAS / AUXILIARES

    /// @dev Registra a placa como segurada, usando o hash da placa como chave.
    // [Recurso: Funcoes] private
    function _reservarPlaca(string calldata _placa, uint256 _apoliceId) private {
        // [Recurso: TiposDeDados] bytes32
        bytes32 hashPlaca = keccak256(bytes(_placa));
        uint256 existente = apoliceAtivaDaPlaca[hashPlaca];
        if (existente != 0) revert PlacaJaSegurada(_placa, existente);
        apoliceAtivaDaPlaca[hashPlaca] = _apoliceId;
    }

    /// @dev Libera a placa quando a apólice é cancelada.
    function _liberarPlaca(uint256 _apoliceId) internal {
        bytes32 hashPlaca = keccak256(bytes(apolices[_apoliceId].placa));
        if (apoliceAtivaDaPlaca[hashPlaca] == _apoliceId) {
            delete apoliceAtivaDaPlaca[hashPlaca];
        }
    }

    /// @dev Converte um uint256 para sua representação em string decimal.
    ///      Usado internamente para compor mensagens de motivo.
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp   = value;
        uint256 digits = 0;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}
