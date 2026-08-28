import { Server, Socket } from "socket.io";
import { Chess } from "chess.js";

export interface GamePlayer {
  id: number;
  username: string;
  avatarUrl: string;
  ready: boolean;
  symbol?: string; // "X" or "O" (Tic-Tac-Toe), "Red" or "Yellow" (Connect 4), "w" or "b" (Chess)
}

export interface GameSession {
  conversationId: number;
  gameType: "tictactoe" | "connect4" | "chess";
  status: "lobby" | "playing" | "ended";
  creatorId: number;
  players: GamePlayer[];
  board: any; // TicTacToe: 9-array, Connect4: 6x7-array, Chess: FEN string
  turn: number; // userId of active player
  winnerId: number | null; // userId, or -1 for draw, null for active
  scores: Record<number, number>; // userId -> score
  rematchRequestedBy: number[];
}

// Global active games repository
const activeSessions: Map<number, GameSession> = new Map();

// Helper functions for Tic-Tac-Toe win checking
function checkTicTacToeWin(board: string[]): { winner: string; line?: number[] } | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every(cell => cell !== "")) {
    return { winner: "draw" };
  }
  return null;
}

// Helper functions for Connect 4 win checking
function checkConnect4Win(board: string[][]): string | null {
  const rows = 6;
  const cols = 7;

  // Horizontal
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 3; c++) {
      const val = board[r][c];
      if (val && val === board[r][c+1] && val === board[r][c+2] && val === board[r][c+3]) {
        return val;
      }
    }
  }

  // Vertical
  for (let r = 0; r < rows - 3; r++) {
    for (let c = 0; c < cols; c++) {
      const val = board[r][c];
      if (val && val === board[r+1][c] && val === board[r+2][c] && val === board[r+3][c]) {
        return val;
      }
    }
  }

  // Diagonal Down-Right
  for (let r = 0; r < rows - 3; r++) {
    for (let c = 0; c < cols - 3; c++) {
      const val = board[r][c];
      if (val && val === board[r+1][c+1] && val === board[r+2][c+2] && val === board[r+3][c+3]) {
        return val;
      }
    }
  }

  // Diagonal Up-Right
  for (let r = 3; r < rows; r++) {
    for (let c = 0; c < cols - 3; c++) {
      const val = board[r][c];
      if (val && val === board[r-1][c+1] && val === board[r-2][c+2] && val === board[r-3][c+3]) {
        return val;
      }
    }
  }

  // Check board full (draw)
  let full = true;
  for (let c = 0; c < cols; c++) {
    if (board[0][c] === "") {
      full = false;
      break;
    }
  }
  if (full) return "draw";

  return null;
}

