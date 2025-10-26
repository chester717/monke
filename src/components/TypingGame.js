import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Input,
  Text,
  VStack,
  Heading,
  HStack,
  Progress,
} from "@chakra-ui/react";
import { database as db, auth } from "../firebase";
import { ref, set, onValue, onDisconnect, update } from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import Confetti from "react-confetti";
import { useGenerateSentence } from "../hooks/useGenerateSentence";

const TypingRace = () => {
  const [startTime, setStartTime] = useState(null);
  const [text, setText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState({});
  const [status, setStatus] = useState("waiting");
  const [winner, setWinner] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(60);
  const [shakeInput, setShakeInput] = useState(false);

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const uid = useRef(uuidv4()).current;
  const generateSentence = useGenerateSentence();

  // Timer
  useEffect(() => {
    if (status === "running") {
      setGameTimeLeft(60);
      setStartTime(Date.now());
      inputRef.current?.focus();
      timerRef.current = setInterval(() => {
        setGameTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            if (currentRoom) {
              const roomRef = ref(db, `rooms/${currentRoom}`);
              update(roomRef, { status: "finished", timerExpired: true });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [status, currentRoom]);

  // Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) signInAnonymously(auth).catch(console.error);
    });
    return () => unsub();
  }, []);

  const pushProgress = (room, progress) => {
    const roomRef = ref(db, `rooms/${room}/players/${uid}`);
    let stats = {
      name: playerName || `Player-${uid.slice(0, 5)}`,
      progress,
      finished: progress >= 100,
      ready: players[uid]?.ready || false,
    };
    if (progress >= 100 && startTime) {
      const finishTime = Date.now();
      const timeTaken = (finishTime - startTime) / 1000;
      const wordsTyped = userInput.trim().split(/\s+/).length;
      const wpm = Math.round((wordsTyped / timeTaken) * 60);
      let correctChars = 0;
      for (let i = 0; i < userInput.length; i++)
        if (userInput[i] === text[i]) correctChars++;
      const accuracy = text.length
        ? Math.round((correctChars / text.length) * 100)
        : 0;
      stats = { ...stats, finishTime, timeTaken, wpm, accuracy };
    }
    set(roomRef, stats);
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setUserInput(val);
    const correctSoFar = text.slice(0, val.length);
    if (val === correctSoFar) {
      const newProgress = Math.min((val.length / text.length) * 100, 100);
      if (currentRoom) pushProgress(currentRoom, newProgress);
      setShakeInput(false);
    } else setShakeInput(true);
  };

  const handleRestart = () => {
    setUserInput("");
    if (currentRoom) pushProgress(currentRoom, 0);
    inputRef.current?.focus();
  };

  const createRoom = () => {
    const id = uuidv4().slice(0, 6).toUpperCase();
    setCurrentRoom(id);
    set(ref(db, `rooms/${id}`), {
      text: generateSentence(),
      status: "waiting",
      players: {},
      winner: null,
    });
    joinRoom(id);
  };

  const joinRoom = (id) => {
    if (!id) return;
    setCurrentRoom(id);
    const playerRef = ref(db, `rooms/${id}/players/${uid}`);
    set(playerRef, {
      name: playerName || `Player-${uid.slice(0, 5)}`,
      progress: 0,
      finished: false,
      ready: false,
    });
    onDisconnect(playerRef).remove();
  };

  const markReady = () => {
    if (!currentRoom) return;
    const playerRef = ref(db, `rooms/${currentRoom}/players/${uid}`);
    update(playerRef, { ready: true });
  };

  // Room updates
  useEffect(() => {
    if (!currentRoom) return;
    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val();
      setText(data.text);
      setStatus(data.status);
      setWinner(data.winner || null);
      setPlayers(data.players || {});
      setCountdown(data.countdown || null);
    });
    return () => unsubscribe();
  }, [currentRoom]);

  useEffect(() => {
    setText(generateSentence);
  }, []);

  useEffect(() => {
    if (!currentRoom) return;
    if (Object.keys(players).length >= 1) {
      const allReady = Object.values(players).every((p) => p.ready);
      if (allReady && status === "waiting") {
        const roomRef = ref(db, `rooms/${currentRoom}`);
        update(roomRef, { status: "countdown", countdown: 3 });
        let cd = 3;
        const interval = setInterval(() => {
          cd -= 1;
          if (cd > 0) update(roomRef, { countdown: cd });
          else {
            update(roomRef, { status: "running", countdown: null });
            clearInterval(interval);
          }
        }, 1000);
      }
      const allFinished =
        Object.values(players).length >= 1 &&
        Object.values(players).every((p) => p.progress === 100);
      if (status === "running" && allFinished) {
        const roomRef = ref(db, `rooms/${currentRoom}`);
        update(roomRef, { status: "finished", finishedEarly: true });
      }
    }
  }, [currentRoom, players, status]);

  const inputStyle = {
    bg: "gray.100",
    color: "black",
    border: "1px solid gray",
    _focus: { borderColor: "teal.400", boxShadow: "0 0 0 1px teal.400" },
  };

  return (
    <Box
      w="100%"
      minH="100vh"
      bgGradient="linear(to-br, #0f2027, #203a43, #2c5364)"
      overflow="auto"
      p={4}
    >
      <VStack spacing={4} w="100%" maxW="800px" mx="auto">
        <Heading size="md" color="#50fa7b">
          Realtime Typing Race
        </Heading>

        {status === "running" && (
          <Text fontSize="lg" color="#ff5555" fontWeight="bold">
            Time Left: {gameTimeLeft}s
          </Text>
        )}

        <Text fontSize="sm" color="#f8f8f2">
          {currentRoom
            ? `In Room: ${currentRoom} | Players: ${Object.keys(players).length}`
            : "Not in a room"}
        </Text>

        <HStack w="100%">
          <Input
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            {...inputStyle}
          />
          <Input
            placeholder="Room ID (or leave blank to create)"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            {...inputStyle}
          />
          <Button onClick={createRoom} colorScheme="blue">
            Create
          </Button>
          <Button onClick={() => joinRoom(roomId)} colorScheme="teal">
            Join
          </Button>
        </HStack>

        <Box
          p={5}
          borderRadius="md"
          bg="rgba(10,10,10,0.95)"
          fontFamily="Fira Code, monospace"
          fontSize="1.5rem"
          minH="120px"
          w="100%"
          color="#f8f8f2"
          boxShadow="0 0 20px #50fa7b"
          userSelect="none"
        >
          {text.split("").map((char, index) => {
            let color = "#f8f8f2";
            let bg = "transparent";
            if (index < userInput.length) {
              color = userInput[index] === char ? "#50fa7b" : "#ff5555";
            } else if (index === userInput.length) {
              bg = "#f1fa8c";
              color = "#000";
            }
            return (
              <Text as="span" key={index} color={color} bg={bg} borderRadius="1px">
                {char}
              </Text>
            );
          })}
        </Box>

        <Input
          ref={inputRef}
          value={userInput}
          onChange={handleChange}
          placeholder="Start typing..."
          disabled={status !== "running"}
          className={shakeInput ? "shake" : ""}
          {...inputStyle}
        />

        <VStack w="100%" align="stretch">
          {Object.entries(players).map(([id, p]) => (
            <Box key={id}>
              <Text color="#f8f8f2">
                {p.name} {p.ready && status === "waiting" ? "✅ Ready" : ""}
              </Text>
              <Progress
                value={p.progress}
                colorScheme={p.progress === 100 ? "green" : "teal"}
                size="sm"
                borderRadius="md"
              />
            </Box>
          ))}
        </VStack>

        {status === "countdown" && (
          <Text
            fontSize="4xl"
            fontWeight="bold"
            color="#ffb86c"
            animation="pulse 1s infinite"
          >
            Starting in: {countdown}
          </Text>
        )}

        {status === "finished" && winner && <Confetti />}

        {status === "finished" && (
          <Box>
            <Text color="#50fa7b" fontWeight="bold">
              {winner
                ? `🏆 Winner: ${players[winner]?.name || "Unknown"} (WPM: ${
                    players[winner]?.wpm || 0
                  }, Accuracy: ${players[winner]?.accuracy || 0}%)`
                : "No winner"}
            </Text>
            <VStack align="start" mt={2}>
              {Object.entries(players).map(([id, p]) => (
                <Text key={id} color="#f8f8f2">
                  {p.name}:{" "}
                  {p.finished
                    ? `WPM: ${p.wpm || 0}, Accuracy: ${p.accuracy || 0}%`
                    : "Not finished"}
                </Text>
              ))}
            </VStack>
          </Box>
        )}

        <HStack>
          {status === "waiting" &&
            currentRoom &&
            !players[uid]?.ready && (
              <Button onClick={markReady} colorScheme="blue" mt={2}>
                I'm Ready
              </Button>
            )}

          <Button onClick={handleRestart} mt={2}>
            Reset My Input
          </Button>
        </HStack>
      </VStack>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .shake {
          animation: shake 0.2s;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
      `}</style>
    </Box>
  );
};

export default TypingRace;
