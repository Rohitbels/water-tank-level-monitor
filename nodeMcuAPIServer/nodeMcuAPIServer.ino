#include "ESP8266WiFi.h"
#include "ESP8266WebServer.h"

ESP8266WebServer server(80);

const int trigPin = 12; // D6 on NodeMCU
const int echoPin = 14; // D5 on NodeMCU

// define sound velocity in cm/uS
#define SOUND_VELOCITY 0.034

// Requests arriving within this time (e.g. two phones) share one measurement
#define REUSE_MS 1000

long lastEcho = 0;
unsigned long lastMeasureMs = 0;
bool hasMeasured = false;

// Declared up front because Arduino's auto-generated declarations skip past the raw string below
void handleRootPath();
void handleApi();

// Set your Static IP address
IPAddress local_IP(192, 168, 1, 58);
// Set your Gateway IP address
IPAddress gateway(192, 168, 1, 1);

// IPAddress local_IP(192, 168, 129, 186);
//// Set your Gateway IP address
// IPAddress gateway(192, 168, 129, 218);

IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(8, 8, 8, 8); // optional
IPAddress secondaryDNS(8, 8, 4, 4);

// Page served at "/". It loads the real display (tank.js) from GitHub Pages.
// Until tank.js loads, or if it can't (no internet), it shows the plain distance every 3 s.
// Bump ?v= after changing tank.js so phones fetch the new copy.
const char SHELL_HTML[] PROGMEM = R"rawliteral(<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a1217">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Tank">
<title>Water tank</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a1217;color:#e3ecf1;font-family:system-ui,sans-serif;text-align:center">
<div id="fd" style="font-size:30vw;font-weight:900;line-height:1;font-variant-numeric:tabular-nums">--</div>
<div id="fu" style="font-size:5vw;opacity:.65;margin-top:2vw">cm from sensor</div>
<script>
window.fallbackTimer = setInterval(function () {
  fetch('/api', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      document.getElementById('fd').textContent = j.d == null ? '--' : j.d.toFixed(1);
      document.getElementById('fu').textContent = j.d == null ? 'no echo' : 'cm from sensor';
    })
    .catch(function () { document.getElementById('fu').textContent = 'no response'; });
}, 3000);
</script>
<script src="https://rohitbels.github.io/water-tank-level-monitor/tank.js?v=1" async></script>
</body></html>)rawliteral";

void setup()
{

    Serial.begin(115200);
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW); // LOW = ON for NodeMCU built-in LED
    WiFi.begin("D-Link", "qwerty321"); // Connect to the WiFi network

    // WiFi.begin("qwerty", "12345678");  //Connect to the WiFi network
    pinMode(trigPin, OUTPUT); // Sets the trigPin as an Output
    pinMode(echoPin, INPUT);

    // Configures static IP address
    if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS))
    {
        Serial.println("STA Failed to configure");
    }
    while (WiFi.status() != WL_CONNECTED)
    { // Wait for connection

        delay(500);
        Serial.println("Waiting to connect…");
    }

    Serial.print("IP address: ");
    Serial.println(WiFi.localIP()); // Print the local IP

    server.on("/other", []() { // Define the handling function for the path
        server.send(200, "text / plain", "Other URL");

    });

    server.on("/", handleRootPath); // Display page for the phone
    server.on("/api", handleApi);   // Measures now and returns the distance
    server.begin();                 // Start the server
    Serial.println("Server listening");
}

void loop()
{
    // Nothing is measured here: the sensor is only pinged when /api is requested
    server.handleClient(); // Handling of incoming requests
}

// Single ping. Returns echo time in microseconds, or 0 if no echo arrived.
long ping()
{
    digitalWrite(trigPin, LOW);
    delayMicroseconds(5);
    // JSN-SR04T / SR04M-2 boards need a longer trigger than the HC-SR04's 10 us
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(20);
    digitalWrite(trigPin, LOW);

    // 30 ms timeout covers ~5 m; without it pulseIn waits a full second
    return pulseIn(echoPin, HIGH, 30000);
}

// Takes NUM_PINGS readings and returns the median of the valid ones, or 0 if none were valid.
#define NUM_PINGS 5
long medianEchoTime()
{
    long readings[NUM_PINGS];
    int valid = 0;

    for (int i = 0; i < NUM_PINGS; i++)
    {
        long t = ping();
        if (t > 0)
        {
            readings[valid++] = t;
        }
        delay(60); // let echoes from the previous ping die out
    }

    if (valid == 0)
    {
        return 0;
    }

    // insertion sort, fine for 5 values
    for (int i = 1; i < valid; i++)
    {
        long key = readings[i];
        int j = i - 1;
        while (j >= 0 && readings[j] > key)
        {
            readings[j + 1] = readings[j];
            j--;
        }
        readings[j + 1] = key;
    }
    return readings[valid / 2];
}

void handleRootPath()
{ // Handler for the rooth path
    server.send_P(200, "text/html", SHELL_HTML);
}

void handleApi()
{
    if (!hasMeasured || millis() - lastMeasureMs >= REUSE_MS)
    {
        lastEcho = medianEchoTime();
        lastMeasureMs = millis();
        hasMeasured = true;
    }

    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Cache-Control", "no-store");

    if (lastEcho == 0)
    {
        // No echo: report an error instead of d = 0, which would read as a full tank
        Serial.println("no echo");
        server.send(503, "application/json", "{ \"d\": null, \"error\": \"no echo\" }");
        return;
    }

    float distanceCm = lastEcho * SOUND_VELOCITY / 2;
    Serial.print("distance: ");
    Serial.print(distanceCm);
    Serial.println(" cm");

    String my_str = "{ \"d\": ";
    my_str.concat(distanceCm);
    my_str.concat(" }");
    server.send(200, "application/json", my_str);
}
