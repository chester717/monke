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
  keyframes,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { database as db, auth } from "../firebase";
import { ref, set, onValue, onDisconnect, update } from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import "../hooks/useGenerateSentence"

const pulse = keyframes`
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
`;


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
  const [progress, setProgress] = useState(0);
  const [cd, setCd] = useState(3);
  const [gameTimeLeft, setGameTimeleft] = useState(null);

  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const uid = useRef(uuidv4()).current;
  const generateSentence = useGenerateSentence();


  // Countdown pulse effect
  useEffect(() => {
    if (status === "running") {
      setGameTimeleft(60);
      setStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setGameTimeleft((prev) => {
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
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [status, currentRoom]);

  // Determine winner when finished
  useEffect(() => {
    if (!currentRoom) return;
    if (status === "finished") {
      let winnerId = null;
      let bestScore = -1;
      let bestAccuracy = -1;
      Object.entries(players).forEach(([id, p]) => {
        if (p.wpm && p.accuracy) {
          if (
            p.wpm > bestScore ||
            (p.wpm === bestScore && p.accuracy > bestAccuracy)
          ) {
            bestScore = p.wpm;
            bestAccuracy = p.accuracy;
            winnerId = id;
          }
        }
      });
      if (winner !== winnerId) {
        const roomRef = ref(db, `rooms/${currentRoom}`);
        update(roomRef, { winner: winnerId });
      }
    }
  }, [status, players, currentRoom, winner]);

  // Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        signInAnonymously(auth).catch(console.error);
      }
    });
    return () => unsub();
  }, []);

  // Push progress
  const pushProgress = (room, progress) => {
    const roomRef = ref(db, `rooms/${room}/players/${uid}`);
    let stats = {
      name: playerName || `Player-${uid.slice(0, 5)}`,
      progress,
      finished: progress >= 100,
    };

    if (progress >= 100 && startTime) {
      const finishTime = Date.now();
      const timeTaken = (finishTime - startTime) / 1000;
      const wordsTyped = userInput.trim().split(/\s+/).length;
      const wpm = (wordsTyped / timeTaken) * 60;
      let correctChars = 0;
      for (let i = 0; i < userInput.length; i++) {
        if (userInput[i] === text[i]) correctChars++;
      }
      const accuracy = text.length
        ? Math.round((correctChars / text.length) * 100)
        : 0;
      stats = { ...stats, wpm: Math.round(wpm), accuracy };
    }
    set(roomRef, stats);
  };

  // Handle typing input
  const handleChange = (e) => {
    const val = e.target.value;
    setUserInput(val);
    const correctSoFar = text.slice(0, val.length);
    if (val === correctSoFar) {
      const newProgress = Math.min((val.length / text.length) * 100, 100);
      setProgress(newProgress);
      if (currentRoom) pushProgress(currentRoom, newProgress);
    }
  };

  // Reset input
  const handleRestart = () => {
    setUserInput("");
    setProgress(0);
    if (currentRoom) pushProgress(currentRoom, 0);
    inputRef.current?.focus();
  };

  // Create a new room
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

  // Join existing room
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
    const playerRef = ref(db, `rooms/${currentRoom}/players/${uid}`);
    update(playerRef, { ready: true });
  };

  // Listen to room updates
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
      if (data.cd !== undefined) setCd(data.cd);
    });
    return () => unsubscribe();
  }, [currentRoom]);

  // Load text on mount
  useEffect(() => {
    setText(generateSentence());
  }, []);

  // Start countdown if all ready
  useEffect(() => {
    if (!currentRoom) return;
    if (Object.keys(players).length > 1) {
      const allReady = Object.values(players).every((p) => p.ready);
      if (allReady && status === "waiting") {
        const roomRef = ref(db, `rooms/${currentRoom}`);
        update(roomRef, { status: "countdown" });

        let count = 3;
        const interval = setInterval(() => {
          count -= 1;
          setCd(count);
          if (count <= 0) {
            update(roomRef, { status: "running", cd: null });
            clearInterval(interval);
          } else {
            update(roomRef, { cd: count });
          }
        }, 1000);

        return () => clearInterval(interval);
      }

      const allFinished =
        Object.values(players).length > 1 &&
        Object.values(players).every((p) => p.progress >= 100);

      if (status === "running" && allFinished) {
        const roomRef = ref(db, `rooms/${currentRoom}`);
        update(roomRef, { status: "finished", finishedEarly: true });
      }
    }
  }, [currentRoom, players, status]);

  return (
    <VStack
      spacing={6}
      minH="100vh"
      w="100%"
      bg="gray.900"
      color="gray.100"
      p={8}
      align="center"
      justify="center"
    >
      {/* Heading */}
      <Heading
        size="xl"
        bgGradient="linear(to-r, teal.400, blue.500)"
        bgClip="text"
        fontWeight="bold"
      >
        Type Racer
      </Heading>

      {/* Time */}
      {status === "running" && (
        <Text fontSize="lg" color="red.500" fontWeight="bold">
          Time Left: {gameTimeLeft}s
        </Text>
      )}

      {/* Room info */}
      <Text fontSize="md" color="gray.400" mb={4}>
        {currentRoom ? (
          <HStack spacing={4}>
            <Box px={3} py={1} bg="gray.800" borderRadius="md">
              Room: {currentRoom}
            </Box>
            <Box px={3} py={1} bg="gray.800" borderRadius="md">
              Players: {Object.keys(players).length}
            </Box>
          </HStack>
        ) : (
          "Join a room to start racing"
        )}
      </Text>

      {/* Create / Join */}
      <HStack w="100%" maxW="900px" spacing={4}>
        <Input
          placeholder="Your Name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          bg="gray.800"
          border="none"
          _focus={{ bg: "gray.700" }}
          _hover={{ bg: "gray.700" }}
        />
        <Input
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          bg="gray.800"
          border="none"
          _focus={{ bg: "gray.700" }}
          _hover={{ bg: "gray.700" }}
        />
        <Button onClick={createRoom}>Create</Button>
        <Button onClick={() => joinRoom(roomId)} colorScheme="teal">
          Join
        </Button>
      </HStack>

      {/* Text area with progress */}
      <Box
        p={6}
        bg="gray.800"
        borderRadius="xl"
        fontFamily="JetBrains Mono, monospace"
        fontSize="xl"
        minH="150px"
        w="100%"
        maxW="900px"
        userSelect="none"
        position="relative"
        mb={4}
      >
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="4px"
          bg="gray.700"
          borderTopRadius="xl"
          overflow="hidden"
        >
          <Box
            h="100%"
            w={`${progress}%`}
            bg="teal.500"
            transition="width 0.3s ease-out"
          />
        </Box>

        <Box letterSpacing="wide" lineHeight="1.8">
          {text.split("").map((char, index) => {
            let color = "gray.500";
            let bg = "transparent";
            if (index < userInput.length) {
              if (userInput[index] === char) {
                color = "teal.300";
              } else {
                color = "red.400";
                bg = "rgba(255, 0, 0, 0.1)";
              }
            }
            return (
              <Text as="span" key={index} color={color} bg={bg} px="0.5px">
                {char}
              </Text>
            );
          })}
        </Box>
      </Box>

      {/* Input */}
      <Input
        ref={inputRef}
        value={userInput}
        onChange={handleChange}
        placeholder={
          status === "running" ? "Type here..." : "Waiting to start..."
        }
        disabled={status !== "running"}
        bg="gray.800"
        border="none"
        borderRadius="lg"
        p={4}
        fontSize="lg"
        w="100%"
        maxW="900px"
        _focus={{
          outline: "none",
          boxShadow: "0 0 0 2px teal.500",
          bg: "gray.700",
        }}
        _disabled={{
          opacity: 0.7,
          cursor: "not-allowed",
        }}
      />

      {/* Player progress bars */}
      <VStack w="100%" maxW="900px" spacing={4}>
        {Object.entries(players).map(([id, p]) => (
          <Box
            key={id}
            w="100%"
            bg="gray.800"
            p={4}
            borderRadius="lg"
            position="relative"
            overflow="hidden"
          >
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="medium">{p.name}</Text>
              <Text color="gray.400">{Math.round(p.progress)}%</Text>
            </HStack>
            <Progress
              value={p.progress}
              size="sm"
              borderRadius="full"
              colorScheme="teal"
              bg="gray.700"
              sx={{
                "& > div": {
                  transition: "width 0.3s ease-out",
                },
              }}
            />
          </Box>
        ))}
      </VStack>

      {/* Buttons & Countdown */}
      <HStack spacing={4} mt={4}>
        {status === "waiting" && (
          <Button
            onClick={markReady}
            bg="teal.500"
            color="white"
            px={8}
            py={6}
            fontSize="lg"
            _hover={{ bg: "teal.600" }}
            _active={{ bg: "teal.700" }}
          >
            Ready to Race
          </Button>
        )}

        {status === "countdown" && (
          <Text
            fontSize="6xl"
            fontWeight="bold"
            color="teal.400"
            animation={`${pulse} 1s infinite`}
          >
            {cd || 3}
          </Text>
        )}

        {status === "running" && (
          <Button
            onClick={handleRestart}
            bg="gray.700"
            color="white"
            px={6}
            _hover={{ bg: "gray.600" }}
            leftIcon={<RepeatIcon />}
          >
            Restart
          </Button>
        )}
      </HStack>

      {/* Game results */}
      {status === "finished" && (
        <Box>
          <Text color="teal.400" fontSize="xl" fontWeight="bold">
            {winner
              ? `🏆 Winner: ${players[winner]?.name || "Unknown"}`
              : "No winner"}
          </Text>
          <VStack align="start" mt={2}>
            {Object.entries(players).map(([id, p]) => (
              <Text key={id}>
                {p.name}:{" "}
                {p.finished
                  ? `WPM: ${p.wpm || 0}, Accuracy: ${p.accuracy || 0}%`
                  : "Not finished"}
              </Text>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
};

export default TypingRace;
p;
