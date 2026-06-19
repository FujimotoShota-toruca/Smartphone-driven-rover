import type { BluetoothNavigator } from "./WebBluetoothTransport";

export function isWebBluetoothAvailable(
  navigatorLike: Partial<BluetoothNavigator> | undefined = defaultNavigator(),
): boolean {
  return typeof navigatorLike?.bluetooth?.requestDevice === "function";
}

export function getBluetoothOrThrow(
  navigatorLike: Partial<BluetoothNavigator> | undefined = defaultNavigator(),
) {
  const bluetooth = navigatorLike?.bluetooth;
  if (typeof bluetooth?.requestDevice !== "function") {
    throw new Error("Web Bluetooth is not available in this browser");
  }

  return bluetooth;
}

function defaultNavigator(): Partial<BluetoothNavigator> | undefined {
  return globalThis.navigator as Partial<BluetoothNavigator> | undefined;
}
