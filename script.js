// ==========================================
// POWERX AC MOTOR FAULT DIAGNOSIS
// Firebase + Simulation + Live Data
// ==========================================
//
// MODES
// -----
// LIVE (default):
//   Dashboard only reads motor/latest from Firebase.
//
// SIMULATOR:
//   Open the website with ?mode=simulator
//   One browser generates test data and writes it to Firebase.
//   Other phones/laptops can open the normal URL and see the same data.
//
// LATER:
//   Raspberry Pi + ML can write the same motor/latest structure.
//   The dashboard code does not need to be rebuilt.
// ==========================================

const MODE =
    new URLSearchParams(window.location.search).get("mode") === "simulator"
        ? "SIMULATOR"
        : "LIVE";

const MOTOR_PATH = "motor/latest";

let firebaseReady = false;
let simulationStarted = false;
let conditionIndex = 0;

// The same sequence is used every time so a demonstration shows
// every important fault condition.
const conditions = [
    "NORMAL",
    "OVERLOAD",
    "OVERHEATING",
    "HIGH_VIBRATION",
    "UNDERVOLTAGE",
    "OVERVOLTAGE",
    "MULTIPLE_FAULT"
];

// ==========================================
// WAIT FOR FIREBASE
// ==========================================

window.addEventListener("firebase-ready", () => {
    firebaseReady = true;

    const { db, ref, onValue } = window.PowerXFirebase;

    // Every browser listens to the same Firebase location.
    // Therefore laptop and mobile can display the same motor data.
    onValue(
        ref(db, MOTOR_PATH),
        (snapshot) => {
            const data = snapshot.val();

            if (!data) {
                updateConnectionMessage("Waiting for motor data...");
                return;
            }

            displayMotorData(data);
        },
        (error) => {
            console.error("Firebase read error:", error);
            updateConnectionMessage("Firebase connection error");
        }
    );

    updateModeLabel();

    // Only the browser opened with ?mode=simulator generates data.
    if (MODE === "SIMULATOR") {
        startSimulation();
    }
});

// ==========================================
// MODE LABEL
// ==========================================

function updateModeLabel() {
    const label = document.getElementById("dataMode");

    if (!label) return;

    label.innerText = MODE;
}

// ==========================================
// SIMULATION
// ==========================================

function startSimulation() {
    if (simulationStarted) return;

    simulationStarted = true;

    // Send the first value immediately.
    generateAndSendMotorData();

    // Continue every 4 seconds.
    setInterval(generateAndSendMotorData, 4000);
}

function generateAndSendMotorData() {
    if (!firebaseReady) return;

    const condition = conditions[conditionIndex];

    conditionIndex++;

    if (conditionIndex >= conditions.length) {
        conditionIndex = 0;
    }

    let voltage;
    let current;
    let temperature;
    let vibration;

    // ------------------------------------------
    // NORMAL
    // ------------------------------------------

    if (condition === "NORMAL") {
        voltage = random(225, 240);
        current = random(4.2, 5.8);
        temperature = random(45, 65);
        vibration = random(0.15, 0.45);
    }

    // ------------------------------------------
    // OVERLOAD
    // ------------------------------------------

    else if (condition === "OVERLOAD") {
        voltage = random(220, 235);
        current = random(8.0, 10.0);
        temperature = random(65, 78);
        vibration = random(0.35, 0.65);
    }

    // ------------------------------------------
    // OVERHEATING
    // ------------------------------------------

    else if (condition === "OVERHEATING") {
        voltage = random(225, 240);
        current = random(5.0, 6.5);
        temperature = random(85, 105);
        vibration = random(0.25, 0.55);
    }

    // ------------------------------------------
    // HIGH VIBRATION
    // ------------------------------------------

    else if (condition === "HIGH_VIBRATION") {
        voltage = random(225, 240);
        current = random(4.5, 6.0);
        temperature = random(50, 70);
        vibration = random(1.0, 1.8);
    }

    // ------------------------------------------
    // UNDERVOLTAGE
    // ------------------------------------------

    else if (condition === "UNDERVOLTAGE") {
        voltage = random(160, 175);
        current = random(5.0, 7.0);
        temperature = random(50, 70);
        vibration = random(0.2, 0.6);
    }

    // ------------------------------------------
    // OVERVOLTAGE
    // ------------------------------------------

    else if (condition === "OVERVOLTAGE") {
        voltage = random(255, 275);
        current = random(4.5, 6.0);
        temperature = random(50, 70);
        vibration = random(0.2, 0.6);
    }

    // ------------------------------------------
    // MULTIPLE FAULT
    // ------------------------------------------

    else {
        voltage = random(160, 175);
        current = random(8.0, 10.0);
        temperature = random(85, 105);
        vibration = random(1.0, 1.8);
    }

    const diagnosis = diagnoseValues(
        voltage,
        current,
        temperature,
        vibration
    );

    const motorData = {
        motorId: "MTR-001",
        voltage: Number(voltage.toFixed(2)),
        current: Number(current.toFixed(2)),
        temperature: Number(temperature.toFixed(2)),
        vibration: Number(vibration.toFixed(2)),

        fault: diagnosis.fault,
        description: diagnosis.description,
        severity: diagnosis.severity,
        isFault: diagnosis.isFault,

        downtime: diagnosis.isFault ? 5.0 : 4.5,

        source: "SIMULATION",
        timestamp: Date.now()
    };

    sendToFirebase(motorData);
}

// ==========================================
// DIAGNOSIS
// ==========================================

