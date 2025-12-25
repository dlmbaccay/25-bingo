import type { Metadata } from "next";

type Props = {
  params: Promise<{ roomId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;

  return {
    title: `Room ${roomId}`,
    description: `Join your family in room ${roomId} for a fun game of bingo! Gather everyone together and enjoy some quality time with classic bingo.`,
    openGraph: {
      title: `Bingo Room ${roomId} - 25 Bingo`,
      description: `Join your family in room ${roomId} for a fun game of bingo! Gather everyone together and enjoy some quality time.`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `Bingo Room ${roomId} - 25 Bingo`,
      description: `Join your family in room ${roomId} for a fun game of bingo!`,
    },
    robots: {
      index: false, // Don't index individual game rooms
      follow: false,
    },
  };
}

export default function GameRoomLayout({ children }: Props) {
  return <>{children}</>;
}
