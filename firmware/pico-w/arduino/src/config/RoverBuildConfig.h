#pragma once

// Arduino IDE debug default is Serial mock only.
//
// To try BLE advertise-only from Arduino IDE:
// 1. Enable Tools -> IP/Bluetooth Stack with Bluetooth.
// 2. Uncomment the define below.
// 3. Upload again and scan for ROVER_BLE_DEVICE_NAME.
//
// PlatformIO defines ROVER_ENABLE_BLE_GATT only in the experimental env.
// #define ROVER_ENABLE_BLE_GATT

#ifndef ROVER_BLE_DEVICE_NAME
#define ROVER_BLE_DEVICE_NAME "SmartphoneRover-PicoW"
#endif
