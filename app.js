// ATENÇÃO: UUIDs do Bluetooth. 
// O ESP32 deve usar esses UUIDs, ou você os substitui aqui pelos seus:
// Abaixo estão os UUIDs do perfil UART padrão (Nordic Semiconductor).
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // RX do ESP32 (aplicativo escreve para enviar ao ESP32)

let bluetoothDevice;
let txCharacteristic;

const connectBtn = document.getElementById('connectBtn');
const statusTxt = document.getElementById('statusTxt');
const controlPanel = document.getElementById('controlPanel');

const sliderP = document.getElementById('sliderP');
const sliderI = document.getElementById('sliderI');
const sliderD = document.getElementById('sliderD');
const valP = document.getElementById('valP');
const valI = document.getElementById('valI');
const valD = document.getElementById('valD');
const resetPidBtn = document.getElementById('resetPidBtn');

const angleVal = document.getElementById('angleVal');
const btnPlus = document.getElementById('btnPlus');
const btnMinus = document.getElementById('btnMinus');

let currentAngle = 0.0;

// ======================================
// LÓGICA DE CONEXÃO BLUETOOTH
// ======================================
connectBtn.addEventListener('click', async () => {
    // Se o botão for clicado para "Desconectar"
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
        return;
    }

    try {
        if (!navigator.bluetooth) {
            alert('Seu navegador não suporta Web Bluetooth. Por favor, use o Chrome ou Edge.');
            return;
        }

        statusTxt.innerText = 'Buscando robô...';
        
        // Exibe tela pro usuário selecionar dispositivo (Fica rodando filtro buscando o Serviço UART)
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [UART_SERVICE_UUID] }],
            // Se o seu ESP32 não informa o UART no pareamento, remova a linha acima e use:
            // acceptAllDevices: true,
            // optionalServices: [UART_SERVICE_UUID]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        statusTxt.innerText = 'Pareando...';
        const server = await bluetoothDevice.gatt.connect();

        statusTxt.innerText = 'Obtendo Serviço...';
        const service = await server.getPrimaryService(UART_SERVICE_UUID);

        statusTxt.innerText = 'Habilitando envio...';
        txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

        statusTxt.innerText = 'Conectado e Pronto!';
        connectBtn.innerText = 'Desconectar';
        connectBtn.classList.replace('primary', 'danger');
        
        // Habilita o painel
        controlPanel.classList.remove('disabled');

    } catch (error) {
        console.error("Erro BLE:", error);
        statusTxt.innerText = 'Conexão falhou/cancelada.';
    }
});

function onDisconnected() {
    statusTxt.innerText = 'Status: Desconectado';
    connectBtn.innerText = 'Conectar Bluetooth';
    connectBtn.classList.replace('danger', 'primary');
    controlPanel.classList.add('disabled');
    txCharacteristic = null;
}

// ======================================
// ENVIO DE STRINGS (COMANDOS)
// ======================================
async function sendCommand(commandStr) {
    if (!txCharacteristic) return;
    try {
        const encoder = new TextEncoder();
        // Pode ser necessário incluir o sinal de Nova Linha ('\n') para o ESP32 identificar o fim do comando.
        const data = encoder.encode(commandStr + '\n');
        await txCharacteristic.writeValue(data);
        console.log('Comando enviado:', commandStr);
    } catch (error) {
        console.error('Erro ao enviar o comando:', error);
    }
}

// ======================================
// INTERFACE: SLIDERS (P, I, D)
// ======================================
// Exibe o valor do slider sempre que movido visualmente
function handleSlider(slider, valElement, prefix) {
    // Muda o texto instantaneamente ao deslizar
    slider.addEventListener('input', () => {
        valElement.innerText = slider.value;
    });
    
    // Dispara via Bluetooth SOMENTE quando o dedo é solto, pra não entupir a rede BLE
    slider.addEventListener('change', () => {
        sendCommand(prefix + slider.value);
    });
}

handleSlider(sliderP, valP, 'P');
handleSlider(sliderI, valI, 'I');
handleSlider(sliderD, valD, 'D');

// Reset
resetPidBtn.addEventListener('click', () => {
    sliderP.value = 0; valP.innerText = "0"; sendCommand("P0");
    sliderI.value = 0; valI.innerText = "0"; sendCommand("I0");
    sliderD.value = 0; valD.innerText = "0"; sendCommand("D0");
});

// ======================================
// INTERFACE: ÂNGULO (+ e - )
// ======================================
function updateAngleDisplay() {
    // Atualiza a tela com 1 casa decimal fixa
    angleVal.innerText = currentAngle.toFixed(1);
    // Envia exemplo "A2.5" ou "A-1.0"
    sendCommand("A" + currentAngle.toFixed(1));
}

btnPlus.addEventListener('click', () => {
    currentAngle += 0.1;
    updateAngleDisplay();
});

btnMinus.addEventListener('click', () => {
    currentAngle -= 0.1;
    updateAngleDisplay();
});
