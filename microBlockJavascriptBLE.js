// Support for Web Bluetooth

// MicroBlocks UUIDs:
const MICROBLOCKS_SERVICE_UUID = 'bb37a001-b922-4018-8e74-e14824b3a638'
const MICROBLOCKS_RX_CHAR_UUID = 'bb37a002-b922-4018-8e74-e14824b3a638' // board receive characteristic
const MICROBLOCKS_TX_CHAR_UUID = 'bb37a003-b922-4018-8e74-e14824b3a638' // board transmit characteristic

const BLE_PACKET_LEN = 240; // Max BLE attribute length is 512 but 240 gives best performance

class NimBLESerial {
    // Device to communicate over BLE using the Nordic Semiconductor UART service

    constructor() {
        this.device = undefined;
        this.service = undefined;
        this.rx_char = undefined;
        this.connected = false;
        this.sendInProgress = false;
    }

    handle_disconnected(event) {
        this.rx_char = undefined;
        this.connected = false;
        this.sendInProgress = false;
    }

    handle_read(event) {
        let data = new Uint8Array(event.target.value.buffer);
        GP_serialInputBuffers.push(data);
    }

    async connect() {
        // Connect to a microBit
        this.device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [MICROBLOCKS_SERVICE_UUID] }]
        })
        this.device.addEventListener('gattserverdisconnected', this.handle_disconnected.bind(this));
        const server = await this.device.gatt.connect();
        this.service = await server.getPrimaryService(MICROBLOCKS_SERVICE_UUID);
        const tx_char = await this.service.getCharacteristic(MICROBLOCKS_TX_CHAR_UUID);
        this.rx_char = await this.service.getCharacteristic(MICROBLOCKS_RX_CHAR_UUID);
        await tx_char.startNotifications();
        // bind overrides the default this=tx_char to this=the NimBLESerial
        tx_char.addEventListener("characteristicvaluechanged", this.handle_read.bind(this));
        this.connected = true;
        this.sendInProgress = false;
        console.log("MicroBlocks BLE connected");
    }

    disconnect() {
        if (this.device != undefined) {
            this.device.gatt.disconnect();
        }
    }

    isConnected() {
        return this.connected;
    }

    write_data(data) {
        // Write the given data (a Uint8Array) and return the number of bytes written.
        // Detail: if not busy, start write_loop with as much data as we can send.

        if (this.rx_char == undefined) {
            throw TypeError("Not connected");
        }
        if (this.sendInProgress) {
            return 0;
        }
        let byteCount = (data.length > BLE_PACKET_LEN) ? BLE_PACKET_LEN : data.length;
        this.write_loop(data.subarray(0, byteCount));
        return byteCount;
    }

    async write_loop(data) {
        this.sendInProgress = true;
        while (true) {
            // try to send the given data until success
            try {
                await this.rx_char.writeValue(data);
                this.sendInProgress = false;
                return;
            } catch (error) {
                // for now: print the error but keep trying to send
                // later: check error an give up if BLE disconnected
                console.log(error);
            }
        }
    }
}

const bleSerial = new NimBLESerial();