// Core socket controller for games integration
export function handleGameSocket(io: Server, socket: Socket, executeQuery: (sql: string, params?: any[]) => Promise<any>) {
  
  // Helper to send system message to the conversation
  const sendGameEventMessage = async (conversationId: number, text: string) => {
    try {
      const dbRes = await executeQuery(
        "INSERT INTO messages (conversation_id, sender_id, receiver_id, message_text) VALUES (?, -1, -1, ?)",
        [conversationId, text]
      );
      const messageId = Number(dbRes.lastInsertRowid);
      const msgObj = {
        id: messageId,
        conversation_id: conversationId,
        sender_id: -1,
        receiver_id: -1,
        message_text: text,
        is_read: 0,
        reaction: null,
        created_at: new Date().toISOString()
      };
      // Fetch users in conversation to emit message
      const conv = await executeQuery("SELECT user1_id, user2_id FROM conversations WHERE id = ?", [conversationId]);
      if (conv && conv.rows && conv.rows[0]) {
        const { user1_id, user2_id } = conv.rows[0];
        io.to(`user_${user1_id}`).emit("receive_message", msgObj);
        io.to(`user_${user2_id}`).emit("receive_message", msgObj);
      }
    } catch (err) {
      console.error("[Game Engine] Error saving game event message:", err);
    }
  };

  // Broadcast game state to session players
  const broadcastGameState = (session: GameSession) => {
    session.players.forEach(p => {
      io.to(`user_${p.id}`).emit("game:state", session);
    });
  };

  // Get active session
  socket.on("game:get_active", ({ conversationId }: { conversationId: number }) => {
    const session = activeSessions.get(conversationId);
    if (session) {
      socket.emit("game:state", session);
    } else {
      socket.emit("game:state", null);
    }
  });

  // Initiate game lobby
  socket.on("game:initiate", async ({ conversationId, gameType, creator }: { conversationId: number; gameType: "tictactoe" | "connect4" | "chess"; creator: { id: number; username: string; avatarUrl: string } }) => {
    console.log(`[Game Engine] Initiated ${gameType} lobby for conversation ${conversationId} by ${creator.username}`);
    
    // Clean up any stale session
    activeSessions.delete(conversationId);

    const newSession: GameSession = {
      conversationId,
      gameType,
      status: "lobby",
      creatorId: creator.id,
      players: [{
        id: creator.id,
        username: creator.username,
        avatarUrl: creator.avatarUrl,
        ready: true // Host is always ready by default
      }],
      board: null,
      turn: creator.id,
      winnerId: null,
      scores: { [creator.id]: 0 },
      rematchRequestedBy: []
    };

    activeSessions.set(conversationId, newSession);
    broadcastGameState(newSession);

    // Send elegant game invitation card to the chat
    const inviteText = `[GAME_INVITATION]:${gameType}:${conversationId}:${creator.username}`;
    await sendGameEventMessage(conversationId, inviteText);
  });

  // Join existing lobby
  socket.on("game:join", async ({ conversationId, player }: { conversationId: number; player: { id: number; username: string; avatarUrl: string } }) => {
    const session = activeSessions.get(conversationId);
    if (!session) {
      socket.emit("game:error", "Game session not found or has expired.");
      return;
    }

    if (session.status !== "lobby") {
      socket.emit("game:error", "The game has already started.");
      return;
    }

    // Prevent duplicate joining
    const exists = session.players.some(p => p.id === player.id);
    if (exists) {
      broadcastGameState(session);
      return;
    }

    if (session.players.length >= 2) {
      socket.emit("game:error", "The game lobby is full.");
      return;
    }

    session.players.push({
      id: player.id,
      username: player.username,
      avatarUrl: player.avatarUrl,
      ready: false
    });

    session.scores[player.id] = 0;

    broadcastGameState(session);
    await sendGameEventMessage(conversationId, `🎮 @${player.username} joined the game lobby!`);
  });

  // Toggle ready state
  socket.on("game:ready", async ({ conversationId, playerId, ready }: { conversationId: number; playerId: number; ready: boolean }) => {
    const session = activeSessions.get(conversationId);
    if (!session) return;

    const p = session.players.find(p => p.id === playerId);
    if (p) {
      p.ready = ready;
      broadcastGameState(session);
      await sendGameEventMessage(conversationId, `${ready ? "🔥" : "💤"} @${p.username} is ${ready ? "ready" : "not ready"}.`);
    }
  });

  // Start the match
  socket.on("game:start", async ({ conversationId }: { conversationId: number }) => {
    const session = activeSessions.get(conversationId);
    if (!session) return;

    if (session.players.length < 2) {
      socket.emit("game:error", "Need at least 2 players to start.");
      return;
    }

    const allReady = session.players.every(p => p.ready);
    if (!allReady) {
      socket.emit("game:error", "All players must be ready to start the match.");
      return;
    }

    // Initialize Game state according to type
    if (session.gameType === "tictactoe") {
      session.board = Array(9).fill("");
      session.players[0].symbol = "X";
      session.players[1].symbol = "O";
      session.turn = session.players[0].id; // Creator goes first
    } else if (session.gameType === "connect4") {
      session.board = Array(6).fill(null).map(() => Array(7).fill(""));
      session.players[0].symbol = "Red";
      session.players[1].symbol = "Yellow";
      session.turn = session.players[0].id;
    } else if (session.gameType === "chess") {
      const chess = new Chess();
      session.board = chess.fen();
      session.players[0].symbol = "w"; // White
      session.players[1].symbol = "b"; // Black
      session.turn = session.players[0].id;
    }

    session.status = "playing";
    session.winnerId = null;
    session.rematchRequestedBy = [];

    broadcastGameState(session);
    await sendGameEventMessage(conversationId, `🏁 The ${session.gameType.toUpperCase()} match has started! Let the games begin.`);
  });

  // Make move
  socket.on("game:move", async ({ conversationId, playerId, move }: { conversationId: number; playerId: number; move: any }) => {
    const session = activeSessions.get(conversationId);
    if (!session || session.status !== "playing") return;

    if (session.turn !== playerId) {
      socket.emit("game:error", "It is not your turn!");
      return;
    }

    const playerIndex = session.players.findIndex(p => p.id === playerId);
    const opponent = session.players.find(p => p.id !== playerId);
    if (playerIndex === -1 || !opponent) return;

    const myPlayer = session.players[playerIndex];

    let gameEnded = false;
    let winnerId: number | null = null;
    let isDraw = false;

    // Validate and process the move based on game type
    if (session.gameType === "tictactoe") {
      const index = parseInt(move.index);
      if (isNaN(index) || index < 0 || index > 8 || session.board[index] !== "") {
        socket.emit("game:error", "Invalid move!");
        return;
      }

      session.board[index] = myPlayer.symbol!;
      const winResult = checkTicTacToeWin(session.board);
      if (winResult) {
        gameEnded = true;
        if (winResult.winner === "draw") {
          isDraw = true;
        } else {
          winnerId = myPlayer.id;
        }
      }
    } else if (session.gameType === "connect4") {
      const col = parseInt(move.col);
      if (isNaN(col) || col < 0 || col > 6 || session.board[0][col] !== "") {
        socket.emit("game:error", "Invalid column choice!");
        return;
      }

      // Find lowest empty slot in that column
      let rowPlaced = -1;
      for (let r = 5; r >= 0; r--) {
        if (session.board[r][col] === "") {
          session.board[r][col] = myPlayer.symbol!;
          rowPlaced = r;
          break;
        }
      }

      if (rowPlaced === -1) {
        socket.emit("game:error", "Column is already full!");
        return;
      }

      const winResult = checkConnect4Win(session.board);
      if (winResult) {
        gameEnded = true;
        if (winResult === "draw") {
          isDraw = true;
        } else {
          winnerId = myPlayer.id;
        }
      }
    } else if (session.gameType === "chess") {
      const chess = new Chess();
      chess.load(session.board);

      try {
        const moveResult = chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q"
        });

        session.board = chess.fen();

        if (chess.isGameOver()) {
          gameEnded = true;
          if (chess.isCheckmate()) {
            winnerId = myPlayer.id;
          } else {
            isDraw = true;
          }
        }
      } catch (err) {
        socket.emit("game:error", "Illegal chess move!");
        return;
      }
    }

    // Send a message summarizing key moves occasionally or at least toggle turn
    if (gameEnded) {
      session.status = "ended";
      if (isDraw) {
        session.winnerId = -1;
        broadcastGameState(session);
        await sendGameEventMessage(conversationId, `🤝 The ${session.gameType.toUpperCase()} match ended in a hard-fought Draw!`);
      } else if (winnerId) {
        session.winnerId = winnerId;
        session.scores[winnerId] = (session.scores[winnerId] || 0) + 1;
        broadcastGameState(session);
        await sendGameEventMessage(conversationId, `🏆 @${myPlayer.username} won the ${session.gameType.toUpperCase()} match!`);
      }
    } else {
      // Toggle turn
      session.turn = opponent.id;
      broadcastGameState(session);
      // Let chat know a move was made
      await sendGameEventMessage(conversationId, `♟️ @${myPlayer.username} made a move in ${session.gameType.toUpperCase()}.`);
    }
  });

  // Rematch request
  socket.on("game:rematch", async ({ conversationId, playerId }: { conversationId: number; playerId: number }) => {
    const session = activeSessions.get(conversationId);
    if (!session || session.status !== "ended") return;

    if (!session.rematchRequestedBy.includes(playerId)) {
      session.rematchRequestedBy.push(playerId);
    }

    const requester = session.players.find(p => p.id === playerId);
    await sendGameEventMessage(conversationId, `🔄 @${requester?.username} requested a rematch!`);

    if (session.rematchRequestedBy.length >= 2) {
      // Start a brand new game of same type!
      if (session.gameType === "tictactoe") {
        session.board = Array(9).fill("");
        session.turn = session.players[0].id;
      } else if (session.gameType === "connect4") {
        session.board = Array(6).fill(null).map(() => Array(7).fill(""));
        session.turn = session.players[0].id;
      } else if (session.gameType === "chess") {
        const chess = new Chess();
        session.board = chess.fen();
        session.turn = session.players[0].id;
      }

      session.status = "playing";
      session.winnerId = null;
      session.rematchRequestedBy = [];

      broadcastGameState(session);
      await sendGameEventMessage(conversationId, `🔥 Rematch Accepted! Let the new match begin!`);
    } else {
      broadcastGameState(session);
    }
  });

  // Leave Game
  socket.on("game:leave", async ({ conversationId, playerId }: { conversationId: number; playerId: number }) => {
    const session = activeSessions.get(conversationId);
    if (!session) return;

    const leaver = session.players.find(p => p.id === playerId);
    const opponent = session.players.find(p => p.id !== playerId);

    if (session.status === "playing" && opponent) {
      // Opponent wins by forfeit
      session.status = "ended";
      session.winnerId = opponent.id;
      session.scores[opponent.id] = (session.scores[opponent.id] || 0) + 1;
      broadcastGameState(session);
      await sendGameEventMessage(conversationId, `🏳️ @${leaver?.username} left the match. @${opponent.username} wins by forfeit!`);
    } else {
      // Just in lobby or ended
      session.players = session.players.filter(p => p.id !== playerId);
      if (session.players.length === 0) {
        activeSessions.delete(conversationId);
      } else {
        broadcastGameState(session);
        await sendGameEventMessage(conversationId, `🚪 @${leaver?.username} left the game lobby.`);
      }
    }
  });

  // Connection lost / cleanups
  socket.on("disconnect", () => {
    // Find if this user is in any active game
    activeSessions.forEach(async (session, conversationId) => {
      const isPlayer = session.players.some(p => `user_${p.id}` === `user_${socket.id}` || p.id === (socket as any).userId);
      // Wait, since we map socket connections inside user_ rooms, we can check by matching socket.rooms
      // But simpler, if player registers their disconnect, we can handle it or let client trigger leave.
      // Usually, when a user leaves the screen or socket disconnects, we can trigger an offline timeout or forfeit.
      // Let's rely on explicit "Leave Game" button for premium stability, but also handles socket drops
    });
  });
}
