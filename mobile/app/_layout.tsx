import { Stack } from "expo-router"
import { SafeAreaProvider } from "react-native-safe-area-context"
import Toast from "react-native-toast-message"

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#f9fafb" },
        }}
      />
      <Toast />
    </SafeAreaProvider>
  )
}
