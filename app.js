const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice;
let txCharacteristic;

const connectBtn = document.getElementById('connectBtn');
const connectSpan = connectBtn.querySelector('span');
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

let currentAngle = 90.0;
let kal_q = 0.001;
let kal_r = 0.300;

connectBtn.addEventListener('click', async () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
        return;
    }

    try {
        if (!navigator.bluetooth) {
            alert('Seu navegador não suporta Web Bluetooth. Por favor, use o Chrome ou Edge.');
            return;
        }

        statusTxt.innerText = '● Buscando robô...';
        statusTxt.classList.remove('status-connected');

        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [UART_SERVICE_UUID] }]
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        statusTxt.innerText = '● Pareando...';
        const server = await bluetoothDevice.gatt.connect();

        statusTxt.innerText = '● Obtendo Serviço...';
        const service = await server.getPrimaryService(UART_SERVICE_UUID);

        statusTxt.innerText = '● Conectando TX...';
        txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

        statusTxt.innerText = '● Conectando RX...';
        const rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
        await rxCharacteristic.startNotifications();
        rxCharacteristic.addEventListener('characteristicvaluechanged', handleReceive);

        statusTxt.innerText = '● Conectado';
        statusTxt.classList.add('status-connected');
        connectSpan.innerText = 'Desconectar';
        connectBtn.classList.replace('primary', 'danger');
        connectBtn.classList.remove('glowing-btn');

        controlPanel.classList.remove('disabled');

    } catch (error) {
        console.error("Erro BLE:", error);
        statusTxt.innerText = '● Falha na conexão ou Cancelado';
    }
});

function onDisconnected() {
    statusTxt.innerText = '● Desconectado';
    statusTxt.classList.remove('status-connected');
    connectSpan.innerText = 'Conectar Bluetooth';
    connectBtn.classList.replace('danger', 'primary');
    connectBtn.classList.add('glowing-btn');
    controlPanel.classList.add('disabled');
    txCharacteristic = null;
}

async function sendCommand(commandStr) {
    if (!txCharacteristic) return;
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(commandStr + '\n');
        await txCharacteristic.writeValue(data);
    } catch (error) {
        console.error('Erro:', error);
    }
}

function handleSlider(slider, valElement, prefix) {
    slider.addEventListener('input', () => {
        valElement.innerText = Number(slider.value).toFixed(1).replace('.0', '');
    });

    slider.addEventListener('change', () => {
        sendCommand(prefix + Number(slider.value).toFixed(1));
    });
}

handleSlider(sliderP, valP, 'P');
handleSlider(sliderI, valI, 'I');
handleSlider(sliderD, valD, 'D');

function setupFineTuning(btnMinusId, btnPlusId, sliderId, valId, prefix, stepAmount) {
    const btnMinus = document.getElementById(btnMinusId);
    const btnPlus = document.getElementById(btnPlusId);
    const slider = document.getElementById(sliderId);
    const valElement = document.getElementById(valId);

    function updateValue(delta) {
        if(controlPanel.classList.contains('disabled')) return;
        
        let current = parseFloat(slider.value);
        let next = current + delta;
        let min = parseFloat(slider.min);
        let max = parseFloat(slider.max);
        
        if (next < min) next = min;
        if (next > max) next = max;
        
        slider.value = next;
        
        let precision = (prefix === 'Q' || prefix === 'R' || prefix === 'D') ? 2 : 1;
        let formattedStr = next.toFixed(precision);
        valElement.innerText = formattedStr; 
        sendCommand(prefix + formattedStr);
        
        valElement.style.transform = 'scale(1.25)';
        setTimeout(() => { valElement.style.transform = 'scale(1)'; }, 150);
    }

    btnMinus.addEventListener('click', () => updateValue(-stepAmount));
    btnPlus.addEventListener('click', () => updateValue(stepAmount));
    
    valElement.style.transition = 'transform 0.15s ease-out';
    valElement.style.display = 'inline-block';
}

setupFineTuning('btnMinusP', 'btnPlusP', 'sliderP', 'valP', 'P', 0.1);
setupFineTuning('btnMinusI', 'btnPlusI', 'sliderI', 'valI', 'I', 0.1);
setupFineTuning('btnMinusD', 'btnPlusD', 'sliderD', 'valD', 'D', 0.01);

resetPidBtn.addEventListener('click', () => {
    sliderP.value = 0; valP.innerText = "0"; sendCommand("P0");
    sliderI.value = 0; valI.innerText = "0"; sendCommand("I0");
    sliderD.value = 0; valD.innerText = "0"; sendCommand("D0");
});

function updateAngleDisplay() {
    angleVal.innerText = currentAngle.toFixed(1);
    sendCommand("A" + currentAngle.toFixed(1));
    
    angleVal.style.transform = 'scale(1.1)';
    setTimeout(() => {
        angleVal.style.transform = 'scale(1)';
    }, 150);
}

btnPlus.addEventListener('click', () => {
    currentAngle += 0.1;
    updateAngleDisplay();
});

btnMinus.addEventListener('click', () => {
    currentAngle -= 0.1;
    updateAngleDisplay();
});

// Lógica de Botões para Kalman
function setupKalmanBtn(id, prefix, step) {
    const btnMinus = document.getElementById(`btnMinus${id}`);
    const btnPlus = document.getElementById(`btnPlus${id}`);
    const display = document.getElementById(`display${id}`);
    const valLabel = document.getElementById(`val${id}`);

    function update(delta) {
        if(controlPanel.classList.contains('disabled')) return;
        let val = (id === 'Q') ? kal_q : kal_r;
        val += delta;
        if (val < 0) val = 0;
        if (id === 'Q') kal_q = val; else kal_r = val;
        
        let str = val.toFixed(3);
        display.innerText = str;
        valLabel.innerText = str;
        sendCommand(prefix + str);
    }

    btnMinus.onclick = () => update(-step);
    btnPlus.onclick = () => update(step);
}

setupKalmanBtn('Q', 'Q', 0.01);
setupKalmanBtn('R', 'R', 0.01);

angleVal.style.transition = 'transform 0.15s ease-out';
angleVal.style.display = 'inline-block';

let incomingBuffer = "";
function handleReceive(event) {
    const chunk = new TextDecoder().decode(event.target.value);
    incomingBuffer += chunk;
    
    let newlineIndex;
    while ((newlineIndex = incomingBuffer.indexOf('\n')) !== -1) {
        const line = incomingBuffer.substring(0, newlineIndex).trim();
        incomingBuffer = incomingBuffer.substring(newlineIndex + 1);
        
        if (line.startsWith('Angulo:')) {
            const angStr = line.replace('Angulo:', '').trim();
            const displayCode = document.getElementById('currentAngleDisplay');
            if (displayCode) displayCode.innerText = angStr + '°';
        } else if (line.startsWith('Conectado!')) {
            const parts = line.split(' ');
            parts.forEach(p => {
                const [cmd, val] = p.split(':');
                if (cmd === 'P') { sliderP.value = val; valP.innerText = val; }
                else if (cmd === 'I') { sliderI.value = val; valI.innerText = val; }
                else if (cmd === 'D') { sliderD.value = val; valD.innerText = val; }
                else if (cmd === 'A') { currentAngle = parseFloat(val); angleVal.innerText = val; }
            });
        }
    }
}
