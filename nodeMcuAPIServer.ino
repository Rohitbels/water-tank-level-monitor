#include "ESP8266WiFi.h"
#include "ESP8266WebServer.h"

ESP8266WebServer server(80);

const int trigPin = 12;
const int echoPin = 14;

// define sound velocity in cm/uS
#define SOUND_VELOCITY 0.034
#define CM_TO_INCH 0.393701

long duration;
float distanceCm;
float distanceInch;

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

void setup()
{

    Serial.begin(115200);
    WiFi.begin("D_link", "qwerty321"); // Connect to the WiFi network

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

    server.on("/", handleRootPath); // Associate the handler function to the path
    server.begin();                 // Start the server
    Serial.println("Server listening");
}

void loop()
{

    server.handleClient(); // Handling of incoming requests

    delay(1000);
}

void handleRootPath()
{ // Handler for the rooth path
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    // Sets the trigPin on HIGH state for 10 micro seconds
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // Reads the echoPin, returns the sound wave travel time in microseconds
    duration = pulseIn(echoPin, HIGH);

    // Calculate the distance
    distanceCm = duration * SOUND_VELOCITY / 2;

    //  // Convert to inches
    //  distanceInch = distanceCm * CM_TO_INCH;
    //
    String my_str = "{ \"d\": ";

    my_str.concat(distanceCm);
    my_str.concat(" }");
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", my_str);
}
