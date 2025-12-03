"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MultiplayerRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/")
  }, [router])

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl text-center">
      <p className="text-gray-600">Redirecting to home...</p>
    </div>
  )
}
