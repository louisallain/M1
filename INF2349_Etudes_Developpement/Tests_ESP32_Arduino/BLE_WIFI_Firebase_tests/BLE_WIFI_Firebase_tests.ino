#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#include <WiFi.h>

#include "FirebaseESP32.h"

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

#define FIREBASE_HOST "https://gestionnairesallesparempreinte.firebaseio.com"
#define FIREBASE_AUTH "HZ1pVMKT8OF0AKqnkIqx42eP4HISpECCwngS78Bl"
#define WIFI_SSID "louis"
#define WIFI_PASSWORD "louisdu56"

FirebaseData firebaseData;


class MyCallbacks: public BLECharacteristicCallbacks {

    // affiche la valeur écrite sur le terminal
    // écrit la valeur "Envoyé ${valeur_reçue}
    void onWrite(BLECharacteristic *pCharacteristic) {
      
      std::string value = pCharacteristic->getValue();

      if (value.length() > 0) {
        for (int i = 0; i < value.length(); i++) {
          Serial.print(value[i]);
        }
        Serial.println();

  
        std::string retValue = "Sent " + value;
        pCharacteristic->setValue(retValue); 
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Partie wifi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }

  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();

  // Parie Firebase
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Firebase.reconnectWiFi(true);
  Firebase.setReadTimeout(firebaseData, 1000 * 60);
  Firebase.setwriteSizeLimit(firebaseData, "tiny");

  // Partie Bluetooth
  BLEDevice::init("ESP32_CyberKey");
  BLEServer *pServer = BLEDevice::createServer();

  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setCallbacks(new MyCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = pServer->getAdvertising();
  pAdvertising->start();
}

void loop() {
  
    if (Firebase.getInt(firebaseData, "/test/int")) {

    //if (firebaseData.dataType() == "int")) {
      Serial.println(firebaseData.intData());
    //}

  } else {
    Serial.println(firebaseData.errorReason());
  }

  delay(3000);
}