function diagnoseValues(
    voltage,
    current,
    temperature,
    vibration
) {
    const faults = [];

    if (voltage < 180) {
        faults.push("UNDERVOLTAGE");
    }

    if (voltage > 250) {
        faults.push("OVERVOLTAGE");
    }

    if (current > 7) {
        faults.push("OVERLOAD");
    }

    if (temperature > 80) {
        faults.push("OVERHEATING");
    }

    if (vibration > 0.8) {
        faults.push("HIGH VIBRATION");
    }

    if (faults.length === 0) {
        return {
            fault: "NO FAULT DETECTED",
            description:
                "All motor parameters are within safe operating limits.",
            severity: "LOW",
            isFault: false
        };
    }

    let severity = "MEDIUM";

    if (faults.length >= 2) {
        severity = "CRITICAL";
    }
    else if (
        faults.includes("OVERLOAD") ||
        faults.includes("OVERHEATING") ||
        faults.includes("UNDERVOLTAGE") ||
        faults.includes("OVERVOLTAGE")
    ) {
        severity = "HIGH";
    }

    return {
        fault: faults.join(" + "),
        description:
            "Abnormal motor operating condition detected. Inspection recommended.",
        severity: severity,
        isFault: true
    };
}

// ==========================================
// SEND DATA TO FIREBASE
// ==========================================

async function sendToFirebase(motorData) {
    try {
        const { db, ref, set } = window.PowerXFirebase;

        await set(
            ref(db, MOTOR_PATH),
            motorData
        );

        console.log("PowerX data sent to Firebase:", motorData);
    }
    catch (error) {
        console.error("Firebase write error:", error);
        updateConnectionMessage("Unable to send data to Firebase");
    }
}

// ==========================================
// DISPLAY FIREBASE DATA
// ==========================================

function displayMotorData(data) {
    const voltage = Number(data.voltage ?? 0);
    const current = Number(data.current ?? 0);
    const temperature = Number(data.temperature ?? 0);
    const vibration = Number(data.vibration ?? 0);

    document.getElementById("voltage").innerText =
        voltage.toFixed(1);

    document.getElementById("current").innerText =
        current.toFixed(2);

    document.getElementById("temperature").innerText =
        temperature.toFixed(1);

    document.getElementById("vibration").innerText =
        vibration.toFixed(2);

    // If Raspberry Pi later sends its own ML diagnosis,
    // the dashboard will use it.
    // If it doesn't, diagnosis is calculated from sensor values.
    const diagnosis = data.fault
        ? {
            fault: data.fault,
            description:
                data.description ||
                "Abnormal motor operating condition detected.",
            severity:
                data.severity ||
                "MEDIUM",
            isFault:
                typeof data.isFault === "boolean"
                    ? data.isFault
                    : data.fault !== "NO FAULT DETECTED"
        }
        : diagnoseValues(
            voltage,
            current,
            temperature,
            vibration
        );

    document.getElementById("faultType").innerText =
        diagnosis.fault;

    document.getElementById("faultDescription").innerText =
        diagnosis.description;

    document.getElementById("severity").innerText =
        diagnosis.severity;

    // ------------------------------------------
    // MOTOR STATUS
    // ------------------------------------------

    const status =
        document.getElementById("motorStatus");

    const message =
        document.getElementById("statusMessage");

    const icon =
        document.getElementById("statusIcon");

    if (diagnosis.isFault) {
        document.body.classList.add("fault-mode");

        status.innerText =
            "FAULT DETECTED";

        message.innerText =
            "Immediate inspection recommended";

        icon.innerText = "⚠";
    }
    else {
        document.body.classList.remove("fault-mode");

        status.innerText =
            "NORMAL";

        message.innerText =
            "Motor is operating normally";

        icon.innerText = "●";
    }

    // ------------------------------------------
    // SENSOR STATUS
    // ------------------------------------------

    document.getElementById("voltageState").innerText =
        voltage < 180
            ? "UNDERVOLTAGE"
            : voltage > 250
                ? "OVERVOLTAGE"
                : "NORMAL";

    document.getElementById("currentState").innerText =
        current > 7
            ? "OVERLOAD"
            : "NORMAL";

    document.getElementById("temperatureState").innerText =
        temperature > 80
            ? "HIGH TEMPERATURE"
            : "NORMAL";

    document.getElementById("vibrationState").innerText =
        vibration > 0.8
            ? "HIGH VIBRATION"
            : "NORMAL";

    // ------------------------------------------
    // DOWNTIME
    // ------------------------------------------

    const downtime =
        Number(data.downtime);

    if (Number.isFinite(downtime)) {
        document.getElementById("downtime").innerText =
            downtime.toFixed(1);
    }

    // ------------------------------------------
    // LAST UPDATE
    // ------------------------------------------

    if (data.timestamp) {
        const time = new Date(Number(data.timestamp));

        document.getElementById("lastUpdate").innerText =
            time.toLocaleTimeString();
    }
    else {
        updateTime();
    }

    console.log("--------------------------------");
    console.log("POWERX FIREBASE DATA");
    console.log("Source:", data.source || "LIVE");
    console.log("Voltage:", voltage, "V");
    console.log("Current:", current, "A");
    console.log("Temperature:", temperature, "°C");
    console.log("Vibration:", vibration, "g");
    console.log("Diagnosis:", diagnosis.fault);
    console.log("Severity:", diagnosis.severity);
    console.log("--------------------------------");
}

// ==========================================
// CONNECTION MESSAGE
// ==========================================

function updateConnectionMessage(message) {
    const element =
        document.getElementById("statusMessage");

    if (element) {
        element.innerText = message;
    }
}

// ==========================================
// RANDOM NUMBER
// ==========================================

function random(min, max) {
    return Math.random() *
        (max - min) + min;
}

// ==========================================
// CLOCK FALLBACK
// ==========================================

function updateTime() {
    const now = new Date();

    document.getElementById("lastUpdate")
        .innerText =
        now.toLocaleTimeString();
}
