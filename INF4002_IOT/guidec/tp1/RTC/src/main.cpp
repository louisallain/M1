#include <Arduino.h>
#include <Wire.h>
#include <time.h>

// struct tm {
//                int tm_sec;    /* Seconds (0-60) */
//                int tm_min;    /* Minutes (0-59) */
//                int tm_hour;   /* Hours (0-23) */
//                int tm_mday;   /* Day of the month (1-31) */
//                int tm_mon;    /* Month (0-11) */
//                int tm_year;   /* Year - 1900 */
//                int tm_wday;   /* Day of the week (0-6, Sunday = 0) */
//                int tm_yday;   /* Day in the year (0-365, 1 Jan = 0) */
//                int tm_isdst;  /* Daylight saving time */
//            };

#define DS3231_ADDR  0x68   // I2C address of the DS3231 RTC
#define SECONDS_FROM_1970_TO_2000 946684800

// --------------------------------------------------------------------------
// Get a command from the console and return this command as a string
//
// WARNING: this function is blocking until a command has been read
// (i.e., until a '\n' character has been received).
String getCommand() {

  Serial.print("> ");
  
  static char buffer[64];
  int line_idx = 0;

  while (true) {
    while (Serial.available() > 0) {
      char c = Serial.read();
      Serial.print(c);

      if (c == '\b') {
        if (line_idx > 0) {
          Serial.print(' '); Serial.print('\b');
          line_idx--;
        }
      }
      else if (c == '\n') {
        buffer[line_idx-1] = 0;
        return String(buffer);
      }
      else
        buffer[line_idx++] = c;
    }
  }
}

// --------------------------------------------------------------------------
// Convert an integer value (encoded on 8 bits) to BCD format (i.e. binary
// Coded Decimal)
static uint8_t int2bcd(uint8_t val) { return ((val/10*16) + (val%10)); }

// --------------------------------------------------------------------------
// Convert a BCD (i.e., Binary Coded Decimal) value to an integer value
// (encoded on 8 bits)
static uint8_t bcd2int(uint8_t val) { return ((val/16*10) + (val%16)); }

// --------------------------------------------------------------------------
// Display v in binary form
void showBits(uint8_t v) {

  for (int i=0; i<8; i++) {
    Serial.print((v & 0x80) != 0);
    v = v << 1;
  }
}

// --------------------------------------------------------------------------
// Read the DS3231's registers and display their values in binary form
void showRegisters() {
  Serial.println("Registers :");
  Wire.beginTransmission(DS3231_ADDR);
  int nbRegisters = 0;
  if((nbRegisters = Wire.requestFrom(DS3231_ADDR, 19)) != 19) { // 19 = nombre de registre
    Serial.println("Cant request");
    return;
  }
  while(Wire.available()) { // tant qu'il y a des registres
    uint8_t b = Wire.read();
    showBits(b);
    Serial.println();
  }
  Wire.endTransmission();
}

// --------------------------------------------------------------------------
// Read the date and time from the DS3231 and set dt's structure accordingly
void getTime(tm *dt) {

  Serial.println("TO BE COMPLETED");
}

// --------------------------------------------------------------------------
// Set the date and time in the DS3231 based on the values in dt's structure
void setTime(tm *dt) {

  Serial.println("TO BE COMPLETED");
}

// --------------------------------------------------------------------------
void process_command() {

  String cmd = getCommand();
  cmd.trim();

  if (cmd.startsWith("!")) {
    String str = cmd.substring(1);
    time_t val = (time_t)(str.toInt() - SECONDS_FROM_1970_TO_2000);
    struct tm *dt;
    dt = localtime(&val);
    setTime(dt);
    Serial.print("Setting RTC to ");
    Serial.println(asctime(dt));
    Serial.println();
    return;
  }

  if (cmd.startsWith("?")) {
    struct tm dt;
    getTime(&dt);
    Serial.print("Current RTC time is ");
    Serial.println(asctime(&dt));
    Serial.println();
    return;
  }

  if (cmd.startsWith("@")) {
    showRegisters();
    Serial.println();
    return;
  }

  Serial.println("Invalid command");
  Serial.println();
}

// --------------------------------------------------------------------------
void setup_RTC () {

  // Enable the I2C bus
  Wire.begin();

  Serial.println();
  Serial.println(F("Possible commands:"));
  Serial.println();
  Serial.println(F("?       : Read the RTC's registers and display the current time in human-readable form"));
  Serial.println(F("@       : Read the RTC's registers and display each value in binary form"));
  Serial.println(F("!<value>: Set the RTC's registers based on the specified value,"));
  Serial.println(F("          where <value> is the number of seconds elapsed"));
  Serial.println(F("          since 1970/01/01 00:00:00 (EPOCH)"));
  Serial.println();
}

// --------------------------------------------------------------------------
void setup() {

  // Enable the serial console
  Serial.begin(9600);

  setup_RTC();
}

// --------------------------------------------------------------------------
void loop () {

  process_command();
}