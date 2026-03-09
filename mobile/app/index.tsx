import React, { useCallback, useEffect, useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { storage } from "../lib/storage"
import { validateRoomExists } from "../lib/supabaseGame"

function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 8)
}

export default function HomeScreen() {
  const router = useRouter()
  const [joinId, setJoinId] = useState("")
  const [name, setName] = useState("")
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    storage.getItem("bingo_username").then((saved) => {
      if (saved) setName(saved)
    })
  }, [])

  const createRoom = useCallback(() => {
    const roomId = generateRoomId()
    router.push({ pathname: "/game/[roomId]", params: { roomId, host: "1" } })
  }, [router])

  const joinRoom = useCallback(async () => {
    const trimmedId = joinId.trim()
    const trimmedName = name.trim()
    if (!trimmedId || !trimmedName) return

    setIsJoining(true)
    try {
      const exists = await validateRoomExists(trimmedId)
      if (!exists) {
        Alert.alert("Room not found", "That room ID doesn't exist. Check the ID and try again.")
        return
      }
      await storage.setItem("bingo_username", trimmedName)
      router.push({ pathname: "/game/[roomId]", params: { roomId: trimmedId } })
    } finally {
      setIsJoining(false)
    }
  }, [joinId, name, router])

  const canJoin = joinId.trim().length > 0 && name.trim().length > 0

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>25 Bingo</Text>
          <Text style={styles.subtitle}>Multiplayer bingo, anywhere</Text>

          {/* Host card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Host a Game</Text>
            <Text style={styles.cardDesc}>
              Create a new bingo room and share the room ID with players.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={createRoom}>
              <Text style={styles.primaryButtonText}>Create Room</Text>
            </TouchableOpacity>
          </View>

          {/* Join card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Join a Game</Text>
            <Text style={styles.cardDesc}>
              Enter your name and the room ID to join an existing game.
            </Text>

            <Text style={styles.inputLabel}>Your Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your display name"
              placeholderTextColor="#9ca3af"
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Room ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. abc123"
              placeholderTextColor="#9ca3af"
              value={joinId}
              onChangeText={(t) => setJoinId(t.toLowerCase())}
              returnKeyType="go"
              onSubmitEditing={joinRoom}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.primaryButton, !canJoin && styles.primaryButtonDisabled]}
              onPress={joinRoom}
              disabled={!canJoin || isJoining}
            >
              {isJoining ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Join Room</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
  },
  card: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    marginBottom: 16,
    backgroundColor: "#fafafa",
  },
  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  primaryButtonDisabled: {
    backgroundColor: "#9ca3af",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
})
