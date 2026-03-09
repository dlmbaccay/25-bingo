import AsyncStorage from "@react-native-async-storage/async-storage"

/**
 * Async storage wrapper that mirrors the localStorage API used in the web app.
 * All methods are async because AsyncStorage is async.
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value)
    } catch {}
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key)
    } catch {}
  },
}
