function BLEController (stage) {
    this.init(stage);
};

BLEController.prototype.init = function (stage) {
    this.stage = stage;
    this.device = undefined;
    this.service = undefined;
    this.rx_char = undefined;
    this.sendInProgress = false;
    this.buffer = [];
};

BLEController.prototype.connect = async function (serviceUUID, rxUUIX, txUUID) {
    this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [ serviceUUID ] }]
    });

    this.device.addEventListener(
        'gattserverdisconnected',
        this.onDisconnect.bind(this)
    );

    const server = await this.device.gatt.connect();
    this.service = await server.getPrimaryService(serviceUUID);
    const tx_char = await this.service.getCharacteristic(txUUID);
    this.rx_char = await this.service.getCharacteristic(rxUUIX);
    await tx_char.startNotifications();

    // bind overrides the default this=tx_char to this=the NimBLESerial
    tx_char.addEventListener(
        'characteristicvaluechanged',
        this.onReceive.bind(this)
    );

    this.sendInProgress = false;
    console.log('BLE connected');
};

BLEController.prototype.onReceive = function (event) {
    let data = new Uint8Array(event.target.value.buffer);
    this.buffer.push(...data);
};

BLEController.prototype.onDisconnect = function (event) {
    this.stage.ble = null;
    console.log('BLE disconnected');
};

BLEController.prototype.disconnect = function () {
    if (this.device != undefined) {
        this.device.gatt.disconnect();
    }
};

SnapExtensions.primitives.set(
    'ble_connect(serviceUUID, rxUUIX, txUUID)',
    function (serviceUUID, rxUUIX, txUUID) {
        var stage = this.parentThatIsA(StageMorph);
        if (!stage.ble) { stage.ble = new BLEController(stage); }
        stage.ble.connect(serviceUUID, rxUUIX, txUUID);
    }
);

SnapExtensions.primitives.set(
    'ble_disconnect()',
    function () {
        var stage = this.parentThatIsA(StageMorph);
        stage.ble?.disconnect();
    }
);

SnapExtensions.primitives.set(
    'ble_connected()',
    function () { return this.parentThatIsA(StageMorph).ble != undefined; }
);

SnapExtensions.primitives.set(
    'ble_read()',
    function () {
        var ble = this.parentThatIsA(StageMorph).ble;
        if (ble) {
            var buf = ble.buffer;
            ble.buffer = [];
            return new List(buf);
        }
        return new List();
    }
);

//TODO
SnapExtensions.primitives.set(
    'ble_write()',
    function () {
    }
);

